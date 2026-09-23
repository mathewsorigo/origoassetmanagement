$ErrorActionPreference = 'Stop'
$dbRoot = Join-Path $env:LOCALAPPDATA 'origoassetmanagement-local'
$pgBin = Join-Path $env:LOCALAPPDATA 'codex-tools\origo-db\pgsql\bin'
$apiExe = Join-Path $env:LOCALAPPDATA 'codex-tools\origo-api\postgrest.exe'

if (!(Test-Path (Join-Path $dbRoot 'data\PG_VERSION')) -or !(Test-Path $apiExe)) {
  throw 'A copia local do banco ainda nao foi preparada nesta maquina.'
}

$env:PATH = "$pgBin;$env:PATH"
& (Join-Path $pgBin 'pg_ctl.exe') -D (Join-Path $dbRoot 'data') status *> $null
if ($LASTEXITCODE -ne 0) {
  $databaseProcess = Start-Process -FilePath (Join-Path $pgBin 'postgres.exe') `
    -ArgumentList @('-D', ('"' + (Join-Path $dbRoot 'data') + '"')) `
    -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $dbRoot 'postgres.log') `
    -RedirectStandardError (Join-Path $dbRoot 'postgres-error.log')
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    & (Join-Path $pgBin 'pg_isready.exe') -h 127.0.0.1 -p 54330 *> $null
    if ($LASTEXITCODE -eq 0) { break }
    if ($databaseProcess.HasExited) { throw 'O PostgreSQL encerrou. Consulte postgres-error.log.' }
    Start-Sleep -Seconds 1
  }
  if ($LASTEXITCODE -ne 0) { throw 'O PostgreSQL nao ficou pronto em 30 segundos.' }
}

try {
  $null = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:54331/assets?select=id&limit=0' -TimeoutSec 3
  Write-Output 'API local ja esta rodando em 127.0.0.1:54331.'
} catch {
  Write-Output 'Iniciando a API local de consulta. Mantenha este terminal aberto.'
  & $apiExe (Join-Path $dbRoot 'postgrest.local.conf')
}
