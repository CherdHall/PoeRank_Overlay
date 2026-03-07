'use strict';

// ─── Formatter utilities ──────────────────────────────────────────────────────

function formatRank(val) {
  if (val === null || val === undefined) return '—';
  if (val < 1000) return String(val);
  const k = val / 1000;
  return (k % 1 === 0 ? k.toString() : parseFloat(k.toFixed(1)).toString()) + 'k';
}

function formatXpHr(val) {
  if (val === null || val === undefined) return '—';
  if (val >= 1_000_000_000) return parseFloat((val / 1e9).toFixed(1)) + 'B';
  if (val >= 100_000_000)   return Math.round(val / 1e6) + 'M';
  if (val >= 1_000_000)     return parseFloat((val / 1e6).toFixed(1)) + 'M';
  if (val >= 10_000)        return Math.round(val / 1000) + 'k';
  if (val >= 1_000)         return parseFloat((val / 1000).toFixed(1)) + 'k';
  return String(val);
}

function formatCountdown(remaining, paused, stopped) {
  if (stopped)         return '—';
  if (remaining <= 0)  return '…';
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const timeStr = m > 0
    ? `${m}:${String(s).padStart(2, '0')}`
    : `${s}s`;
  return paused ? `⏸ ${timeStr}` : timeStr;
}

// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  prevLeagueRank: null,
  prevClassRank:  null,
  idle:           false,
  anchored:       true,
  storedLeague:   ''
};

// ─── DOM refs ────────────────────────────────────────────────────────────────

const elLeague    = document.getElementById('val-league');
const elClass     = document.getElementById('val-class');
const elXp        = document.getElementById('val-xp');
const elCountdown = document.getElementById('val-countdown');
const elStatus    = document.getElementById('status-line');
const elPanel     = document.getElementById('settings-panel');
const selLeague   = document.getElementById('sel-league');
const inpChar     = document.getElementById('inp-char');
const btnTest     = document.getElementById('btn-test');
const btnAnchor   = document.getElementById('btn-anchor');
const clientRow   = document.getElementById('client-row');
const inpClient   = document.getElementById('inp-client');
const btnBrowse   = document.getElementById('btn-browse');

// ─── Dynamic panel height reporting ──────────────────────────────────────────
// Whenever the settings panel's rendered height changes (content added/removed),
// report the new height to the main process so it can resize the window to fit.

let _resizeTimer = null;
const panelObserver = new ResizeObserver(() => {
  if (state.anchored) return;
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    const h = elPanel.offsetHeight;
    if (h > 0) window.api.setPanelHeight(h);
  }, 30);
});
panelObserver.observe(elPanel);

// Panel flip: when the panel is above the overlay, body gets 'panel-above'
// which reverses the flex order so the panel renders on top.
window.api.onPanelPosition(({ above }) => {
  document.body.classList.toggle('panel-above', above);
});

// ─── Rank color helper ────────────────────────────────────────────────────────

function applyRankColor(el, newVal, prevVal) {
  el.classList.remove('rank-improved', 'rank-worse');
  if (prevVal === null || newVal === null) return;
  if (newVal < prevVal) el.classList.add('rank-improved');
  else if (newVal > prevVal) el.classList.add('rank-worse');
}

// ─── IPC → UI ────────────────────────────────────────────────────────────────

window.api.onRankUpdate((data) => {
  const {
    league_rank, class_rank, asc_rank,
    ascendancy, xp_hr
  } = data;

  // League rank
  applyRankColor(elLeague, league_rank, state.prevLeagueRank);
  elLeague.textContent = formatRank(league_rank);
  state.prevLeagueRank = league_rank;

  // Show ascendancy rank if available, otherwise class rank
  const displayRank = (asc_rank !== null && asc_rank !== undefined) ? asc_rank : class_rank;
  applyRankColor(elClass, displayRank, state.prevClassRank);
  elClass.textContent = formatRank(displayRank);
  state.prevClassRank = displayRank;

  // XP/hr
  elXp.textContent = formatXpHr(xp_hr);

  // Clear any error state on the countdown box
  elCountdown.style.color = '';
  elCountdown.classList.remove('countdown-error');
  clearStatus();
});

window.api.onRankError((data) => {
  setStatus(data.error || 'Unknown error', 'error');
  // Only surface the error in the countdown box after 2+ consecutive failures,
  // so a single transient error during a character switch doesn't flash "NO CHAR".
  if (state.anchored && (data.consecutiveErrors || 0) >= 2) {
    elCountdown.textContent = 'NO CHAR';
    elCountdown.style.color = '#b01a1a';
    elCountdown.classList.add('countdown-error');
  }
});

