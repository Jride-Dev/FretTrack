param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$BackupRoot = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..')).Path 'backups'),
  [string]$DockerVolumeName = 'supabase_db_FretTrack',
  [int]$RetentionDays = 30,
  [switch]$SkipDockerVolumeBackup
)

$ErrorActionPreference = 'Stop'

function Write-Step {
  param([string]$Message)
  Write-Host "==> $Message"
}

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

function Invoke-Checked {
  param(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$WorkingDirectory = $ProjectRoot
  )

  Write-Host "+ $FilePath $($Arguments -join ' ')"
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
  }
}

function Get-RelativePathSafe {
  param([string]$BasePath, [string]$TargetPath)
  $base = [System.IO.Path]::GetFullPath($BasePath)
  $target = [System.IO.Path]::GetFullPath($TargetPath)
  if (-not $base.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
    $base = $base + [System.IO.Path]::DirectorySeparatorChar
  }
  $baseUri = New-Object System.Uri($base)
  $targetUri = New-Object System.Uri($target)
  return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($targetUri).ToString()).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
}

function Get-PgDumpCopyCounts {
  param([string]$DumpPath)

  $counts = [ordered]@{}
  $currentTable = $null
  $currentCount = 0

  foreach ($line in [System.IO.File]::ReadLines($DumpPath)) {
    if ($line -match '^COPY\s+"([^"]+)"\."([^"]+)"\s') {
      if ($null -ne $currentTable) {
        $counts[$currentTable] = $currentCount
      }
      $currentTable = "$($Matches[1]).$($Matches[2])"
      $currentCount = 0
      continue
    }

    if ($null -ne $currentTable) {
      if ($line -eq '\.') {
        $counts[$currentTable] = $currentCount
        $currentTable = $null
        $currentCount = 0
      } else {
        $currentCount += 1
      }
    }
  }

  if ($null -ne $currentTable) {
    $counts[$currentTable] = $currentCount
  }

  return $counts
}

function Write-Manifest {
  param(
    [string]$SnapshotDir,
    [string]$ProjectRoot
  )

  $files = Get-ChildItem -LiteralPath $SnapshotDir -File -Recurse |
    Where-Object { $_.Name -ne 'manifest.json' -and $_.Name -ne 'compare-report.md' } |
    Sort-Object FullName

  $hashes = foreach ($file in $files) {
    $hash = Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256
    [pscustomobject]@{
      path = Get-RelativePathSafe -BasePath $SnapshotDir -TargetPath $file.FullName
      bytes = $file.Length
      sha256 = $hash.Hash.ToLowerInvariant()
    }
  }

  $copyCounts = Get-PgDumpCopyCounts -DumpPath (Join-Path $SnapshotDir 'data.sql')
  $migrationVersions = @()
  $migrationData = Join-Path $SnapshotDir 'migration_history_data.sql'
  if (Test-Path -LiteralPath $migrationData) {
    foreach ($line in [System.IO.File]::ReadLines($migrationData)) {
      if ($line -match '^(\d{14})\s') {
        $migrationVersions += $Matches[1]
      }
    }
  }

  $copyRowCounts = @(
    $copyCounts.GetEnumerator() |
      Sort-Object Name |
      ForEach-Object {
        [pscustomobject]@{
          table = $_.Key
          rows = $_.Value
        }
      }
  )

  $manifest = [ordered]@{
    created_at = (Get-Date).ToUniversalTime().ToString('o')
    project_root = $ProjectRoot
    snapshot_dir = $SnapshotDir
    supabase_cli_version = (& supabase --version)
    docker_volume_name = $DockerVolumeName
    files = $hashes
    copy_row_counts = $copyRowCounts
    migration_versions = $migrationVersions
  }

  $manifestPath = Join-Path $SnapshotDir 'manifest.json'
  $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

  $checksumsPath = Join-Path $SnapshotDir 'checksums.sha256'
  $hashes |
    ForEach-Object { "$($_.sha256)  $($_.path)" } |
    Set-Content -LiteralPath $checksumsPath -Encoding UTF8

  $rowCountsPath = Join-Path $SnapshotDir 'row-counts.txt'
  $copyCounts.GetEnumerator() |
    Sort-Object Name |
    ForEach-Object { "$($_.Key) $($_.Value)" } |
    Set-Content -LiteralPath $rowCountsPath -Encoding UTF8

  $migrationVersionsPath = Join-Path $SnapshotDir 'migration-versions.txt'
  $migrationVersions | Set-Content -LiteralPath $migrationVersionsPath -Encoding UTF8

  return $manifest
}

