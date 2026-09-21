param([Parameter(Mandatory=$true)][string]$Backup, [string]$Project = 'brainbot_acceptance')
$ErrorActionPreference = 'Stop'
if ($Project -notmatch '^brainbot_(acceptance|test)[a-z0-9_-]*$') { throw 'Restore drill only permits isolated test projects' }
$backupPath = [IO.Path]::GetFullPath($Backup)
$entries = @(Get-Content -Raw -LiteralPath (Join-Path $backupPath 'manifest.json') | ConvertFrom-Json)
foreach ($entry in $entries) {
  $targetPath = [IO.Path]::GetFullPath((Join-Path $backupPath $entry.path))
  if (-not $targetPath.StartsWith($backupPath + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe manifest path' }
  if ((Get-FileHash -LiteralPath $targetPath -Algorithm SHA256).Hash -ne $entry.sha256) { throw "Backup checksum mismatch: $($entry.path)" }
}
function RunDocker([string[]]$Arguments) { & docker @Arguments; if ($LASTEXITCODE -ne 0) { throw "Docker failed: $($Arguments[0])" } }
$dbContainer = "$Project-postgres-1"
$database = 'brainbot_restore_' + (Get-Date -Format 'yyyyMMddHHmmss')
RunDocker @('cp', (Join-Path $backupPath 'database.dump'), "${dbContainer}:/tmp/brainbot-restore.dump")
RunDocker @('exec', $dbContainer, 'sh', '-c', ('createdb -U "$POSTGRES_USER" ' + $database))
RunDocker @('exec', $dbContainer, 'sh', '-c', ('pg_restore --exit-on-error --no-owner -U "$POSTGRES_USER" -d ' + $database + ' /tmp/brainbot-restore.dump'))
RunDocker @('exec', $dbContainer, 'sh', '-c', ('psql -U "$POSTGRES_USER" -d ' + $database + ' -c "SELECT count(*) AS restored_migrations FROM _prisma_migrations; SELECT count(*) AS restored_files FROM research_files;"'))
# Copy uploads into a fresh directory and verify every original byte.
$restoredPath = Join-Path $backupPath ('restored-' + $database)
Copy-Item -LiteralPath (Join-Path $backupPath 'uploads') -Destination $restoredPath -Recurse
foreach ($entry in $entries | Where-Object { $_.path -match '^uploads[\\/]' }) {
  $relative = $entry.path -replace '^uploads[\\/]',''
  if ((Get-FileHash -LiteralPath (Join-Path $restoredPath $relative) -Algorithm SHA256).Hash -ne $entry.sha256) { throw 'Restored upload checksum mismatch' }
}
Write-Output "Restore drill passed. Isolated database: $database; uploads: $restoredPath"
