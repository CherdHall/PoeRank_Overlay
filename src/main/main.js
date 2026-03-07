const { app, BrowserWindow, ipcMain, screen, dialog, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

const store          = require('./store');
const api            = require('./api');
const Poller         = require('./poller');
const ClientWatcher  = require('./clientWatcher');
const GameDetector   = require('./gameDetector');
const hotkey         = require('./hotkey');
const { findClientTxt, findClientTxtFromProcess } = require('./clientFinder');

// ─── Dev flags — set all to false before shipping ────────────────────────────
// Simulate Client.txt not being auto-discovered (tests the manual path entry UI)
const DEV_SIMULATE_NO_CLIENT = false;
// Point the packaged build at the local Flask server for installer testing
const DEV_USE_LOCAL_API = true;

// Window dimensions
const OVERLAY_W = 172;
const OVERLAY_H = 190;

// Panel height is measured dynamically by the renderer via ResizeObserver.
// This estimate is used only for the very first open before the renderer reports back.
const PANEL_H_INITIAL = 310;

let win;
let tray;
let anchored          = true;
// Set true when the user explicitly opens settings from the tray/double-click while PoE is
// not in the foreground.  Prevents the game detector from hiding the window mid-config;
// cleared when the user anchors back.
let forceShowSettings = false;

// Safe IPC send — no-ops if the window has been destroyed (e.g. during app.quit())
function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}
let panelAbove     = false;       // whether the settings panel is rendered above the overlay
let lastPanelH     = PANEL_H_INITIAL;
let overlayScreenX = 0;           // screen X of the overlay image (not necessarily win X)
let overlayScreenY = 0;           // screen Y of the overlay image (not necessarily win Y)
let _repositioning = false;       // guard against recursive moved events during flip
let poller, clientWatcher, gameDetector;

// ─── Asset path helper ───────────────────────────────────────────────────────

function assetPath(filename) {
  // In packaged builds assets are extracted to process.resourcesPath via extraResources.
  // In development they live in assets/ relative to this file.
  return app.isPackaged
    ? path.join(process.resourcesPath, filename)
    : path.join(__dirname, '../../assets', filename);
}

// ─── System tray ─────────────────────────────────────────────────────────────

function createTray() {
  const icon = nativeImage.createFromPath(assetPath('icon.ico'));
  tray = new Tray(icon);
  tray.setToolTip('PoeRank Overlay');

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Settings',
      click: () => {
        if (win) {
          forceShowSettings = true;
          win.show();
          if (anchored) setAnchored(false);
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit PoeRank Overlay',
      click: () => app.quit()
    }
  ]);

  tray.setContextMenu(menu);

  // Double-click also toggles the settings panel
  tray.on('double-click', () => {
    if (win) {
      forceShowSettings = true;
      win.show();
      if (anchored) setAnchored(false);
    }
  });
}

// ─── Window creation ────────────────────────────────────────────────────────

