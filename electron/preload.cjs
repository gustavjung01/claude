const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Workspace functions
  selectWorkspace: () => ipcRenderer.invoke('select-workspace'),
  getDefaultWorkspace: () => ipcRenderer.invoke('get-default-workspace'),
  listWorkspaceFiles: (workspacePath) => ipcRenderer.invoke('list-workspace-files', workspacePath),
  readWorkspaceFile: (filePath) => ipcRenderer.invoke('read-workspace-file', filePath),
  openFolderInExplorer: (folderPath) => ipcRenderer.invoke('open-folder-in-explorer', folderPath),
  
  // Command execution
  runCommand: (cwd, command) => ipcRenderer.invoke('run-raw-cmd', { cwd, command }),
  stopCommand: () => ipcRenderer.invoke('stop-command'),
  
  // Browser
  openBrowser: (url) => ipcRenderer.invoke('open-browser', url),
  
  // Event listeners
  onCommandOutput: (callback) => {
    ipcRenderer.on('command-output', (event, data) => callback(data));
  },
  
  // Remove listener
  removeCommandOutputListener: () => {
    ipcRenderer.removeAllListeners('command-output');
  }
});
