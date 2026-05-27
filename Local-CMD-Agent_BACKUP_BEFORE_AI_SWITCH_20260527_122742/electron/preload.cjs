const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cmdTool", {
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  listFiles: (folder) => ipcRenderer.invoke("list-files", folder),
  readFile: (payload) => ipcRenderer.invoke("read-file", payload),
  runCmd: (payload) => ipcRenderer.invoke("run-cmd", payload),
  stopCmd: () => ipcRenderer.invoke("stop-cmd"),
  onCmdOutput: (callback) => {
    ipcRenderer.removeAllListeners("cmd-output");
    ipcRenderer.on("cmd-output", (_event, data) => callback(data));
  }
});
