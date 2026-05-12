$ErrorActionPreference = 'Stop'

$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcherPath = Join-Path $appDir 'Start FretTrack.cmd'
$iconPath = Join-Path $appDir 'FretTrack.ico'
$desktopPaths = @(
  [Environment]::GetFolderPath('Desktop'),
  (Join-Path $env:USERPROFILE 'OneDrive\Desktop'),
  (Join-Path $env:USERPROFILE 'Desktop')
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -Unique

if (-not (Test-Path -LiteralPath $launcherPath)) {
  throw "Cannot find launcher: $launcherPath"
}
if (-not (Test-Path -LiteralPath $iconPath)) {
  throw "Cannot find icon: $iconPath"
}

$shell = New-Object -ComObject WScript.Shell

foreach ($desktopPath in $desktopPaths) {
  $shortcutPath = Join-Path $desktopPath 'FretTrack.lnk'

  if (Test-Path -LiteralPath $shortcutPath) {
    Remove-Item -LiteralPath $shortcutPath -Force
  }

  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $launcherPath
  $shortcut.WorkingDirectory = $appDir
  $shortcut.IconLocation = "$iconPath,0"
  $shortcut.Description = 'Start FretTrack'
  $shortcut.Save()

  Write-Host "Desktop shortcut created:"
  Write-Host $shortcutPath
}
