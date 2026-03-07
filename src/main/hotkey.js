const { globalShortcut } = require('electron');

const HOTKEY = 'Ctrl+Shift+F12';

function register(onToggle) {
  const ok = globalShortcut.register(HOTKEY, onToggle);
  if (!ok) console.warn(`[hotkey] Failed to register ${HOTKEY}`);
  return ok;
}

function unregisterAll() {
  globalShortcut.unregisterAll();
}

module.exports = { register, unregisterAll, HOTKEY };
