const Store = require('electron-store');

const store = new Store({
  schema: {
    league: {
      type: 'string',
      default: ''
    },
    character: {
      type: 'string',
      default: ''
    },
    overlayX: {
      type: 'number',
      default: 100
    },
    overlayY: {
      type: 'number',
      default: 100
    },
    clientTxtPath: {
      type: 'string',
      default: ''
    },
    idleMinutes: {
      type: 'number',
      default: 5
    },
    apiBase: {
      type: 'string',
      default: 'https://poerank.com'
    }
  }
});

module.exports = store;
