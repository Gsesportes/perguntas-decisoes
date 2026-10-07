@echo off
setlocal
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 ou superior nao foi encontrado.
  echo Instale pelo site oficial: https://nodejs.org/en/download
  echo Depois execute este arquivo novamente.
  pause
  exit /b 1
)
node "%~dp0scripts\instalar-desktop.mjs" %*
if errorlevel 1 (
  echo.
  echo A instalacao nao foi concluida. Confira a mensagem acima.
  pause
  exit /b 1
)
echo.
echo Pronto. Selecione Perguntas e decisoes no menu @ do Codex.
pause
