const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawnSync, exec } = require("child_process");

const PORT = Number(process.env.PORT || 8787);
const PUBLIC_DIR = path.join(__dirname, "public");

const IGNORE_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", ".vite", ".cache", "coverage"]);
const ALLOWED_EXT = new Set([
  ".txt", ".md", ".json", ".js", ".jsx", ".ts", ".tsx", ".css", ".html",
  ".mjs", ".cjs", ".py", ".ps1", ".cmd", ".bat", ".yml", ".yaml",
  ".env.example", ".gitignore"
]);

function send(res, status, body, type = "application/json") {
  res.writeHead(status, {
    "Content-Type": type + "; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(type === "application/json" ? JSON.stringify(body, null, 2) : body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (data.length > 3_000_000) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

function mime(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".html") return "text/html";
  if (ext === ".js") return "text/javascript";
  if (ext === ".css") return "text/css";
  if (ext === ".json") return "application/json";
  return "text/plain";
}

function safeJoin(root, rel) {
  const full = path.resolve(root, rel || "");
  const base = path.resolve(root);
  if (!full.startsWith(base)) throw new Error("Path outside workspace");
  return full;
}

function isAllowedFile(name) {
  if (name === ".gitignore") return true;
  if (name.endsWith(".env.example")) return true;
  return ALLOWED_EXT.has(path.extname(name).toLowerCase());
}

function listFiles(root, maxFiles = 300, maxDepth = 5) {
  const base = path.resolve(root);
  if (!fs.existsSync(base)) throw new Error("Folder không tồn tại");
  if (!fs.statSync(base).isDirectory()) throw new Error("Đường dẫn không phải folder");

  const out = [];
  function walk(dir, depth) {
    if (out.length >= maxFiles || depth > maxDepth) return;
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      if (out.length >= maxFiles) break;
      const full = path.join(dir, item.name);
      const rel = path.relative(base, full).replace(/\\/g, "/");

      if (item.isDirectory()) {
        if (!IGNORE_DIRS.has(item.name)) walk(full, depth + 1);
        continue;
      }

      if (!item.isFile()) continue;
      if (!isAllowedFile(item.name)) continue;

      const st = fs.statSync(full);
      if (st.size > 300_000) continue;

      out.push({
        rel,
        size: st.size
      });
    }
  }

  walk(base, 0);
  return out;
}

function readWorkspaceFiles(root, relFiles, maxChars) {
  const base = path.resolve(root || "");
  if (!base || !fs.existsSync(base)) return "";

  const files = Array.isArray(relFiles) ? relFiles.slice(0, 30) : [];
  let budget = Math.max(1000, Math.min(Number(maxChars || 30000), 120000));
  let parts = [];

  for (const rel of files) {
    if (budget <= 0) break;
    const full = safeJoin(base, rel);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue;

    const raw = fs.readFileSync(full, "utf8");
    const cut = raw.slice(0, budget);
    budget -= cut.length;

    parts.push(`--- FILE: ${rel}\n${cut}`);
  }

  if (!parts.length) return "";

  return [
    "WORKSPACE FILES SELECTED BY USER",
    "Chỉ dùng các file dưới đây làm ngữ cảnh. Không đoán ngoài nội dung này.",
    "",
    parts.join("\n\n")
  ].join("\n");
}

function pickFolder() {
  const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$null = [System.Windows.Forms.Application]::EnableVisualStyles()
$d = New-Object System.Windows.Forms.FolderBrowserDialog
$d.Description = 'Chọn thư mục thao tác cho Claude Proxy Panel'
$d.ShowNewFolderButton = $false
if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $d.SelectedPath
}
`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psScript], {
    encoding: "utf8",
    timeout: 60000,
    windowsHide: false,
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Dialog cancelled or failed");
  return (result.stdout || "").trim();
}

function validateCwd(cwd) {
  if (!cwd || typeof cwd !== "string") {
    throw new Error("Thiếu thư mục làm việc (cwd)");
  }
  
  const resolved = path.resolve(cwd);
  if (!fs.existsSync(resolved)) {
    throw new Error("Thư mục không tồn tại: " + cwd);
  }
  if (!fs.statSync(resolved).isDirectory()) {
    throw new Error("Đường dẫn không phải thư mục: " + cwd);
  }
  
  return resolved;
}

function runTerminalCommand(cwd, command) {
  return new Promise((resolve) => {
    exec(command, {
      cwd: cwd,
      timeout: 60000,
      maxBuffer: 1024 * 1024,
      shell: "cmd.exe"
    }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: stdout || "",
        stderr: stderr || "",
        exitCode: error ? error.code : 0,
        command: command,
        cwd: cwd
      });
    });
  });
}

function extractText(content) {
  if (!Array.isArray(content)) return "";
  return content
    .filter(part => part && part.type === "text")
    .map(part => part.text || "")
    .join("\n")
    .trim();
}

async function callClaude(payload) {
  const baseUrl = String(payload.baseUrl || "").replace(/\/+$/, "");
  const token = String(payload.token || "").trim();
  const model = String(payload.model || "claude-haiku-4-5-20251001").trim();
  const prompt = String(payload.prompt || "").trim();
  const maxTokens = Math.max(1, Math.min(Number(payload.maxTokens || 800), 8000));

  if (!baseUrl.startsWith("https://")) throw new Error("Base URL phải bắt đầu bằng https://");
  if (!token) throw new Error("Thiếu token");
  if (!prompt) throw new Error("Thiếu prompt");

  let finalPrompt = prompt;

  if (payload.workspace && payload.workspace.include) {
    const workspaceText = readWorkspaceFiles(
      payload.workspace.path,
      payload.workspace.files,
      payload.workspace.maxChars
    );

    if (workspaceText) {
      finalPrompt = `${workspaceText}\n\nTASK\n${prompt}`;
    }
  }

  let messages = [];
  if (payload.includeHistory && Array.isArray(payload.history)) {
    messages = payload.history
      .filter(x => x && (x.role === "user" || x.role === "assistant") && String(x.content || "").trim())
      .slice(-20)
      .map(x => ({ role: x.role, content: String(x.content).slice(0, 20000) }));
  }

  messages.push({ role: "user", content: finalPrompt });

  const body = {
    model,
    max_tokens: maxTokens,
    messages
  };

  const response = await fetch(baseUrl + "/v1/messages", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const rawText = await response.text();
  let data;
  try { data = JSON.parse(rawText); }
  catch { data = { raw: rawText }; }

  if (!response.ok) {
    const msg = data?.error?.message || data?.message || rawText || ("HTTP " + response.status);
    throw new Error(msg);
  }

  return {
    ok: true,
    id: data.id,
    model: data.model,
    reply: extractText(data.content),
    stop_reason: data.stop_reason,
    usage: data.usage || {},
    content_types: Array.isArray(data.content) ? data.content.map(x => x.type) : []
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");

    if (req.method === "GET" && url.pathname === "/api/health") {
      return send(res, 200, { ok: true, port: PORT, app: "claude-panel-v1" });
    }

    if (req.method === "POST" && url.pathname === "/api/workspace/pick") {
      try {
        const folder = pickFolder();
        return send(res, 200, { ok: true, folder });
      } catch (err) {
        return send(res, 500, { ok: false, error: "PowerShell dialog failed: " + (err.message || String(err)) });
      }
    }

    if (req.method === "POST" && url.pathname === "/api/workspace/list") {
      const payload = await readJson(req);
      const files = listFiles(payload.path, 300, 5);
      return send(res, 200, { ok: true, files });
    }

    if (req.method === "POST" && url.pathname === "/api/chat") {
      const payload = await readJson(req);
      const result = await callClaude(payload);
      return send(res, 200, result);
    }

    if (req.method === "POST" && url.pathname === "/api/terminal/run") {
      const payload = await readJson(req);
      const command = String(payload.command || "").trim();
      const cwd = String(payload.cwd || "").trim();
      
      if (!command) {
        return send(res, 400, { ok: false, error: "Thiếu command" });
      }
      
      try {
        const validatedCwd = validateCwd(cwd || __dirname);
        const result = await runTerminalCommand(validatedCwd, command);
        return send(res, 200, result);
      } catch (err) {
        return send(res, 400, { ok: false, error: err.message || String(err) });
      }
    }

    let filePath = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
    filePath = decodeURIComponent(filePath);
    const full = safeJoin(PUBLIC_DIR, filePath);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      return send(res, 200, fs.readFileSync(full), mime(full));
    }

    return send(res, 404, { ok: false, error: "Not found" });
  } catch (err) {
    return send(res, 500, { ok: false, error: err.message || String(err) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("Claude Proxy Panel V-1 running:");
  console.log("http://127.0.0.1:" + PORT);
});
