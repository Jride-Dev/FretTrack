$ErrorActionPreference = 'Stop'

$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcherPath = Join-Path $appDir 'Start Guitar App.cmd'
$iconPath = Join-Path $appDir 'Guitar Check-in App.ico'
$shortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Guitar Check-in App.lnk'

if (-not (Test-Path -LiteralPath $launcherPath)) {
  throw "Cannot find launcher: $launcherPath"
}
if (-not (Test-Path -LiteralPath $iconPath)) {
  throw "Cannot find icon: $iconPath"
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcherPath
$shortcut.WorkingDirectory = $appDir
$shortcut.IconLocation = $iconPath
$shortcut.Description = 'Start the Guitar Check-in App'
$shortcut.Save()

Write-Host "Desktop shortcut created:"
Write-Host $shortcutPath
