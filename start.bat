@echo off
setlocal

set ROOT=%~dp0
set AI_DIR=%ROOT%services\ai
set VENV=%AI_DIR%\.venv\Scripts\activate.bat

echo ============================================
echo  TalentBank — Full Stack Startup
echo ============================================
echo.

REM ── 1. Python AI service ─────────────────────────────────────────────────────
if not exist "%AI_DIR%\.venv" (
  echo [AI] Creating Python venv...
  python -m venv "%AI_DIR%\.venv"
)

if not exist "%AI_DIR%\firebase-service-account.json" (
  echo [WARN] services\ai\firebase-service-account.json not found.
  echo        Download from Firebase Console ^> Project Settings ^> Service Accounts
  echo        Firestore reads will fail until this file is present.
  echo.
)

echo [AI] Starting FastAPI service on http://localhost:8000 ...
start "TalentBank — AI Service" cmd /k "cd /d "%AI_DIR%" && call .venv\Scripts\activate.bat && pip install -r requirements.txt -q && python main.py"

REM ── 2. Next.js web app ───────────────────────────────────────────────────────
echo [WEB] Starting Next.js on http://localhost:3000 ...
start "TalentBank — Web" cmd /k "cd /d "%ROOT%" && pnpm dev:web"

REM ── 3. Expo mobile app ───────────────────────────────────────────────────────
echo [MOBILE] Starting Expo dev server ...
start "TalentBank — Mobile" cmd /k "cd /d "%ROOT%" && pnpm dev:mobile"

echo.
echo All three services launched in separate windows.
echo.
echo   Web admin  →  http://localhost:3000
echo   AI service →  http://localhost:8000
echo   AI health  →  http://localhost:8000/health
echo   Mobile     →  scan QR code in the Expo window
echo.
echo Press any key to close this launcher window.
pause > nul
