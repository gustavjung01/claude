const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  listFiles: (folder) => ipcRenderer.invoke('list-files', folder),
  readFile: ({ folder, rel }) => ipcRenderer.invoke('read-file', { folder, rel }),
  runCmd: ({ cwd, command }) => ipcRenderer.invoke('run-cmd', { cwd, command }),
  stopCmd: () => ipcRenderer.invoke('stop-cmd'),
  onCmdOutput: (callback) => {
    ipcRenderer.on('command-output', (event, data) => callback(data));
  }
});
