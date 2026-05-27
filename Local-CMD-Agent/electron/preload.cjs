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
  },
  loadModels: (payload) => ipcRenderer.invoke("ai-load-models", payload),
  aiChat: (payload) => ipcRenderer.invoke("ai-chat", payload)
});

contextBridge.exposeInMainWorld("modelTerminal", {
  start: (payload) => ipcRenderer.invoke("start-model-terminal", payload),
  write: (text) => ipcRenderer.invoke("write-model-terminal", text),
  stop: () => ipcRenderer.invoke("stop-model-terminal"),
  resize: (cols, rows) => ipcRenderer.invoke("resize-model-terminal", { cols, rows }),
  clear: () => ipcRenderer.invoke("clear-model-terminal"),
  onData: (cb) => {
    ipcRenderer.removeAllListeners("model-terminal-data");
    ipcRenderer.on("model-terminal-data", (_e, d) => cb(d));
  },
  onFallback: (cb) => {
    ipcRenderer.removeAllListeners("model-terminal-fallback");
    ipcRenderer.on("model-terminal-fallback", (_e, d) => cb(d));
  }
});
