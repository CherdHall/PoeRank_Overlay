const { exec } = require('child_process');
const path = require('path');

// Resolves the PowerShell script path for both dev and packaged builds
function getScriptPath() {
  if (process.resourcesPath && !process.defaultApp) {
    // Packaged: extraResources lands in resources/
    return path.join(process.resourcesPath, 'checkPoe.ps1');
  }
  // Development
  return path.join(__dirname, '../../scripts/checkPoe.ps1');
}

class GameDetector {
  constructor({ intervalMs = 10000, onVisible, onBackground, onHidden }) {
    this.intervalMs   = intervalMs;
    this.onVisible    = onVisible;
    this.onBackground = onBackground || (() => {});
    this.onHidden     = onHidden;
    this.lastState    = null; // 'visible' | 'background' | 'hidden'
    this.timer        = null;
    this.scriptPath   = getScriptPath();
  }

  start() {
    this._check();
    this.timer = setInterval(() => this._check(), this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  _check() {
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${this.scriptPath}"`;
    exec(cmd, { timeout: 6000 }, (err, stdout) => {
      const raw      = err ? 'hidden' : stdout.trim().toLowerCase();
      const newState = ['visible', 'background', 'hidden'].includes(raw) ? raw : 'hidden';

      if (newState !== this.lastState) {
        this.lastState = newState;
        if (newState === 'visible')     this.onVisible();
        else if (newState === 'background') this.onBackground();
        else                            this.onHidden();
      }
    });
  }
}

module.exports = GameDetector;
