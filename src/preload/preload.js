const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('htAPI', {
  // 窗口控制
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  toggleOverlay: () => ipcRenderer.send('window:toggle-overlay'),
  setOverlayClickThrough: (enabled) => ipcRenderer.send('overlay:set-click-through', enabled),
  setOverlayOpacity: (opacity) => ipcRenderer.send('overlay:set-opacity', opacity),

  // 实时翻译传输
  broadcastTranslation: (data) => ipcRenderer.send('translation:broadcast', data),
  onTranslationUpdate: (callback) => {
    const subscription = (_event, value) => callback(value);
    ipcRenderer.on('translation:update', subscription);
    return () => ipcRenderer.removeListener('translation:update', subscription);
  },

  // 状态与配置
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  getSettings: () => ipcRenderer.invoke('settings:get'),

  // 系统音频捕获源
  getDesktopSources: () => ipcRenderer.invoke('desktop-capturer:get-sources')
});
