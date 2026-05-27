const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn, execFileSync } = require("child_process");

const PORT = 8787;
const PUBLIC_DIR = path.join(__dirname, "public");

function json(res, status, data) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(data, null, 2));
}

function html(res, file) {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(fs.readFileSync(file, "utf8"));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error("JSON lỗi")); }
    });
    req.on("error", reject);
  });
}

function pickFolder() {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$dlg = New-Object System.Windows.Forms.FolderBrowserDialog
$dlg.Description = "Chọn thư mục thao tác"
$dlg.ShowNewFolderButton = $false
if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::Write($dlg.SelectedPath)
}
`;
  return execFileSync("powershell.exe", ["-NoProfile", "-STA", "-Command", script], {
    encoding: "utf8",
    timeout: 120000,
    windowsHide: false
  }).trim();
}

function runCmd({ cwd, command }) {
  return new Promise((resolve) => {
    const workdir = cwd && fs.existsSync(cwd) ? cwd : __dirname;

    if (!command || !String(command).trim()) {
      return resolve({ ok: false, cwd: workdir, command, stdout: "", stderr: "Chưa nhập lệnh CMD.", exitCode: 1 });
    }

    const child = spawn("cmd.exe", ["/d", "/s", "/c", String(command)], {
      cwd: workdir,
      windowsHide: true,
      shell: false
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill();
      stderr += "\nTIMEOUT: Lệnh chạy quá 60 giây, đã dừng.";
    }, 60000);

    child.stdout.on("data", d => stdout += d.toString("utf8"));
    child.stderr.on("data", d => stderr += d.toString("utf8"));

    child.on("close", code => {
      clearTimeout(timer);
      resolve({ ok: code === 0, cwd: workdir, command, stdout, stderr, exitCode: code });
    });
  });
}

async function callClaude(payload) {
  const baseUrl = String(payload.baseUrl || "https://unlimited.aiprimetech.io").replace(/\/+$/, "");
  const token = String(payload.token || "").trim();
  const model = String(payload.model || "claude-haiku-4-5-20251001").trim();
  const prompt = String(payload.prompt || "").trim();

  if (!token) throw new Error("Thiếu token");
  if (!prompt) throw new Error("Thiếu prompt");

  const body = {
    model,
    max_tokens: Number(payload.maxTokens || 800),
    messages: [{ role: "user", content: prompt }]
  };

  const r = await fetch(baseUrl + "/v1/messages", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || data?.message || "Claude API lỗi");

  const text = Array.isArray(data.content)
    ? data.content.filter(x => x.type === "text").map(x => x.text).join("\n")
    : "";

  return {
    ok: true,
    model: data.model,
    reply: text,
    usage: data.usage || {}
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      return html(res, path.join(PUBLIC_DIR, "index.html"));
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      return json(res, 200, { ok: true, app: "cmd-visible-panel", port: PORT });
    }

    if (req.method === "POST" && url.pathname === "/api/pick-folder") {
      const folder = pickFolder();
      return json(res, 200, { ok: true, folder });
    }

    if (req.method === "POST" && url.pathname === "/api/cmd") {
      const body = await readBody(req);
      const result = await runCmd(body);
      return json(res, 200, result);
    }

    if (req.method === "POST" && url.pathname === "/api/chat") {
      const body = await readBody(req);
      const result = await callClaude(body);
      return json(res, 200, result);
    }

    return json(res, 404, { ok: false, error: "Not found" });
  } catch (e) {
    return json(res, 500, { ok: false, error: e.message || String(e) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("CMD Visible Panel:");
  console.log("http://127.0.0.1:" + PORT);
});
