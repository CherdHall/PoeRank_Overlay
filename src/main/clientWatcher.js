const fs = require('fs');

class ClientWatcher {
  constructor({ filePath, idleMinutes, onIdle, onActive }) {
    this.filePath    = filePath;
    this.idleMs      = idleMinutes * 60 * 1000;
    this.onIdle      = onIdle;
    this.onActive    = onActive;
    this.isIdle      = false;
    this.idleTimer   = null;
    this.watching    = false;
    this.lastSize    = 0;
  }

  start() {
    this._watch();
  }

  stop() {
    if (this.filePath) {
      try { fs.unwatchFile(this.filePath); } catch (_) {}
    }
    clearTimeout(this.idleTimer);
    this.watching = false;
  }

  updatePath(newPath) {
    this.stop();
    this.filePath = newPath;
    this.isIdle = false;
    this._watch();
  }

  updateIdleMinutes(minutes) {
    this.idleMs = minutes * 60 * 1000;
    this._resetIdleTimer();
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  _watch() {
    if (!this.filePath) return;

    // Gracefully handle missing file — PoE may not be running yet
    try {
      const stat = fs.statSync(this.filePath);
      this.lastSize = stat.size;
    } catch (_) {
      // File doesn't exist yet; we'll pick it up when it does
      this.lastSize = 0;
    }

    // Use watchFile (stat polling) for reliable cross-device detection on Windows
    fs.watchFile(this.filePath, { interval: 5000, persistent: false }, (curr) => {
      if (curr.size !== this.lastSize) {
        this.lastSize = curr.size;
        this._onActivity();
      }
    });

    this.watching = true;
    this._resetIdleTimer();
  }

  _onActivity() {
    if (this.isIdle) {
      this.isIdle = false;
      this.onActive();
    }
    this._resetIdleTimer();
  }

  _resetIdleTimer() {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (!this.isIdle) {
        this.isIdle = true;
        this.onIdle();
      }
    }, this.idleMs);
  }
}

module.exports = ClientWatcher;
