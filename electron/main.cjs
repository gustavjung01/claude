const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) {
    return null;
  }
  return result.filePaths[0];
});

const IGNORED_ENTRIES = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.vite', '.cache']);

ipcMain.handle('list-files', async (event, workspacePath) => {
  try {
    if (!workspacePath || !fs.existsSync(workspacePath)) {
      return { error: 'Workspace path does not exist' };
    }

    const files = [];

    const readDir = (dir, prefix = '') => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (IGNORED_ENTRIES.has(entry.name)) {
          continue;
        }

        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          files.push({ name: entry.name, path: relativePath, type: 'directory' });
          readDir(fullPath, relativePath);
        } else if (entry.isFile()) {
          const stats = fs.statSync(fullPath);
          files.push({ name: entry.name, path: relativePath, type: 'file', size: stats.size });
        }
      }
    };

    readDir(workspacePath);
    return { ok: true, files };
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('read-file', async (event, { folder, rel }) => {
  try {
    if (!folder || !rel) {
      return { error: 'Invalid file request' };
    }

    const normalizedFolder = path.normalize(folder);
    const requestedPath = path.normalize(path.join(normalizedFolder, rel));

    if (!requestedPath.startsWith(normalizedFolder)) {
      return { error: 'Invalid file path' };
    }

    if (!fs.existsSync(requestedPath) || !fs.statSync(requestedPath).isFile()) {
      return { error: 'File does not exist' };
    }

    const stats = fs.statSync(requestedPath);
    if (stats.size > 500 * 1024) {
      return { error: 'File too large to preview (>500KB)' };
    }

    const content = fs.readFileSync(requestedPath, 'utf-8');
    return { ok: true, content };
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('run-cmd', async (event, { cwd, command }) => {
  try {
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

      cmdProcess.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        if (mainWindow) {
          mainWindow.webContents.send('command-output', { type: 'stdout', data: text });
        }
      });

      cmdProcess.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        if (mainWindow) {
          mainWindow.webContents.send('command-output', { type: 'stderr', data: text });
        }
      });

      const timeout = setTimeout(() => {
        if (currentProcess) {
          currentProcess.kill();
          currentProcess = null;
          if (mainWindow) {
            mainWindow.webContents.send('command-output', {
              type: 'stderr',
              data: '\n[TIMEOUT: Command killed after 60 seconds]'
            });
          }
        }
      }, 60000);

      cmdProcess.on('close', (code) => {
        clearTimeout(timeout);
        currentProcess = null;
        resolve({ ok: true, cwd: cwd || process.cwd(), command, stdout, stderr, exitCode: code });
      });

      cmdProcess.on('error', (error) => {
        clearTimeout(timeout);
        currentProcess = null;
        resolve({ ok: false, cwd: cwd || process.cwd(), command, stdout, stderr: stderr + '\n' + error.message, exitCode: -1 });
      });
    });
  } catch (error) {
    return { ok: false, cwd: cwd || process.cwd(), command, stdout: '', stderr: error.message, exitCode: -1 };
  }
});

ipcMain.handle('stop-cmd', async () => {
  if (currentProcess) {
    currentProcess.kill();
    currentProcess = null;
    return { success: true };
  }
  return { success: false, message: 'No running command' };
});
