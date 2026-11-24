const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('sejongDesktop', {
  isDesktop: true,
  getFilePath: (file) => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file) || '';
      }
      return (file && typeof file.path === 'string' && file.path) || '';
    } catch {
      return '';
    }
  },
  consumeLaunchFiles: () => ipcRenderer.invoke('sejong:consume-launch-files'),
  onOpenFiles: (callback) => {
    const listener = (_event, filePaths) => {
      if (Array.isArray(filePaths) && filePaths.length > 0) {
        callback(filePaths);
      }
    };
    ipcRenderer.on('sejong:open-files', listener);
    return () => ipcRenderer.removeListener('sejong:open-files', listener);
  },
  readFile: (filePath) => ipcRenderer.invoke('sejong:read-file', filePath),
  statFile: (filePath) => ipcRenderer.invoke('sejong:stat-file', filePath),
  writeFile: (filePath, bytes) => ipcRenderer.invoke('sejong:write-file', filePath, bytes),
  minimizeWindow: () => ipcRenderer.invoke('sejong:window-minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('sejong:window-toggle-maximize'),
  isWindowMaximized: () => ipcRenderer.invoke('sejong:window-is-maximized'),
  onWindowMaximizedChange: (callback) => {
    const listener = (_event, maximized) => {
      callback(Boolean(maximized));
    };
    ipcRenderer.on('sejong:window-maximized-changed', listener);
    return () => ipcRenderer.removeListener('sejong:window-maximized-changed', listener);
  },
  closeApp: () => ipcRenderer.invoke('sejong:window-close'),
  confirmUnsavedChanges: (action = 'leave') =>
    ipcRenderer.invoke('sejong:confirm-unsaved-changes', action),
  startWindowDrag: (screenX, screenY) =>
    ipcRenderer.send('sejong:window-drag-start', screenX, screenY),
  moveWindowDrag: (screenX, screenY) =>
    ipcRenderer.send('sejong:window-drag-move', screenX, screenY),
  endWindowDrag: () => ipcRenderer.send('sejong:window-drag-end'),
  getUpdateState: () => ipcRenderer.invoke('sejong:update-get-state'),
  checkForUpdates: () => ipcRenderer.invoke('sejong:update-check'),
  downloadUpdate: () => ipcRenderer.invoke('sejong:update-download'),
  installUpdate: () => ipcRenderer.invoke('sejong:update-install'),
  onUpdateStateChange: (callback) => {
    const listener = (_event, nextState) => {
      if (nextState && typeof nextState === 'object') {
        callback(nextState);
      }
    };
    ipcRenderer.on('sejong:update-state', listener);
    return () => ipcRenderer.removeListener('sejong:update-state', listener);
  },
  onCheckUnsavedChanges: (callback) => {
    const listener = (_event, requestId) => {
      Promise.resolve()
        .then(() => callback())
        .then((dirty) => {
          ipcRenderer.send('sejong:unsaved-changes-reply', requestId, Boolean(dirty));
        })
        .catch(() => {
          ipcRenderer.send('sejong:unsaved-changes-reply', requestId, false);
        });
    };
    ipcRenderer.on('sejong:check-unsaved-changes', listener);
    return () => ipcRenderer.removeListener('sejong:check-unsaved-changes', listener);
  },
});
