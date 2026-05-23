# SchemaForge AI - Start both servers
Write-Host "Starting SchemaForge AI..." -ForegroundColor Cyan

$backendDir = Join-Path $PSScriptRoot "backend"
$frontendDir = Join-Path $PSScriptRoot "frontend"

$backendCommand = "Set-Location '$backendDir'; .\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8001"
$frontendCommand = "Set-Location '$frontendDir'; npm.cmd run dev -- --port 3001"

$backend = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile", "-NoExit", "-Command", $backendCommand -PassThru
Write-Host "Backend started (PID $($backend.Id)) -> http://localhost:8001" -ForegroundColor Green

$frontend = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile", "-NoExit", "-Command", $frontendCommand -PassThru
Write-Host "Frontend started (PID $($frontend.Id)) -> http://localhost:3001" -ForegroundColor Green

Write-Host ""
Write-Host "Open http://localhost:3001/workspace" -ForegroundColor Cyan
