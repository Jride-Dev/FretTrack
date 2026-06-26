param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$TaskName = 'FretTrack Daily Supabase Backup',
  [datetime]$At = (Get-Date '02:00'),
  [string]$UserId = "$env:USERDOMAIN\$env:USERNAME"
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path $ProjectRoot).Path
$backupScript = Join-Path $ProjectRoot 'scripts\backup-hosted-supabase.ps1'
if (-not (Test-Path -LiteralPath $backupScript)) {
  throw "Backup script not found: $backupScript"
}

$powershellPath = Join-Path $PSHOME 'powershell.exe'
$action = New-ScheduledTaskAction `
  -Execute $powershellPath `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$backupScript`"" `
  -WorkingDirectory $ProjectRoot

$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet `
  -MultipleInstances IgnoreNew `
  -StartWhenAvailable `
  -RunOnlyIfNetworkAvailable `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 10) `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
  -WakeToRun

$description = 'Daily FretTrack hosted Supabase database, storage, migration, function, and local Docker volume backup.'
$principal = New-ScheduledTaskPrincipal `
  -UserId $UserId `
  -LogonType Interactive `
  -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description $description `
  -Force | Out-Null

$task = Get-ScheduledTask -TaskName $TaskName
$info = $task | Get-ScheduledTaskInfo

[pscustomobject]@{
  TaskName = $task.TaskName
  State = $task.State
  UserId = $task.Principal.UserId
  RunLevel = $task.Principal.RunLevel
  LogonType = $task.Principal.LogonType
  NextRunTime = $info.NextRunTime
  Action = ($task.Actions | ForEach-Object { "$($_.Execute) $($_.Arguments)" }) -join '; '
  WorkingDirectory = ($task.Actions | Select-Object -First 1).WorkingDirectory
} | Format-List