function Convert-RowCountsToMap {
  param([object]$RowCounts)

  $map = @{}
  if ($null -eq $RowCounts) {
    return $map
  }

  if ($RowCounts -is [System.Collections.IDictionary]) {
    foreach ($entry in $RowCounts.GetEnumerator()) {
      $map[[string]$entry.Key] = [int]$entry.Value
    }
    return $map
  }

  $items = @($RowCounts)
  if ($items.Count -gt 0 -and $items[0].PSObject.Properties['table'] -and $items[0].PSObject.Properties['rows']) {
    foreach ($item in $items) {
      $map[[string]$item.table] = [int]$item.rows
    }
    return $map
  }

  $RowCounts.PSObject.Properties |
    Where-Object { $_.Name -notin @('Keys', 'Values', 'IsReadOnly', 'IsFixedSize', 'SyncRoot', 'Count', 'IsSynchronized') } |
    ForEach-Object {
      if ($_.Value -isnot [System.Collections.IEnumerable] -or $_.Value -is [string]) {
        $map[$_.Name] = [int]$_.Value
      }
    }

  return $map
}

function Write-CompareReport {
  param(
    [string]$SnapshotDir,
    [object]$CurrentManifest,
    [object]$PreviousManifest
  )

  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add('# FretTrack Supabase Backup Compare Report')
  $lines.Add('')
  $lines.Add(('- Current snapshot: `{0}`' -f $SnapshotDir))
  $lines.Add(('- Created at: `{0}`' -f $CurrentManifest.created_at))
  $lines.Add('')

  if ($null -eq $PreviousManifest) {
    $lines.Add('No previous manifest was found. This snapshot becomes the comparison baseline.')
  } else {
    $lines.Add(('- Previous snapshot: `{0}`' -f $PreviousManifest.snapshot_dir))
    $lines.Add('')

    $currentSchema = ($CurrentManifest.files | Where-Object { $_.path -eq 'schema.sql' } | Select-Object -First 1).sha256
    $previousSchema = ($PreviousManifest.files | Where-Object { $_.path -eq 'schema.sql' } | Select-Object -First 1).sha256
    $schemaChanged = $currentSchema -ne $previousSchema

    $currentMigrations = @($CurrentManifest.migration_versions)
    $previousMigrations = @($PreviousManifest.migration_versions)
    $addedMigrations = $currentMigrations | Where-Object { $_ -notin $previousMigrations }
    $removedMigrations = $previousMigrations | Where-Object { $_ -notin $currentMigrations }

    $lines.Add('## Schema')
    $lines.Add(('- Schema hash changed: `{0}`' -f $schemaChanged))
    $lines.Add('')
    $lines.Add('## Migration History')
    $addedText = if ($addedMigrations.Count) { $addedMigrations -join ', ' } else { 'none' }
    $removedText = if ($removedMigrations.Count) { $removedMigrations -join ', ' } else { 'none' }
    $lines.Add(('- Added versions: {0}' -f $addedText))
    $lines.Add(('- Removed versions: {0}' -f $removedText))
    $lines.Add('')
    $lines.Add('## Row Count Changes')

    $currentCounts = Convert-RowCountsToMap -RowCounts $CurrentManifest.copy_row_counts
    $previousCounts = Convert-RowCountsToMap -RowCounts $PreviousManifest.copy_row_counts
    $allTables = @($currentCounts.Keys + $previousCounts.Keys) | Sort-Object -Unique

    foreach ($table in $allTables) {
      $current = if ($currentCounts.ContainsKey($table)) { $currentCounts[$table] } else { 0 }
      $previous = if ($previousCounts.ContainsKey($table)) { $previousCounts[$table] } else { 0 }
      $delta = $current - $previous
      if ($delta -ne 0) {
        $lines.Add(('- `{0}`: {1} -> {2} ({3})' -f $table, $previous, $current, ('{0:+#;-#;0}' -f $delta)))
      }
    }

    if ($lines[$lines.Count - 1] -eq '## Row Count Changes') {
      $lines.Add('- No row-count changes detected in dumped tables.')
    }
  }

  $lines.Add('')
  $lines.Add('Generated by `scripts/backup-hosted-supabase.ps1`.')
  $lines | Set-Content -LiteralPath (Join-Path $SnapshotDir 'compare-report.md') -Encoding UTF8
}

function Backup-DockerVolume {
  param(
    [string]$VolumeName,
    [string]$DestinationRoot,
    [string]$Stamp
  )

  Require-Command docker

  $volumeExists = (& docker volume ls --format '{{.Name}}') -contains $VolumeName
  if (-not $volumeExists) {
    throw "Docker volume not found: $VolumeName"
  }

  $volumeBackupDir = Join-Path $DestinationRoot "docker-volume-$Stamp"
  New-Item -ItemType Directory -Path $volumeBackupDir -Force | Out-Null
  $archiveName = "$VolumeName.tar.gz"

  Write-Step "Backing up Docker volume $VolumeName"
  Invoke-Checked -FilePath docker -Arguments @(
    'run',
    '--rm',
    '-v', "${VolumeName}:/volume:ro",
    '-v', "${volumeBackupDir}:/backup",
    'alpine:3.20',
    'sh',
    '-c',
    "cd /volume && tar -czf /backup/$archiveName ."
  )

  return Join-Path $volumeBackupDir $archiveName
}