function createWindow() {
  const savedX = store.get('overlayX');
  const savedY = store.get('overlayY');

  // Clamp saved position to a valid display
  const display = screen.getDisplayNearestPoint({ x: savedX, y: savedY });
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
  const clampedX = Math.min(Math.max(savedX, dx), dx + dw - OVERLAY_W);
  const clampedY = Math.min(Math.max(savedY, dy), dy + dh - OVERLAY_H);

  overlayScreenX = clampedX;
  overlayScreenY = clampedY;

  win = new BrowserWindow({
    x: clampedX,
    y: clampedY,
    width:  OVERLAY_W,
    height: OVERLAY_H,
    transparent: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setMenu(null);
  win.loadFile(path.join(__dirname, '../renderer/overlay.html'));

  // Open DevTools detached for development diagnostics — remove before shipping
  if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  win.on('moved', updateOverlayPosition);
}

// Keeps overlayScreenX/Y in sync with where the overlay image actually sits on screen.
// When panel is above: window top = overlayY - panelH, so overlayY = winY + panelH.
// When panel is below: window top = overlayY, so overlayY = winY.
// Also re-evaluates whether the panel should flip while dragging in unanchored mode.
function updateOverlayPosition() {
  if (!win || _repositioning) return;
  const [x, y] = win.getPosition();
  overlayScreenX = x;
  overlayScreenY = panelAbove ? y + lastPanelH : y;
  store.set('overlayX', overlayScreenX);
  store.set('overlayY', overlayScreenY);

  // While unanchored, check on every drag whether the panel should flip sides
  if (!anchored) {
    const { above, windowX, windowY, totalH } = computeLayout(overlayScreenX, overlayScreenY, lastPanelH);
    if (above !== panelAbove) {
      panelAbove = above;
      send('panel:position', { above });
      _repositioning = true;
      win.setSize(OVERLAY_W, totalH);
      win.setPosition(windowX, windowY);
      _repositioning = false;
    }
  }
}

// Decides whether the panel fits below the overlay or must flip above it.
// Returns the window origin and total height for the given overlay position + panel height.
function computeLayout(ox, oy, panelH) {
  const display = screen.getDisplayNearestPoint({ x: ox, y: oy });
  const { x: dx, y: dy, height: dh } = display.workArea;

  const belowFits = oy + OVERLAY_H + panelH <= dy + dh;
  const above     = !belowFits;

  let windowY;
  if (above) {
    windowY = Math.max(dy, oy - panelH);
  } else {
    windowY = Math.min(oy, dy + dh - OVERLAY_H - panelH);
    windowY = Math.max(dy, windowY);
  }

  return { above, windowX: ox, windowY, totalH: OVERLAY_H + panelH };
}

// ─── Anchor / Unanchor ───────────────────────────────────────────────────────

function setAnchored(isAnchored) {
  anchored = isAnchored;

  if (anchored) {
    forceShowSettings = false;
    // overlayScreenX/Y are kept current by updateOverlayPosition; restore window to overlay size there.
    win.setSize(OVERLAY_W, OVERLAY_H);
    win.setPosition(overlayScreenX, overlayScreenY);
    win.setIgnoreMouseEvents(true, { forward: true });
    panelAbove = false;
    store.set('overlayX', overlayScreenX);
    store.set('overlayY', overlayScreenY);
  } else {
    // When transitioning from anchored, the window IS the overlay size so win pos = overlay pos.
    const [wx, wy] = win.getPosition();
    overlayScreenX = wx;
    overlayScreenY = wy;

    const { above, windowX, windowY, totalH } = computeLayout(overlayScreenX, overlayScreenY, lastPanelH);
    panelAbove = above;

    win.setSize(OVERLAY_W, totalH);
    win.setPosition(windowX, windowY);
    win.setIgnoreMouseEvents(false);

    send('settings:current', {
      league:    store.get('league')    || '',
      character: store.get('character') || ''
    });
    const clientFound = !!store.get('clientTxtPath');
    send('client:status',  { found: clientFound });
    send('panel:position', { above });
    fetchAndSendLeagues();
  }

  send('anchor:state', { anchored });
}

// ─── Services ────────────────────────────────────────────────────────────────

function startServices() {
  // Poller
  poller = new Poller({
    store,
    onData(data)     { send('rank:update',   data); },
    onError(err)     { send('rank:error',    err);  },
    onCountdown(info){ send('rank:countdown', info); }
  });

  // Auto-discover Client.txt; gracefully no-ops if not found
  const clientTxtPath = DEV_SIMULATE_NO_CLIENT ? '' : (findClientTxt() || store.get('clientTxtPath'));
  store.set('clientTxtPath', clientTxtPath || '');

  // Client.txt idle watcher
  clientWatcher = new ClientWatcher({
    filePath:    clientTxtPath,
    idleMinutes: store.get('idleMinutes'),
    onIdle() {
      poller.pause();
      send('poll:status', { idle: true });
    },
    onActive() {
      poller.resume();
      send('poll:status', { idle: false });
    }
  });

  // Game window detector
  gameDetector = new GameDetector({
    intervalMs: 3000,

    // PoE is the foreground window — show overlay in all modes
    onVisible() {
      if (win) win.show();
      poller.setGameRunning(true);
      // If Client.txt wasn't found at startup (game wasn't running yet), retry now
      if (!store.get('clientTxtPath') && !DEV_SIMULATE_NO_CLIENT) {
        const found = findClientTxtFromProcess();
        if (found) {
          store.set('clientTxtPath', found);
          clientWatcher.updatePath(found);
          send('client:status', { found: true });
        }
      }
    },

    // PoE is running/not minimized but another app has focus
    onBackground() {
      // Anchored overlay hides (nothing to interact with); unanchored stays
      // visible so the user can continue configuring while switching windows
      if (anchored && win) win.hide();
      poller.setGameRunning(true);
    },

    // PoE is minimized or closed — hide in all modes unless user deliberately opened settings
    onHidden() {
      if (!forceShowSettings && win) win.hide();
      poller.setGameRunning(false);
    }
  });

  clientWatcher.start();
  gameDetector.start();

  // Only start polling if settings are configured
  if (store.get('league') && store.get('character')) {
    poller.start();
  }
}

function stopServices() {
  if (poller)        poller.stop();
  if (clientWatcher) clientWatcher.stop();
  if (gameDetector)  gameDetector.stop();
}

// ─── League fetch ────────────────────────────────────────────────────────────

async function fetchAndSendLeagues() {
  try {
    const data = await api.getLeagues(store.get('apiBase'));
    send('leagues:data', data);
  } catch (err) {
    console.error('[main] getLeagues failed:', err.message);
    send('leagues:data', { leagues: [] });
  }
}

// ─── IPC handlers ────────────────────────────────────────────────────────────

function registerIPC() {
  ipcMain.on('anchor:set', (_, isAnchored) => {
    setAnchored(isAnchored);
  });

  // Renderer reports its actual rendered panel height.
  // Resize the window and re-evaluate above/below placement every time it changes.
  ipcMain.on('panel:setHeight', (_, panelH) => {
    if (!win || anchored || panelH <= 0) return;
    lastPanelH = panelH;

    const { above, windowX, windowY, totalH } = computeLayout(overlayScreenX, overlayScreenY, panelH);

    if (above !== panelAbove) {
      panelAbove = above;
      send('panel:position', { above });
    }

    win.setSize(OVERLAY_W, totalH);
    win.setPosition(windowX, windowY);
  });

  ipcMain.on('settings:save', (_, payload) => {
    console.log('[main] settings:save received:', JSON.stringify(payload));
    const { league, character } = payload || {};
    if (!league || !character) {
      console.warn('[main] settings:save ignored — empty league or character');
      return;
    }
    store.set('league', league);
    store.set('character', character);
    console.log('[main] settings saved. league:', league, '| character:', character);
    poller.restart();
  });

  ipcMain.on('settings:getLeagues', () => fetchAndSendLeagues());

  ipcMain.on('poll:manual', () => {
    if (poller) poller.pollNow();
  });

  // Client.txt manual path — set directly from text input
  ipcMain.on('client:setPath', (_, filePath) => {
    if (!filePath) return;
    store.set('clientTxtPath', filePath);
    clientWatcher.updatePath(filePath);
    console.log('[main] Client.txt path set manually:', filePath);
    send('client:status', { found: true });
  });

  // Client.txt browse dialog
  ipcMain.handle('client:browse', async () => {
    const result = await dialog.showOpenDialog(win, {
      title: 'Locate Client.txt',
      defaultPath: 'C:\\',
      filters: [{ name: 'Log file', extensions: ['txt'] }],
      properties: ['openFile']
    });
    if (result.canceled || !result.filePaths.length) return null;
    const filePath = result.filePaths[0];
    store.set('clientTxtPath', filePath);
    clientWatcher.updatePath(filePath);
    console.log('[main] Client.txt path set via browse:', filePath);
    send('client:status', { found: true });
    return filePath;
  });
}

// ─── App lifecycle ───────────────────────────────────────────────────────────

// Override apiBase — active in dev mode always, and in packaged builds when DEV_USE_LOCAL_API is true.
if (!app.isPackaged || DEV_USE_LOCAL_API) {
  store.set('apiBase', 'http://localhost:5000');
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerIPC();

  hotkey.register(() => {
    if (anchored) {
      // Anchored → unanchored: open settings panel directly
      setAnchored(false);
    } else {
      // Unanchored → anchored: ask renderer to validate & save inputs first
      send('anchor:hotkey');
    }
  });

  startServices();

  // Send initial anchor state and current settings to renderer once loaded
  win.webContents.once('did-finish-load', () => {
    send('anchor:state', { anchored });
    send('poll:status', { idle: false });

    // If no settings yet, open in unanchored mode
    if (!store.get('league') || !store.get('character')) {
      setAnchored(false);
    }
  });
});

app.on('will-quit', () => {
  hotkey.unregisterAll();
  stopServices();
  if (tray) { tray.destroy(); tray = null; }
});

// Prevent default Electron quit-on-all-windows-closed on Windows
app.on('window-all-closed', () => {
  // Keep running — overlay is a background app
});
