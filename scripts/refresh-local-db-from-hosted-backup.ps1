param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$BackupRoot = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..')).Path 'backups'),
  [string]$SnapshotDir,
  [string]$DockerVolumeName = 'supabase_db_FretTrack',
  [string]$StorageVolumeName = 'supabase_storage_FretTrack',
  [string]$DbContainerName = 'supabase_db_FretTrack',
  [switch]$SkipPreRefreshVolumeBackup
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

function Get-LatestSnapshotDir {
  param([string]$Root)

  return Get-ChildItem -LiteralPath $Root -Directory -Filter 'hosted-supabase-*' |
    Where-Object {
      Test-Path -LiteralPath (Join-Path $_.FullName 'data.sql')
    } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 |
    ForEach-Object { $_.FullName }
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

Require-Command supabase
Require-Command docker

$ProjectRoot = (Resolve-Path $ProjectRoot).Path
$BackupRoot = (Resolve-Path $BackupRoot).Path

if (-not $SnapshotDir) {
  $SnapshotDir = Get-LatestSnapshotDir -Root $BackupRoot
}

if (-not $SnapshotDir) {
  throw "No hosted Supabase backup snapshot found under $BackupRoot"
}

$SnapshotDir = (Resolve-Path $SnapshotDir).Path
$dataFile = Join-Path $SnapshotDir 'data.sql'
if (-not (Test-Path -LiteralPath $dataFile)) {
  throw "Snapshot is missing data.sql: $SnapshotDir"
}

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
