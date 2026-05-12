$ErrorActionPreference = 'Stop'

$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appUrl = 'http://127.0.0.1:5173/'
$port = 5173

Write-Host 'FretTrack'
Write-Host
Write-Host "App folder: $appDir"
Write-Host "App URL:    $appUrl"
Write-Host

if (-not (Test-Path -LiteralPath (Join-Path $appDir 'package.json'))) {
  throw "Cannot find package.json in $appDir. Put this launcher back in the FretTrack folder."
}

$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCommand) {
  $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
}
if (-not $npmCommand) {
  throw 'Cannot find npm. Install Node.js, then try the launcher again.'
}

$server = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if (-not $server) {
  $devCommand = 'cd /d "' + $appDir + '" && "' + $npmCommand.Source + '" run dev'
  Start-Process -FilePath 'cmd.exe' -ArgumentList @('/k', $devCommand) -WorkingDirectory $appDir

  for ($i = 0; $i -lt 30; $i++) {
    try {
      Invoke-WebRequest -UseBasicParsing $appUrl -TimeoutSec 1 | Out-Null
      break
    } catch {
      Start-Sleep -Seconds 1
    }
  }
}

Start-Process $appUrl
