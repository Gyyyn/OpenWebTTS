@echo off
echo ====================================
echo  OpenWebTTS - Clear Cache Helper
echo ====================================
echo.
echo This script will help you see the latest changes.
echo.
echo Step 1: Stopping any running Python servers...
taskkill /F /IM python.exe /T 2>nul
timeout /t 2 /nobreak >nul
echo.
echo Step 2: Starting OpenWebTTS...
echo.
echo Opening browser in 3 seconds...
echo.
echo IMPORTANT: When browser opens, press Ctrl+Shift+R to hard refresh!
echo.
timeout /t 3 /nobreak
start http://localhost:5000
python app.py
