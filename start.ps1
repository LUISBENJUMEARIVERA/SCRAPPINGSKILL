# Script de inicio rápido para SECOP II Hybrid Scraper & RAG API
Write-Host "Iniciando Backend FastAPI (Puerto 8010) y Frontend React Swiss UI (Puerto 5173)..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; C:\Users\luisa\AppData\Local\Microsoft\WindowsApps\PythonSoftwareFoundation.Python.3.11_qbz5n2kfra8p0\python.exe -m uvicorn app.main:app --reload --port 8010"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"
