param([string]$Project = 'brainbotdemo1', [string]$Destination = 'backups')
$ErrorActionPreference = 'Stop'
if ($Project -notmatch '^[a-z0-9_-]+$') { throw 'Invalid compose project' }
function RunDocker([string[]]$Arguments) {
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Docker operation failed: $($Arguments[0])" }
}
$backupPath = Join-Path ([IO.Path]::GetFullPath($Destination)) (Get-Date -Format 'yyyyMMdd-HHmmss')
New-Item -ItemType Directory -Path $backupPath -Force | Out-Null
$serverContainer = "$Project-server-1"
$dbContainer = "$Project-postgres-1"
# Quiesce writers so database and uploaded files represent the same point.
RunDocker @('stop', $serverContainer)
try {
  RunDocker @('exec', $dbContainer, 'sh', '-c', 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/brainbot-backup.dump')
  RunDocker @('cp', "${dbContainer}:/tmp/brainbot-backup.dump", (Join-Path $backupPath 'database.dump'))
  RunDocker @('cp', "${serverContainer}:/app/uploads", (Join-Path $backupPath 'uploads'))
  $manifest = Get-ChildItem -LiteralPath $backupPath -File -Recurse | ForEach-Object {
    @{ path = $_.FullName.Substring($backupPath.Length + 1); sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }
  }
  ConvertTo-Json -Depth 5 -InputObject @($manifest) | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $backupPath 'manifest.json')
} finally { RunDocker @('start', $serverContainer) }
Write-Output "Backup complete: $backupPath"
