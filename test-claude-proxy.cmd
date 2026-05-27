@echo off
setlocal EnableExtensions

echo === Claude Proxy Token Test ===
echo Base URL: https://unlimited.aiprimetech.io
echo Model: claude-haiku-4-5-20251001
echo Prompt: ping
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$baseUrl='https://unlimited.aiprimetech.io';" ^
  "$model='claude-haiku-4-5-20251001';" ^
  "$sec=Read-Host 'Paste ANTHROPIC_AUTH_TOKEN' -AsSecureString;" ^
  "$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec);" ^
  "try { $token=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) };" ^
  "if ([string]::IsNullOrWhiteSpace($token)) { throw 'Missing token' };" ^
  "$body=@{model=$model;max_tokens=20;messages=@(@{role='user';content='ping'})}|ConvertTo-Json -Depth 10;" ^
  "$headers=@{Authorization=('Bearer '+$token);'anthropic-version'='2023-06-01';'content-type'='application/json'};" ^
  "$r=Invoke-RestMethod -Uri ($baseUrl + '/v1/messages') -Method Post -Headers $headers -Body $body;" ^
  "$text=($r.content | Where-Object { $_.type -eq 'text' } | Select-Object -ExpandProperty text) -join '';" ^
  "Write-Host ''; Write-Host '=== RESULT ==='; Write-Host 'Model:' $r.model; Write-Host 'Reply:' $text; Write-Host ''; Write-Host '=== USAGE ==='; Write-Host 'Input tokens:' $r.usage.input_tokens; Write-Host 'Output tokens:' $r.usage.output_tokens; Write-Host 'Cache create:' $r.usage.cache_creation_input_tokens; Write-Host 'Cache read:' $r.usage.cache_read_input_tokens;"

echo.
pause
