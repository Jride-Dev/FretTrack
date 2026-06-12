param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$BackupRoot = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..')).Path 'backups'),
  [string]$SnapshotDir,
  [string]$DockerVolumeName = 'supabase_db_FretTrack',
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

  Write-Host "+ $FilePath $($Arguments -join ' ')"
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
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

$volumeExists = (& docker volume ls --format '{{.Name}}') -contains $DockerVolumeName
if (-not $volumeExists) {
  throw "Docker volume not found: $DockerVolumeName"
}

Push-Location $ProjectRoot
try {
  if (-not $SkipPreRefreshVolumeBackup) {
    $preRefreshBackup = Backup-DockerVolume -VolumeName $DockerVolumeName -DestinationRoot $BackupRoot
    Write-Step "Pre-refresh Docker volume backup written to $preRefreshBackup"
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

  Write-Step "Local restore verification"
  Invoke-Psql -Arguments @('-c', "select version from supabase_migrations.schema_migrations order by version;")
  Invoke-Psql -Arguments @('-c', "select 'auth.users' as table_name, count(*) from auth.users union all select 'public.beta_access_requests', count(*) from public.beta_access_requests union all select 'public.shop_profiles', count(*) from public.shop_profiles union all select 'public.shop_members', count(*) from public.shop_members union all select 'public.jobs', count(*) from public.jobs union all select 'public.customers', count(*) from public.customers union all select 'storage.objects', count(*) from storage.objects order by table_name;")

  Write-Step "Local database refresh complete"
  Write-Host "Snapshot restored: $SnapshotDir"
} finally {
  Pop-Location
}
