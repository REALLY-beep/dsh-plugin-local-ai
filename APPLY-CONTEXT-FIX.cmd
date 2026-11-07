@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Apply-DSH-LocalAI-ContextPatch.ps1"
if errorlevel 1 (
  echo.
  echo Context patch failed. No broken configuration was kept; check the error above.
  pause
  exit /b 1
)
echo.
echo Context patch applied and verified. Restart DeepSeek Harness Desktop.
pause
