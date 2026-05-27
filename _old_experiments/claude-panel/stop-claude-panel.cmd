@echo off
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p=Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if($p){$p|%%{Stop-Process -Id $_ -Force}; Write-Host 'Da tat Claude Proxy Panel.'} else {Write-Host 'Panel khong chay.'}"
pause
