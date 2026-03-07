const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Main → Renderer listeners
  onRankUpdate:       (cb) => ipcRenderer.on('rank:update',       (_, d) => cb(d)),
  onRankError:        (cb) => ipcRenderer.on('rank:error',        (_, d) => cb(d)),
  onCountdown:        (cb) => ipcRenderer.on('rank:countdown',    (_, d) => cb(d)),
  onAnchorState:      (cb) => ipcRenderer.on('anchor:state',      (_, d) => cb(d)),
  onLeagues:          (cb) => ipcRenderer.on('leagues:data',      (_, d) => cb(d)),
  onPollStatus:       (cb) => ipcRenderer.on('poll:status',       (_, d) => cb(d)),
  onCurrentSettings:  (cb) => ipcRenderer.on('settings:current',  (_, d) => cb(d)),
  onHotkeyAnchor:     (cb) => ipcRenderer.on('anchor:hotkey',     (_)    => cb()),
  onClientStatus:     (cb) => ipcRenderer.on('client:status',     (_, d) => cb(d)),
  onClientPathError:  (cb) => ipcRenderer.on('client:pathError',  (_, d) => cb(d)),
  onPanelPosition:    (cb) => ipcRenderer.on('panel:position',    (_, d) => cb(d)),

  // Renderer → Main senders
  setAnchor:      (anchored)  => ipcRenderer.send('anchor:set', anchored),
  saveSettings:   (data)      => ipcRenderer.send('settings:save', data),
  getLeagues:     ()          => ipcRenderer.send('settings:getLeagues'),
  manualPoll:     ()          => ipcRenderer.send('poll:manual'),
  setClientPath:  (filePath)  => ipcRenderer.send('client:setPath', filePath),
  browseClientTxt: ()         => ipcRenderer.invoke('client:browse'),
  setPanelHeight: (h)         => ipcRenderer.send('panel:setHeight', h)
});
