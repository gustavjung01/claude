const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

let win = null;
let runningChild = null;

const IGNORE_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", ".vite", ".cache"]);
const TEXT_EXT = new Set([
  ".txt", ".md", ".json", ".js", ".jsx", ".ts", ".tsx", ".css", ".html",
  ".mjs", ".cjs", ".py", ".ps1", ".cmd", ".bat", ".yml", ".yaml"
]);

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 1100,
    minHeight: 720,
    title: "Local CMD Agent",
    backgroundColor: "#0b1020",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

function safeTextFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const st = fs.statSync(filePath);
  if (!st.isFile()) return false;
  if (st.size > 500000) return false;
  const name = path.basename(filePath);
  if (name === ".gitignore") return true;
  return TEXT_EXT.has(path.extname(filePath).toLowerCase());
}

function listFiles(rootDir) {
  const base = path.resolve(rootDir);
  const results = [];

  function walk(dir, depth) {
    if (depth > 5 || results.length >= 500) return;

    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      const rel = path.relative(base, full).replace(/\\/g, "/");

      if (item.isDirectory()) {
        if (!IGNORE_DIRS.has(item.name)) walk(full, depth + 1);
        continue;
      }

      if (safeTextFile(full)) {
        const st = fs.statSync(full);
        results.push({ rel, size: st.size });
      }
    }
  }

  walk(base, 0);
  return results;
}

ipcMain.handle("select-folder", async () => {
  const r = await dialog.showOpenDialog(win, {
    properties: ["openDirectory"],
    title: "Chọn thư mục thao tác"
  });

  if (r.canceled || !r.filePaths[0]) return "";
  return r.filePaths[0];
});

ipcMain.handle("list-files", async (_event, folder) => {
  if (!folder || !fs.existsSync(folder)) {
    throw new Error("Folder không tồn tại.");
  }
  return listFiles(folder);
});

ipcMain.handle("read-file", async (_event, payload) => {
  const folder = payload.folder;
  const rel = payload.rel;

  if (!folder || !rel) throw new Error("Thiếu folder hoặc file.");
  const base = path.resolve(folder);
  const full = path.resolve(base, rel);

  if (!full.startsWith(base)) throw new Error("File nằm ngoài workspace.");
  if (!safeTextFile(full)) throw new Error("File không đọc được hoặc quá lớn.");

  return fs.readFileSync(full, "utf8");
});

ipcMain.handle("run-cmd", async (_event, payload) => {
  return new Promise((resolve) => {
    const cwd = payload.cwd && fs.existsSync(payload.cwd)
      ? payload.cwd
      : process.cwd();

    const command = String(payload.command || "").trim();

    if (!command) {
      resolve({
        ok: false,
        cwd,
        command,
        stdout: "",
        stderr: "Chưa nhập lệnh CMD.",
        exitCode: 1
      });
      return;
    }

    if (runningChild) {
      resolve({
        ok: false,
        cwd,
        command,
        stdout: "",
        stderr: "Đang có lệnh khác chạy. Bấm STOP trước.",
        exitCode: 1
      });
      return;
    }

    let stdout = "";
    let stderr = "";

    runningChild = spawn("cmd.exe", ["/d", "/s", "/c", command], {
      cwd,
      windowsHide: true
    });

    const timer = setTimeout(() => {
      if (runningChild) {
        stderr += "\nTIMEOUT: quá 60 giây, đã dừng lệnh.";
        runningChild.kill();
      }
    }, 60000);

    runningChild.stdout.on("data", (d) => {
      const text = d.toString("utf8");
      stdout += text;
      if (win) win.webContents.send("cmd-output", { type: "stdout", text });
    });

    runningChild.stderr.on("data", (d) => {
      const text = d.toString("utf8");
      stderr += text;
      if (win) win.webContents.send("cmd-output", { type: "stderr", text });
    });

    runningChild.on("close", (code) => {
      clearTimeout(timer);
      const result = {
        ok: code === 0,
        cwd,
        command,
        stdout,
        stderr,
        exitCode: code
      };
      runningChild = null;
      resolve(result);
    });
  });
});

ipcMain.handle("stop-cmd", async () => {
  if (runningChild) {
    runningChild.kill();
    runningChild = null;
    return true;
  }
  return false;
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