function Apply-Retention {
  param(
    [string]$Root,
    [int]$Days
  )

  if ($Days -le 0) {
    return
  }

  $cutoff = (Get-Date).AddDays(-$Days)
  Get-ChildItem -LiteralPath $Root -Directory -ErrorAction SilentlyContinue |
    Where-Object {
      ($_.Name -like 'hosted-supabase-*' -or $_.Name -like 'docker-volume-*') -and $_.LastWriteTime -lt $cutoff
    } |
    ForEach-Object {
      Write-Step "Removing expired backup folder $($_.FullName)"
      Remove-Item -LiteralPath $_.FullName -Recurse -Force
    }
}

Require-Command supabase

$ProjectRoot = (Resolve-Path $ProjectRoot).Path
if (-not (Test-Path -LiteralPath $BackupRoot)) {
  New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
}
$BackupRoot = (Resolve-Path $BackupRoot).Path

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$snapshotDir = Join-Path $BackupRoot "hosted-supabase-$stamp"
New-Item -ItemType Directory -Path $snapshotDir -Force | Out-Null
$repoSnapshotDir = Join-Path $snapshotDir 'supabase'
New-Item -ItemType Directory -Path $repoSnapshotDir -Force | Out-Null

$previousManifestPath = Get-ChildItem -LiteralPath $BackupRoot -Directory -Filter 'hosted-supabase-*' |
  Where-Object { $_.FullName -ne $snapshotDir -and (Test-Path -LiteralPath (Join-Path $_.FullName 'manifest.json')) } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1 |
  ForEach-Object { Join-Path $_.FullName 'manifest.json' }

$previousManifest = $null
if ($previousManifestPath) {
  $previousManifest = Get-Content -LiteralPath $previousManifestPath -Raw | ConvertFrom-Json
}

Push-Location $ProjectRoot
try {
  Write-Step "Creating hosted Supabase backup in $snapshotDir"
  Invoke-Checked -FilePath supabase -Arguments @('db', 'dump', '--linked', '--role-only', '--file', (Join-Path $snapshotDir 'roles.sql'))
  Invoke-Checked -FilePath supabase -Arguments @('db', 'dump', '--linked', '--schema', 'public,auth,storage', '--file', (Join-Path $snapshotDir 'schema.sql'))
  Invoke-Checked -FilePath supabase -Arguments @('db', 'dump', '--linked', '--data-only', '--schema', 'public,auth,storage', '--exclude', 'storage.buckets_vectors,storage.vector_indexes', '--use-copy', '--file', (Join-Path $snapshotDir 'data.sql'))
  Invoke-Checked -FilePath supabase -Arguments @('db', 'dump', '--linked', '--schema', 'supabase_migrations', '--file', (Join-Path $snapshotDir 'migration_history_schema.sql'))
  Invoke-Checked -FilePath supabase -Arguments @('db', 'dump', '--linked', '--data-only', '--schema', 'supabase_migrations', '--use-copy', '--file', (Join-Path $snapshotDir 'migration_history_data.sql'))

  Copy-Item -LiteralPath (Join-Path $ProjectRoot 'supabase\migrations') -Destination (Join-Path $repoSnapshotDir 'migrations') -Recurse -Force
  Copy-Item -LiteralPath (Join-Path $ProjectRoot 'supabase\functions') -Destination (Join-Path $repoSnapshotDir 'functions') -Recurse -Force

  $manifest = Write-Manifest -SnapshotDir $snapshotDir -ProjectRoot $ProjectRoot
  Write-CompareReport -SnapshotDir $snapshotDir -CurrentManifest $manifest -PreviousManifest $previousManifest

  if (-not $SkipDockerVolumeBackup) {
    $dockerArchive = Backup-DockerVolume -VolumeName $DockerVolumeName -DestinationRoot $BackupRoot -Stamp $stamp
    Write-Step "Docker volume backup written to $dockerArchive"
  }

  Apply-Retention -Root $BackupRoot -Days $RetentionDays

  Write-Step "Backup complete"
  Write-Host "Snapshot: $snapshotDir"
  Write-Host "Compare report: $(Join-Path $snapshotDir 'compare-report.md')"
} finally {
  Pop-Location
}
