const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

let win = null;
let runningChild = null;
let modelTerminal = null; // child process or pty
let modelTerminalIsPty = false;
let modelTerminalFallback = false;

const IGNORE_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", ".vite", ".cache", "coverage"]);
const TEXT_EXT = new Set([".txt",".md",".json",".js",".jsx",".ts",".tsx",".css",".html",".mjs",".cjs",".py",".ps1",".cmd",".bat",".yml",".yaml"]);
const DEFAULT_CLAUDE_API_URL = "https://api.anthropic.com";

function createWindow() {
  win = new BrowserWindow({
    width: 1450,
    height: 900,
    minWidth: 1150,
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

  const name = path.basename(filePath).toLowerCase();
  if (name === ".env" || name.endsWith(".env")) return false;
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
  if (!folder || !fs.existsSync(folder)) throw new Error("Folder không tồn tại.");
  return listFiles(folder);
});

ipcMain.handle("read-file", async (_event, payload) => {
  const folder = payload.folder;
  const rel = payload.rel;
  if (!folder || !rel) throw new Error("Thiếu folder hoặc file.");

  const base = path.resolve(folder);
  const full = path.resolve(base, rel);

  if (!full.startsWith(base)) throw new Error("File nằm ngoài workspace.");
  if (!safeTextFile(full)) throw new Error("File không đọc được, là .env, hoặc quá lớn.");

  return fs.readFileSync(full, "utf8");
});

ipcMain.handle("run-cmd", async (_event, payload) => {
  return new Promise((resolve) => {
    const cwd = payload.cwd && fs.existsSync(payload.cwd) ? payload.cwd : process.cwd();
    const command = String(payload.command || "").trim();

    if (!command) {
      resolve({ ok: false, cwd, command, stdout: "", stderr: "Chưa nhập lệnh CMD.", exitCode: 1 });
      return;
    }

    if (runningChild) {
      resolve({ ok: false, cwd, command, stdout: "", stderr: "Đang có lệnh khác chạy. Bấm STOP trước.", exitCode: 1 });
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
      const result = { ok: code === 0, cwd, command, stdout, stderr, exitCode: code };
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

function normalizeModels(data) {
  const arr =
    Array.isArray(data?.data) ? data.data :
    Array.isArray(data?.models) ? data.models :
    Array.isArray(data) ? data :
    [];

  const ids = arr
    .map(x => typeof x === "string" ? x : x?.id)
    .filter(Boolean);

  return [...new Set(ids)];
}

async function fetchJson(url, options) {
  if (typeof fetch !== "function") throw new Error("Fetch không có trong Electron main process.");
  const r = await fetch(url, options);
  const text = await r.text();

  let data;
  try { data = JSON.parse(text); }
  catch { data = { raw: text }; }

  if (!r.ok) {
    throw new Error(data?.error?.message || data?.message || data?.raw || ("HTTP " + r.status));
  }

  return data;
}

ipcMain.handle("ai-load-models", async (_event, payload) => {
  const baseUrl = String(payload.baseUrl || DEFAULT_CLAUDE_API_URL).replace(/\/+$|\s+$/g, "");
  const token = String(payload.token || "").trim();

  if (!baseUrl.startsWith("https://")) throw new Error("Base URL phải bắt đầu bằng https://");
  if (!token) throw new Error("Thiếu token.");

  const data = await fetchJson(baseUrl + "/v1/models", {
    method: "GET",
    headers: {
      "Authorization": "Bearer " + token,
      "anthropic-version": "2023-06-01"
    }
  });

  const models = normalizeModels(data);
  return {
    ok: true,
    models
  };
});

ipcMain.handle("ai-chat", async (_event, payload) => {
  const baseUrl = String(payload.baseUrl || DEFAULT_CLAUDE_API_URL).replace(/\/+$|\s+$/g, "");
  const token = String(payload.token || "").trim();
  const model = String(payload.model || "claude-haiku-4-5-20251001").trim();
  const prompt = String(payload.prompt || "").trim();
  const maxTokens = Math.max(20, Math.min(Number(payload.maxTokens || 800), 8000));

  if (!baseUrl.startsWith("https://")) throw new Error("Base URL phải bắt đầu bằng https://");
  if (!token) throw new Error("Thiếu token.");
  if (!prompt) throw new Error("Thiếu prompt.");

  let content = prompt;

  if (payload.includeSelectedFile && payload.selectedFileName && payload.selectedFileText) {
    content =
      "SELECTED FILE: " + payload.selectedFileName + "\n\n" +
      String(payload.selectedFileText).slice(0, 30000) +
      "\n\nTASK:\n" + prompt;
  }

  const messages = [];

  if (payload.systemInstruction) {
    messages.push({
      role: "system",
      content: String(payload.systemInstruction).slice(0, 12000)
    });
  }

  if (payload.includeHistory && Array.isArray(payload.history)) {
    for (const h of payload.history.slice(-12)) {
      if (h && (h.role === "user" || h.role === "assistant") && String(h.content || "").trim()) {
        messages.push({
          role: h.role,
          content: String(h.content).slice(0, 12000)
        });
      }
    }
  }

  messages.push({ role: "user", content });

  const data = await fetchJson(baseUrl + "/v1/messages", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages
    })
  });

  const reply = Array.isArray(data.content)
    ? data.content.filter(x => x.type === "text").map(x => x.text || "").join("\n").trim()
    : "";

  return {
    ok: true,
    id: data.id,
    model: data.model,
    reply,
    usage: data.usage || {},
    stop_reason: data.stop_reason
  };
});

ipcMain.handle("start-model-terminal", async (_event, payload) => {
  const baseUrl = String(payload.baseUrl || "").trim();
  const token = String(payload.token || "").trim();
  const model = String(payload.model || "").trim();
  const cwd = payload.cwd && typeof payload.cwd === 'string' && fs.existsSync(payload.cwd) ? payload.cwd : process.cwd();

  // prevent storing token on disk; token only used in env for child
  if (modelTerminal) return { ok: false, message: "Terminal already running." };

  // try to use node-pty if available
  let nodePty = null;
  try {
    nodePty = require('node-pty');
  } catch (e) {
    nodePty = null;
  }

  const env = Object.assign({}, process.env, {
    ANTHROPIC_BASE_URL: baseUrl || process.env.ANTHROPIC_BASE_URL || "",
    ANTHROPIC_AUTH_TOKEN: token || "",
    ANTHROPIC_MODEL: model || process.env.ANTHROPIC_MODEL || "",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_ATTRIBUTION_HEADER: '0'
  });

  if (nodePty) {
    try {
      modelTerminal = nodePty.spawn('claude', ['--model', model], {
        name: 'xterm-color',
        cols: 120,
        rows: 30,
        cwd,
        env
      });

      modelTerminalIsPty = true;
      modelTerminalFallback = false;

      modelTerminal.onData((d) => {
        if (win) win.webContents.send('model-terminal-data', { text: d });
      });

      modelTerminal.onExit(() => {
        if (win) win.webContents.send('model-terminal-data', { text: '\n[Model terminal exited]\n' });
        modelTerminal = null;
        modelTerminalIsPty = false;
      });

      return { ok: true, fallback: false };
    } catch (e) {
      // fallthrough to fallback
      modelTerminal = null;
      nodePty = null;
    }
  }

  // Fallback: open external cmd window with env set and run claude CLI there
  try {
    // Assemble command to set env vars then run claude
    const setCmdParts = [];
    if (baseUrl) setCmdParts.push(`set "ANTHROPIC_BASE_URL=${baseUrl}"`);
    if (token) setCmdParts.push(`set "ANTHROPIC_AUTH_TOKEN=${token}"`);
    if (model) setCmdParts.push(`set "ANTHROPIC_MODEL=${model}"`);
    setCmdParts.push('set CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1');
    setCmdParts.push('set CLAUDE_CODE_ATTRIBUTION_HEADER=0');
    const runCmd = setCmdParts.join(' & ') + ` & claude --model ${model}`;

    // Use start to create external window; do not attach pipes
    modelTerminal = spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', runCmd], {
      cwd,
      detached: true,
      windowsHide: false
    });

    modelTerminalFallback = true;
    modelTerminalIsPty = false;

    // Inform renderer that we used external fallback
    if (win) win.webContents.send('model-terminal-fallback', { message: 'Embedded terminal unavailable, opened external CMD fallback.' });

    return { ok: true, fallback: true, message: 'external' };
  } catch (e) {
    modelTerminal = null;
    return { ok: false, message: String(e) };
  }
});

ipcMain.handle('write-model-terminal', async (_event, text) => {
  if (!modelTerminal) return { ok: false, message: 'No terminal' };
  try {
    if (modelTerminalIsPty && typeof modelTerminal.write === 'function') {
      modelTerminal.write(text);
    } else {
      // Cannot write to external fallback
      return { ok: false, message: 'External fallback: cannot write programmatically.' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
});

ipcMain.handle('resize-model-terminal', async (_event, payload) => {
  if (modelTerminalIsPty && modelTerminal && typeof modelTerminal.resize === 'function') {
    try {
      modelTerminal.resize(Number(payload.cols) || 80, Number(payload.rows) || 24);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: String(e) };
    }
  }
  return { ok: false, message: 'No pty terminal' };
});

ipcMain.handle('stop-model-terminal', async () => {
  if (!modelTerminal) return { ok: true, message: 'No terminal' };
  try {
    if (modelTerminalIsPty && typeof modelTerminal.kill === 'function') {
      modelTerminal.kill();
    } else if (modelTerminalFallback && modelTerminal && typeof modelTerminal.kill === 'function') {
      try { modelTerminal.kill(); } catch (e) {}
    }
    modelTerminal = null;
    modelTerminalIsPty = false;
    modelTerminalFallback = false;
    return { ok: true };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
});

ipcMain.handle('clear-model-terminal', async () => {
  if (modelTerminalIsPty && modelTerminal) {
    try {
      if (win) win.webContents.send('model-terminal-data', { text: '\x1b[2J\x1b[H' });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: String(e) };
    }
  }
  return { ok: false, message: 'No embedded terminal' };
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
