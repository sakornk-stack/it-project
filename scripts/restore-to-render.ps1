# Copy the local database (the one Docker runs on this machine) into the Render database.
# Run from the repo root in PowerShell:  .\scripts\restore-to-render.ps1
# It asks for Render's "External Database URL" (Render → eduanalyze-db → Connect → External)
# and never prints it. Everything in the Render database is replaced.
# The dump moves as a file (docker cp / a mount), never through a PowerShell
# pipe, which would mangle the binary format on Windows PowerShell 5.1.
param([string]$Url)
# Docker writes progress to stderr, which Windows PowerShell 5.1 can turn into
# errors, so each step is judged by its exit code instead.
$ErrorActionPreference = 'Continue'
function Assert-Ok($what) { if ($LASTEXITCODE -ne 0) { throw "$what failed (exit $LASTEXITCODE)" } }

if (-not $Url) {
  $secure = Read-Host -AsSecureString 'Paste the External Database URL from Render'
  $Url = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}
if ($Url -notmatch '^postgres(ql)?://') { throw 'That does not look like a postgres:// URL.' }

$dir = Join-Path $env:TEMP 'eduanalyze-to-render'
New-Item -ItemType Directory -Force $dir | Out-Null

Write-Host '1/2 Dumping the local database...'
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-privileges -f /tmp/to-render.dump'
Assert-Ok 'pg_dump'
docker compose cp postgres:/tmp/to-render.dump "$dir\to-render.dump"
docker compose exec -T postgres rm -f /tmp/to-render.dump
if ((Get-Item "$dir\to-render.dump").Length -lt 10000) { throw 'The dump looks empty; is Docker running?' }

Write-Host '2/2 Restoring into Render (about a minute)...'
docker run --rm -v "${dir}:/dump" -e PGSSLMODE=prefer postgres:16 pg_restore --no-owner --no-privileges --clean --if-exists -d $Url /dump/to-render.dump
Assert-Ok 'pg_restore'
Remove-Item -Recurse -Force $dir
Write-Host 'Done. Open the web URL and log in with a demo account.'
