$ErrorActionPreference = 'Stop'

$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcherPath = Join-Path $appDir 'Start FretTrack.cmd'
$iconPath = Join-Path $appDir 'FretTrack.ico'
$desktopPath = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopPath 'FretTrack.lnk'

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
$shortcut.Description = 'Start FretTrack'
$shortcut.Save()

Write-Host "Desktop shortcut created:"
Write-Host $shortcutPath
