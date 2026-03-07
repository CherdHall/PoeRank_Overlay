const { getRank } = require('./api');

// States: STOPPED | PAUSED | RUNNING
// STOPPED = game not running (or no settings)
// PAUSED  = game running but Client.txt idle
// RUNNING = actively polling

class Poller {
  constructor({ store, onData, onError, onCountdown }) {
    this.store       = store;
    this.onData      = onData;
    this.onError     = onError;
    this.onCountdown = onCountdown;

    this.state            = 'STOPPED';
    this.remaining        = 0;
    this.tickTimer        = null;
    this.gameRunning      = false;
    this.fetching         = false;
    this.consecutiveErrors = 0;
  }

  // ─── Public control ──────────────────────────────────────────────────────

  start() {
    if (this.state !== 'STOPPED') return;
    this.gameRunning = true;
    this.state = 'RUNNING';
    this.pollNow();
  }

  stop() {
    this.state = 'STOPPED';
    this._clearTick();
    this.remaining = 0;
    this.onCountdown({ remaining: 0, paused: false, stopped: true });
  }

  pause() {
    if (this.state !== 'RUNNING') return;
    this.state = 'PAUSED';
    this._clearTick();
    this.onCountdown({ remaining: this.remaining, paused: true, stopped: false });
  }

  resume() {
    if (this.state !== 'PAUSED') return;
    this.state = 'RUNNING';
    if (this.remaining <= 0) {
      this.pollNow();
    } else {
      this._startTick();
    }
  }

  setGameRunning(isRunning) {
    this.gameRunning = isRunning;
    if (!isRunning) {
      if (this.state !== 'STOPPED') this.stop();
    } else {
      if (this.state === 'STOPPED') {
        const hasSettings = this.store.get('league') && this.store.get('character');
        if (hasSettings) this.start();
      }
    }
  }

  restart() {
    this.consecutiveErrors = 0;   // reset on intentional settings change
    this.stop();
    const hasSettings = this.store.get('league') && this.store.get('character');
    // Start polling whenever settings exist — game running state is checked separately
    if (hasSettings) {
      this.state = 'RUNNING';
      this.pollNow();
    }
  }

  async pollNow() {
    if (this.fetching) return;
    this._clearTick();

    const league    = this.store.get('league');
    const character = this.store.get('character');
    const apiBase   = this.store.get('apiBase');

    if (!league || !character) return;

    this.fetching = true;

    console.log(`[poller] fetching rank for "${character}" in "${league}" from ${apiBase}`);
    try {
      const data = await getRank(apiBase, league, character);

      if (data.error) {
        console.warn('[poller] API error:', data.error);
        this.consecutiveErrors++;
        this.onError({ ...data, consecutiveErrors: this.consecutiveErrors });
        this.remaining = 300; // retry after 5 min on error
      } else {
        console.log('[poller] rank data received:', data);
        this.consecutiveErrors = 0;
        this.onData(data);
        this.remaining = data.next_poll_seconds;
      }
    } catch (err) {
      console.error('[poller] fetch error:', err.message);
      this.consecutiveErrors++;
      this.onError({ error: err.message, consecutiveErrors: this.consecutiveErrors, connectionError: true });
      this.remaining = 300;
    } finally {
      this.fetching = false;
    }

    if (this.state === 'RUNNING') {
      this._startTick();
    } else if (this.state === 'PAUSED') {
      // Inform renderer of the new remaining value even though paused
      this.onCountdown({ remaining: this.remaining, paused: true, stopped: false });
    }
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  _startTick() {
    this._clearTick();
    this.tickTimer = setInterval(() => {
      if (this.state !== 'RUNNING') return;
      this.remaining = Math.max(0, this.remaining - 1);
      this.onCountdown({ remaining: this.remaining, paused: false, stopped: false });
      if (this.remaining <= 0) {
        this._clearTick();
        this.pollNow();
      }
    }, 1000);
  }

  _clearTick() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }
}

module.exports = Poller;