window.api.onCountdown(({ remaining, paused, stopped }) => {
  elCountdown.classList.remove('countdown-error');
  elCountdown.style.color = '';
  elCountdown.textContent = formatCountdown(remaining, paused, stopped);

  if (paused || stopped) {
    elCountdown.classList.add('rank-idle');
  } else {
    elCountdown.classList.remove('rank-idle');
  }
});

window.api.onAnchorState(({ anchored }) => {
  state.anchored = anchored;
  document.body.classList.toggle('unanchored', !anchored);
  elPanel.classList.toggle('hidden', anchored);

  // ResizeObserver doesn't fire for display:none → visible transitions,
  // so explicitly report height once the panel is rendered.
  if (!anchored) {
    requestAnimationFrame(() => {
      const h = elPanel.offsetHeight;
      if (h > 0) window.api.setPanelHeight(h);
    });
  }
});

// Pre-populate inputs with previously saved settings when panel opens
window.api.onCurrentSettings(({ league, character }) => {
  if (character) inpChar.value = character;
  // League is restored after the leagues list loads (see onLeagues handler)
  if (league) state.storedLeague = league;
});

// When hotkey is used to go unanchored→anchored, run the same save logic as the button
window.api.onHotkeyAnchor(() => {
  const league    = selLeague.value.trim();
  const character = inpChar.value.trim();

  if (!clientRow.classList.contains('hidden')) {
    setStatus('Locate your Client.txt file before anchoring.', 'error');
    return;
  }
  if (!league || !character) {
    setStatus('Set league and character before anchoring.', 'error');
    return;
  }

  localStorage.setItem('poerank_league', league);
  window.api.saveSettings({ league, character });
  window.api.setAnchor(true);
});

window.api.onClientStatus(({ found }) => {
  clientRow.classList.toggle('hidden', found);
});

window.api.onPollStatus(({ idle }) => {
  state.idle = idle;
});

window.api.onLeagues((data) => {
  const leagues = data.leagues || [];
  selLeague.innerHTML = '';

  if (leagues.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No leagues available';
    selLeague.appendChild(opt);
    return;
  }

  leagues.forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    selLeague.appendChild(opt);
  });

  // Restore previously selected league (from store via onCurrentSettings, or localStorage)
  const storedLeague = state.storedLeague || localStorage.getItem('poerank_league');
  if (storedLeague && leagues.includes(storedLeague)) selLeague.value = storedLeague;
});

// ─── Settings panel interactions ──────────────────────────────────────────────

btnAnchor.addEventListener('click', () => {
  const league    = selLeague.value.trim();
  const character = inpChar.value.trim();

  if (!clientRow.classList.contains('hidden')) {
    setStatus('Locate your Client.txt file before anchoring.', 'error');
    return;
  }
  if (!league || !character) {
    setStatus('Select a league and enter a character name.', 'error');
    return;
  }

  localStorage.setItem('poerank_league', league);
  window.api.saveSettings({ league, character });
  window.api.setAnchor(true);
});

btnTest.addEventListener('click', () => {
  const league    = selLeague.value.trim();
  const character = inpChar.value.trim();
  if (!league || !character) {
    setStatus('Select a league and enter a character first.', 'error');
    return;
  }
  localStorage.setItem('poerank_league', league);
  window.api.saveSettings({ league, character });
  setStatus('Fetching…', '');
  window.api.manualPoll();

  // 10-second cooldown to prevent API spam
  btnTest.disabled = true;
  let secs = 10;
  const timer = setInterval(() => {
    secs--;
    if (secs <= 0) {
      clearInterval(timer);
      btnTest.disabled = false;
      btnTest.textContent = 'Test';
    } else {
      btnTest.textContent = `Test (${secs}s)`;
    }
  }, 1000);
});

// Client.txt — Browse button
btnBrowse.addEventListener('click', async () => {
  const filePath = await window.api.browseClientTxt();
  if (filePath) {
    inpClient.value = filePath;
    clientRow.classList.add('hidden');
    setStatus('Client.txt path saved.', 'ok');
  }
});

// Client.txt — manual text input (save on Enter or blur)
function saveClientPath() {
  const p = inpClient.value.trim();
  if (p) {
    window.api.setClientPath(p);
    clientRow.classList.add('hidden');
    setStatus('Client.txt path saved.', 'ok');
  }
}
inpClient.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveClientPath(); });
inpClient.addEventListener('blur', saveClientPath);

// ─── Status helpers ───────────────────────────────────────────────────────────

function setStatus(msg, cls) {
  elStatus.textContent = msg;
  elStatus.className = cls || '';
}

function clearStatus() {
  elStatus.textContent = '';
  elStatus.className = '';
}
