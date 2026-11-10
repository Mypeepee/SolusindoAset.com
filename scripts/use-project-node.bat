@echo off
REM PATH hanya berubah di sesi launcher, bukan instalasi Node global.
set "PROJECT_NODE_DIR="
if exist "%~dp0..\.runtime\node-path.txt" set /p PROJECT_NODE_DIR=<"%~dp0..\.runtime\node-path.txt"
if defined PROJECT_NODE_DIR if exist "%PROJECT_NODE_DIR%\node.exe" set "PATH=%PROJECT_NODE_DIR%;%PATH%"

node -e "const [major,minor]=process.versions.node.split('.').map(Number); if (major < 22 || (major === 22 && minor < 13)) { console.error('[GAGAL] Launcher memerlukan Node.js minimal 22.13. Versi aktif: '+process.versions.node); process.exit(1); } console.log('[INFO] Runtime Node.js '+process.versions.node);"
if errorlevel 1 (
    echo        Pasang Node.js yang sesuai atau isi .runtime\node-path.txt dengan direktori runtime.
    exit /b 1
)
exit /b 0
