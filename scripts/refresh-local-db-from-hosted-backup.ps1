param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$BackupRoot = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..')).Path 'backups'),
  [string]$SnapshotDir,
  [string]$DockerVolumeName = 'supabase_db_FretTrack',
  [string]$StorageVolumeName = 'supabase_storage_FretTrack',
  [string]$DbContainerName = 'supabase_db_FretTrack',
  [switch]$SkipPreRefreshVolumeBackup,
  [switch]$ValidateSnapshotOnly
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

  Push-Location $WorkingDirectory
  try {
    Write-Host "+ $FilePath $($Arguments -join ' ')"
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
    }
  } finally {
    Pop-Location
  }
}

function Get-Sha256Hex {
  param([string]$Path)

  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
      $hashBytes = $sha256.ComputeHash($stream)
      return ([System.BitConverter]::ToString($hashBytes)).Replace('-', '').ToLowerInvariant()
    } finally {
      $sha256.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
}

function Get-NormalizedSnapshotPath {
  param([string]$Path)
  return ([string]$Path).Replace('\', '/').TrimStart('/')
}

function Assert-CompleteSnapshot {
  param([string]$SnapshotDir)

  $snapshotRoot = [System.IO.Path]::GetFullPath($SnapshotDir)
  $snapshotPrefix = $snapshotRoot.TrimEnd([char[]]@('\', '/')) + [System.IO.Path]::DirectorySeparatorChar
  $failedPath = Join-Path $snapshotRoot 'FAILED.txt'
  if (Test-Path -LiteralPath $failedPath) {
    throw "Snapshot is marked failed by FAILED.txt: $snapshotRoot"
  }

  foreach ($requiredPath in @('manifest.json', 'checksums.sha256', 'compare-report.md', 'data.sql', 'storage-buckets/bucket-list.txt')) {
    if (-not (Test-Path -LiteralPath (Join-Path $snapshotRoot $requiredPath) -PathType Leaf)) {
      throw "Snapshot is incomplete; required file is missing: $requiredPath"
    }
  }

  $manifestPath = Join-Path $snapshotRoot 'manifest.json'
  try {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  } catch {
    throw "Snapshot manifest is invalid JSON: $manifestPath"
  }

  $manifestFiles = @($manifest.files)
  if (-not $manifestFiles.Count) {
    throw "Snapshot manifest has no file inventory: $manifestPath"
  }

  $manifestPaths = @{}
  foreach ($entry in $manifestFiles) {
    $relativePath = Get-NormalizedSnapshotPath -Path $entry.path
    if (-not $relativePath -or [System.IO.Path]::IsPathRooted([string]$entry.path)) {
      throw "Snapshot manifest contains an invalid path: $($entry.path)"
    }

    $candidatePath = [System.IO.Path]::GetFullPath((Join-Path $snapshotRoot $relativePath))
    if (-not $candidatePath.StartsWith($snapshotPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Snapshot manifest path escapes the snapshot directory: $relativePath"
    }
    if (-not (Test-Path -LiteralPath $candidatePath -PathType Leaf)) {
      throw "Snapshot manifest file is missing: $relativePath"
    }

    $expectedHash = ([string]$entry.sha256).ToLowerInvariant()
    if ($expectedHash -notmatch '^[a-f0-9]{64}$') {
      throw "Snapshot manifest has an invalid SHA-256 value for: $relativePath"
    }
    if ([int64]$entry.bytes -ne (Get-Item -LiteralPath $candidatePath).Length) {
      throw "Snapshot manifest byte count does not match: $relativePath"
    }
    if ((Get-Sha256Hex -Path $candidatePath) -ne $expectedHash) {
      throw "Snapshot manifest checksum does not match: $relativePath"
    }

    $manifestPaths[$relativePath] = $true
  }

  foreach ($requiredManifestPath in @('data.sql', 'storage-buckets/bucket-list.txt')) {
    if (-not $manifestPaths.ContainsKey($requiredManifestPath)) {
      throw "Snapshot manifest is missing required inventory entry: $requiredManifestPath"
    }
  }

  $storageBackupDir = Join-Path $snapshotRoot 'storage-buckets'
  $bucketListPath = Join-Path $storageBackupDir 'bucket-list.txt'
  $bucketNames = @(Get-Content -LiteralPath $bucketListPath | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ })
  foreach ($bucketName in $bucketNames) {
    if ($bucketName -match '[\\/]' -or $bucketName -in @('.', '..')) {
      throw "Snapshot bucket list contains an invalid bucket name: $bucketName"
    }

    $objectListPath = Join-Path (Join-Path $storageBackupDir $bucketName) '_object-list.txt'
    if (-not (Test-Path -LiteralPath $objectListPath -PathType Leaf)) {
      throw "Snapshot is missing Storage object inventory for bucket: $bucketName"
    }
    $objectListRelativePath = "storage-buckets/$bucketName/_object-list.txt"
    if (-not $manifestPaths.ContainsKey($objectListRelativePath)) {
      throw "Snapshot manifest is missing Storage object inventory: $objectListRelativePath"
    }

    $objectPaths = @(Get-Content -LiteralPath $objectListPath | ForEach-Object { Get-NormalizedSnapshotPath -Path $_ } | Where-Object { $_ })
    foreach ($objectPath in $objectPaths) {
      if (-not $objectPath.StartsWith("$bucketName/", [System.StringComparison]::Ordinal)) {
        throw "Snapshot Storage object is outside its bucket inventory: $objectPath"
      }
      $storageRelativePath = "storage-buckets/$objectPath"
      if (-not $manifestPaths.ContainsKey($storageRelativePath)) {
        throw "Snapshot manifest is missing Storage object: $storageRelativePath"
      }
    }
  }

  return $true
}

function Test-CompleteSnapshot {
  param([string]$SnapshotDir)

  try {
    return Assert-CompleteSnapshot -SnapshotDir $SnapshotDir
  } catch {
    Write-Warning "Ignoring incomplete snapshot $SnapshotDir`: $($_.Exception.Message)"
    return $false
  }
}

function Get-LatestSnapshotDir {
  param([string]$Root)

  $candidates = Get-ChildItem -LiteralPath $Root -Directory -Filter 'hosted-supabase-*' |
    Sort-Object LastWriteTime -Descending
  foreach ($candidate in $candidates) {
    if (Test-CompleteSnapshot -SnapshotDir $candidate.FullName) {
      return $candidate.FullName
    }
  }

  return $null
}

function Backup-DockerVolume {
  param(
    [string]$VolumeName,
    [string]$DestinationRoot
  )

  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $volumeBackupDir = Join-Path $DestinationRoot "docker-volume-before-refresh-$stamp"
  New-Item -ItemType Directory -Path $volumeBackupDir -Force | Out-Null
  $archiveName = "$VolumeName.tar.gz"

  Write-Step "Backing up Docker volume $VolumeName before local refresh"
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

function Restore-StorageBuckets {
  param([string]$SnapshotDir)

  $storageBackupDir = Join-Path $SnapshotDir 'storage-buckets'
  if (-not (Test-Path -LiteralPath $storageBackupDir)) {
    throw "Snapshot is missing storage-buckets: $SnapshotDir"
  }

  $files = @(
    Get-ChildItem -LiteralPath $storageBackupDir -File -Recurse |
      Where-Object {
        $_.Name -ne 'bucket-list.txt' -and
        $_.Name -ne '_object-list.txt'
      } |
      Sort-Object FullName
  )

  $localEnvironment = @{}
  $statusOutput = @(cmd.exe /d /c 'supabase status -o env 2>nul')
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to inspect local Supabase status (exit code $LASTEXITCODE)."
  }
  $statusOutput | ForEach-Object {
    if ($_ -match '^([A-Z0-9_]+)="?(.*?)"?$') {
      $localEnvironment[$Matches[1]] = $Matches[2].TrimEnd('"')
    }
  }

  if (-not $localEnvironment.API_URL -or -not $localEnvironment.SERVICE_ROLE_KEY) {
    throw 'Unable to read the local Supabase API URL and service-role key.'
  }

  $headers = @{
    Authorization = "Bearer $($localEnvironment.SERVICE_ROLE_KEY)"
    apikey = $localEnvironment.SERVICE_ROLE_KEY
    'x-upsert' = 'true'
  }

  $snapshotSql = @"
drop table if exists private._frettrack_storage_restore_snapshot;
drop table if exists private._frettrack_storage_buckets_restore_snapshot;
create table private._frettrack_storage_restore_snapshot as table storage.objects;
create table private._frettrack_storage_buckets_restore_snapshot as table storage.buckets;
update storage.buckets
set file_size_limit = null,
    allowed_mime_types = null;
"@
  Invoke-Psql -Arguments @('-c', $snapshotSql) | Out-Null

  Write-Step "Restoring $($files.Count) hosted Storage object(s) into local Supabase"
  try {
    $restoredCount = 0
    foreach ($file in $files) {
      $relativePath = $file.FullName.Substring($storageBackupDir.Length).TrimStart('\', '/')
      $objectPath = $relativePath.Replace('\', '/')
      $escapedObjectPath = (($objectPath.Split('/') | ForEach-Object {
        [Uri]::EscapeDataString($_)
      }) -join '/')
      $contentType = switch ($file.Extension.ToLowerInvariant()) {
        '.jpg' { 'image/jpeg' }
        '.jpeg' { 'image/jpeg' }
        '.png' { 'image/png' }
        '.webp' { 'image/webp' }
        '.gif' { 'image/gif' }
        default { 'application/octet-stream' }
      }

      Invoke-RestMethod `
        -Method Post `
        -Uri "$($localEnvironment.API_URL)/storage/v1/object/$escapedObjectPath" `
        -Headers $headers `
        -ContentType $contentType `
        -InFile $file.FullName | Out-Null

      $restoredCount += 1
      if (($restoredCount % 25) -eq 0 -or $restoredCount -eq $files.Count) {
        Write-Step "Restored $restoredCount of $($files.Count) Storage object(s)"
      }
    }
  } finally {
    $restoreMetadataSql = @"
begin;
update storage.objects as target
set id = source.id,
    owner = source.owner,
    created_at = source.created_at,
    updated_at = source.updated_at,
    last_accessed_at = source.last_accessed_at,
    metadata = source.metadata,
    owner_id = source.owner_id,
    user_metadata = source.user_metadata
from private._frettrack_storage_restore_snapshot as source
where target.bucket_id = source.bucket_id
  and target.name = source.name;
drop table private._frettrack_storage_restore_snapshot;
update storage.buckets as target
set file_size_limit = source.file_size_limit,
    allowed_mime_types = source.allowed_mime_types
from private._frettrack_storage_buckets_restore_snapshot as source
where target.id = source.id;
drop table private._frettrack_storage_buckets_restore_snapshot;
commit;
"@
    Invoke-Psql -Arguments @('-c', $restoreMetadataSql) | Out-Null
  }

  return $restoredCount
}

function Invoke-Psql {
  param([string[]]$Arguments)
  Invoke-Checked -FilePath docker -Arguments (@('exec', $DbContainerName, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1') + $Arguments)
}

$ProjectRoot = (Resolve-Path $ProjectRoot).Path
$BackupRoot = (Resolve-Path $BackupRoot).Path

if (-not $SnapshotDir) {
  $SnapshotDir = Get-LatestSnapshotDir -Root $BackupRoot
}

if (-not $SnapshotDir) {
  throw "No hosted Supabase backup snapshot found under $BackupRoot"
}

$SnapshotDir = (Resolve-Path $SnapshotDir).Path
Assert-CompleteSnapshot -SnapshotDir $SnapshotDir | Out-Null
if ($ValidateSnapshotOnly) {
  Write-Step 'Snapshot validation complete'
  Write-Host "Snapshot: $SnapshotDir"
  return
}

Require-Command supabase
Require-Command docker

$dataFile = Join-Path $SnapshotDir 'data.sql'

$dockerVolumes = @(& docker volume ls --format '{{.Name}}')
if ($DockerVolumeName -notin $dockerVolumes) {
  throw "Docker volume not found: $DockerVolumeName"
}

Push-Location $ProjectRoot
try {
  if (-not $SkipPreRefreshVolumeBackup) {
    $preRefreshBackup = Backup-DockerVolume -VolumeName $DockerVolumeName -DestinationRoot $BackupRoot
    Write-Step "Pre-refresh Docker volume backup written to $preRefreshBackup"
    if ($StorageVolumeName -in $dockerVolumes) {
      $preRefreshStorageBackup = Backup-DockerVolume -VolumeName $StorageVolumeName -DestinationRoot $BackupRoot
      Write-Step "Pre-refresh Storage volume backup written to $preRefreshStorageBackup"
    }
  }

  Write-Step "Resetting local Supabase database from repo migrations"
  Invoke-Checked -FilePath supabase -Arguments @('db', 'reset', '--yes')

  Write-Step "Copying hosted data dump into local DB container"
  Invoke-Checked -FilePath docker -Arguments @('cp', $dataFile, "${DbContainerName}:/tmp/frettrack-hosted-data.sql")

  Write-Step "Clearing restored schemas while preserving Supabase internal migration tables"
  $truncateSql = "do `$`$ declare r record; begin for r in select schemaname, tablename from pg_tables where schemaname in ('public','auth','storage') and tablename not in ('schema_migrations','migrations','buckets_vectors','vector_indexes') loop execute format('truncate table %I.%I cascade', r.schemaname, r.tablename); end loop; end `$`$;"
  Invoke-Psql -Arguments @('-c', $truncateSql)

  Write-Step "Restoring hosted data into local database"
  @"
SET session_replication_role = replica;
\i /tmp/frettrack-hosted-data.sql
SET session_replication_role = origin;
"@ | docker exec -i $DbContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) {
    throw "Hosted data restore failed with exit code $LASTEXITCODE"
  }

  Invoke-Checked -FilePath docker -Arguments @('exec', $DbContainerName, 'rm', '-f', '/tmp/frettrack-hosted-data.sql')

  $restoredStorageObjectCount = Restore-StorageBuckets -SnapshotDir $SnapshotDir
  Write-Step "Restored $restoredStorageObjectCount hosted Storage object(s)"

  Write-Step "Local restore verification"
  Invoke-Psql -Arguments @('-c', "select version from supabase_migrations.schema_migrations order by version;")
  Invoke-Psql -Arguments @('-c', "select 'auth.users' as table_name, count(*) from auth.users union all select 'public.beta_access_requests', count(*) from public.beta_access_requests union all select 'public.shop_profiles', count(*) from public.shop_profiles union all select 'public.shop_members', count(*) from public.shop_members union all select 'public.jobs', count(*) from public.jobs union all select 'public.customers', count(*) from public.customers union all select 'storage.objects', count(*) from storage.objects order by table_name;")

  Write-Step "Local database refresh complete"
  Write-Host "Snapshot restored: $SnapshotDir"
} finally {
  Pop-Location
}
