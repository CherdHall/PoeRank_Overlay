const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CLIENT_RELATIVE = path.join('logs', 'Client.txt');

// ─── Steam library folder discovery ─────────────────────────────────────────

function getSteamInstallPath() {
  try {
    const cmd = `powershell -NoProfile -Command "(Get-ItemProperty 'HKLM:\\SOFTWARE\\WOW6432Node\\Valve\\Steam' -ErrorAction SilentlyContinue).InstallPath"`;
    const result = execSync(cmd, { timeout: 4000 }).toString().trim();
    return result || null;
  } catch (_) {
    return null;
  }
}

// Parse Steam's libraryfolders.vdf to get all library roots
function getSteamLibraryRoots(steamInstallPath) {
  const roots = [];
  if (steamInstallPath) roots.push(steamInstallPath);

  const vdfPath = steamInstallPath
    ? path.join(steamInstallPath, 'steamapps', 'libraryfolders.vdf')
    : null;

  if (vdfPath && fs.existsSync(vdfPath)) {
    try {
      const content = fs.readFileSync(vdfPath, 'utf8');
      // Match "path"  "D:\SomeFolder" in both old and new VDF formats
      const re = /"path"\s+"([^"]+)"/g;
      let m;
      while ((m = re.exec(content)) !== null) {
        const libRoot = m[1].replace(/\\\\/g, '\\');
        if (!roots.includes(libRoot)) roots.push(libRoot);
      }
    } catch (_) {}
  }

  return roots;
}

// Given a Steam library root, find the PoE Client.txt inside it
function findInLibrary(libraryRoot) {
  const steamappsCommon = path.join(libraryRoot, 'steamapps', 'common');
  try {
    const entries = fs.readdirSync(steamappsCommon);
    for (const entry of entries) {
      if (entry.toLowerCase().startsWith('path of exile')) {
        const candidate = path.join(steamappsCommon, entry, CLIENT_RELATIVE);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  } catch (_) {}
  return null;
}

// ─── Standalone / Epic fallback paths ────────────────────────────────────────

const STANDALONE_BASES = [
  'C:\\Program Files (x86)\\Grinding Gear Games',
  'C:\\Program Files\\Grinding Gear Games',
  'C:\\Program Files\\Epic Games',
  'C:\\Program Files (x86)\\Epic Games',
];

// All drive letters to scan for standalone or non-standard Steam installs
const ALL_DRIVES = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const DRIVE_RELATIVE_ROOTS = [
  'Grinding Gear Games',
  'Games\\Grinding Gear Games',
  'Epic Games',
  'Games\\Epic Games',
  'Games\\Steam\\steamapps\\common',
  'SteamGames\\steamapps\\common',
];

function findInBase(baseDir) {
  try {
    const entries = fs.readdirSync(baseDir);
    for (const entry of entries) {
      if (entry.toLowerCase().startsWith('path of exile')) {
        const candidate = path.join(baseDir, entry, CLIENT_RELATIVE);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  } catch (_) {}
  return null;
}

// ─── Detect from running PoE process (most reliable, any install location) ───

function findClientTxtFromProcess() {
  try {
    const cmd = `powershell -NoProfile -Command "(Get-Process -Name 'PathOfExile*' -ErrorAction SilentlyContinue | Select-Object -First 1).Path"`;
    const exePath = execSync(cmd, { timeout: 4000 }).toString().trim();
    if (!exePath) return null;

    const poeDir    = path.dirname(exePath);
    const candidate = path.join(poeDir, 'logs', 'Client.txt');
    if (fs.existsSync(candidate)) {
      console.log('[clientFinder] Found Client.txt from running process:', candidate);
      return candidate;
    }
  } catch (_) {}
  return null;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

function findClientTxt() {
  // Try running process first — handles any install location
  const fromProcess = findClientTxtFromProcess();
  if (fromProcess) return fromProcess;

  // 1. Steam: registry + libraryfolders.vdf (covers games on any drive)
  const steamRoot = getSteamInstallPath();
  const steamLibs = getSteamLibraryRoots(steamRoot);
  for (const lib of steamLibs) {
    const found = findInLibrary(lib);
    if (found) {
      console.log('[clientFinder] Found Client.txt via Steam library:', found);
      return found;
    }
  }

  // 2. Fixed standalone paths on C:
  for (const base of STANDALONE_BASES) {
    const found = findInBase(base);
    if (found) {
      console.log('[clientFinder] Found Client.txt at:', found);
      return found;
    }
  }

  // 3. Sweep all drives with common relative roots
  for (const drive of ALL_DRIVES) {
    for (const rel of DRIVE_RELATIVE_ROOTS) {
      const base = `${drive}:\\${rel}`;
      const found = findInBase(base);
      if (found) {
        console.log('[clientFinder] Found Client.txt on drive scan:', found);
        return found;
      }
    }
  }

  console.log('[clientFinder] Client.txt not found — idle detection disabled');
  return null;
}

module.exports = { findClientTxt, findClientTxtFromProcess };
