$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8787
$url = "http://127.0.0.1:$port"

function Test-Panel {
  try {
    $r = Invoke-WebRequest "$url/api/health" -UseBasicParsing -TimeoutSec 1
    return $r.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Test-Panel)) {
  Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $root -WindowStyle Hidden
  Start-Sleep -Seconds 1
}

$edge = "$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe"
$chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"

if (Test-Path $edge) {
  Start-Process $edge "--app=$url"
} elseif (Test-Path $chrome) {
  Start-Process $chrome "--app=$url"
} else {
  Start-Process $url
}
