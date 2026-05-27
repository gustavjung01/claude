const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow;
let currentProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load Vite dev server in development or dist/index.html in production
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC: Select workspace folder
ipcMain.handle('select-workspace', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.filePaths[0];
});

// IPC: Get default workspace (user's home directory)
ipcMain.handle('get-default-workspace', () => {
  return app.getPath('home');
});

// IPC: List workspace files
ipcMain.handle('list-workspace-files', async (event, workspacePath) => {
  try {
    if (!workspacePath || !fs.existsSync(workspacePath)) {
      return { error: 'Workspace path does not exist' };
    }

    const files = [];
    const readDir = (dir, prefix = '') => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        // Skip node_modules and .git
        if (entry.name === 'node_modules' || entry.name === '.git') {
          continue;
        }

        const fullPath = path.join(dir, entry.name);
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          files.push({
            name: entry.name,
            path: relativePath,
            type: 'directory'
          });
          // Limit depth to avoid too many files
          if (relativePath.split('/').length < 3) {
            readDir(fullPath, relativePath);
          }
        } else if (entry.isFile()) {
          const stats = fs.statSync(fullPath);
          files.push({
            name: entry.name,
            path: relativePath,
            type: 'file',
            size: stats.size
          });
        }
      }
    };

    readDir(workspacePath);
    return { files };
  } catch (error) {
    return { error: error.message };
  }
});

// IPC: Read workspace file
ipcMain.handle('read-workspace-file', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { error: 'File does not exist' };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return { content };
  } catch (error) {
    return { error: error.message };
  }
});

// IPC: Open folder in explorer
ipcMain.handle('open-folder-in-explorer', async (event, folderPath) => {
  try {
    shell.openPath(folderPath);
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});

// IPC: Run raw CMD command
ipcMain.handle('run-raw-cmd', async (event, { cwd, command }) => {
  try {
    // Kill existing process if any
    if (currentProcess) {
      currentProcess.kill();
      currentProcess = null;
    }

    return new Promise((resolve) => {
      const cmdProcess = spawn('cmd.exe', ['/d', '/s', '/c', command], {
        cwd: cwd || process.cwd(),
        windowsHide: true
      });

      currentProcess = cmdProcess;
      let stdout = '';
      let stderr = '';

      // Stream output to renderer
      cmdProcess.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        mainWindow.webContents.send('command-output', { type: 'stdout', data: text });
      });

      cmdProcess.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        mainWindow.webContents.send('command-output', { type: 'stderr', data: text });
      });

      // Timeout after 60 seconds
      const timeout = setTimeout(() => {
        if (currentProcess) {
          currentProcess.kill();
          mainWindow.webContents.send('command-output', { 
            type: 'stderr', 
            data: '\n[TIMEOUT: Command killed after 60 seconds]' 
          });
        }
      }, 60000);

      cmdProcess.on('close', (code) => {
        clearTimeout(timeout);
        currentProcess = null;
        resolve({
          stdout,
          stderr,
          exitCode: code
        });
      });

      cmdProcess.on('error', (error) => {
        clearTimeout(timeout);
        currentProcess = null;
        resolve({
          stdout,
          stderr: stderr + '\n' + error.message,
          exitCode: -1
        });
      });
    });
  } catch (error) {
    return {
      stdout: '',
      stderr: error.message,
      exitCode: -1
    };
  }
});

// IPC: Stop current command
ipcMain.handle('stop-command', async () => {
  if (currentProcess) {
    currentProcess.kill();
    currentProcess = null;
    return { success: true };
  }
  return { success: false, message: 'No running command' };
});

// IPC: Open browser
ipcMain.handle('open-browser', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});
