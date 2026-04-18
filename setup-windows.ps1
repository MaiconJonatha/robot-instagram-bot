# Robot Instagram Bot - Windows Setup
# Run this in PowerShell (as Administrator):
#   iwr -useb https://raw.githubusercontent.com/MaiconJonatha/robot-instagram-bot/main/setup-windows.ps1 | iex

$ErrorActionPreference = 'Stop'
$BotDir = "$env:USERPROFILE\robot-instagram-bot"

Write-Host "==> Instalando Node.js (se necessario)..." -ForegroundColor Cyan
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
}
node --version

Write-Host "==> Instalando Git (se necessario)..." -ForegroundColor Cyan
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  winget install -e --id Git.Git --accept-source-agreements --accept-package-agreements
  $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
}
git --version

Write-Host "==> Clonando repositorio..." -ForegroundColor Cyan
if (Test-Path $BotDir) {
  Set-Location $BotDir
  git pull
} else {
  git clone https://github.com/MaiconJonatha/robot-instagram-bot $BotDir
  Set-Location $BotDir
}

Write-Host "==> Instalando dependencias npm..." -ForegroundColor Cyan
npm install

Write-Host "==> Instalando Playwright Chromium..." -ForegroundColor Cyan
npx playwright install chromium

Write-Host "==> Criando arquivo .env com credenciais..." -ForegroundColor Cyan
$envContent = @"
INSTAGRAM_USER=autouonouomioiuioiuis_neiwis
INSTAGRAM_PASS=RobotBot@2024!
"@
Set-Content -Path "$BotDir\.env" -Value $envContent -NoNewline
Write-Host "   .env criado em $BotDir\.env" -ForegroundColor Green
Write-Host "   IMPORTANTE: adicione GOOGLE_COOKIES='...' ao .env manualmente" -ForegroundColor Yellow

Write-Host "==> Criando wrapper de execucao..." -ForegroundColor Cyan
$runScript = @'
@echo off
cd /d "%USERPROFILE%\robot-instagram-bot"
for /f "usebackq tokens=1,* delims==" %%a in ("%USERPROFILE%\robot-instagram-bot\.env") do set "%%a=%%b"
node single-post.js >> "%USERPROFILE%\robot-instagram-bot\bot.log" 2>&1
'@
Set-Content -Path "$BotDir\run-bot.bat" -Value $runScript

Write-Host "==> Registrando tarefas agendadas (horarios de Londres)..." -ForegroundColor Cyan
$times = @('08:00','12:00','17:00','20:00')
foreach ($t in $times) {
  $taskName = "InstagramBot-$($t.Replace(':',''))"
  schtasks /Delete /TN $taskName /F 2>$null
  schtasks /Create /TN $taskName /TR "`"$BotDir\run-bot.bat`"" /SC DAILY /ST $t /F | Out-Null
  Write-Host "   $taskName agendada para $t diariamente" -ForegroundColor Green
}

Write-Host "`n==> SETUP COMPLETO!" -ForegroundColor Green
Write-Host ""
Write-Host "Proximo passo:" -ForegroundColor Yellow
Write-Host "  1. Abra o arquivo $BotDir\.env no Bloco de Notas" -ForegroundColor Yellow
Write-Host "  2. Adicione uma linha: GOOGLE_COOKIES=<cole aqui o JSON das cookies>" -ForegroundColor Yellow
Write-Host "  3. Salve o arquivo" -ForegroundColor Yellow
Write-Host ""
Write-Host "Teste manualmente: $BotDir\run-bot.bat" -ForegroundColor Cyan
Write-Host "Log: $BotDir\bot.log" -ForegroundColor Cyan
