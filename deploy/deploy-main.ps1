[CmdletBinding()]
param(
  [string[]]$Services = @('founder_radar_smoke'),
  [string[]]$RequiredEnv = @('FOLLOW_BUILDERS_FEED_BASE_URL', 'FOUNDER_RADAR_LANGUAGE', 'FOUNDER_RADAR_LLM_BASE_URL', 'FOUNDER_RADAR_LLM_API_KEY', 'FOUNDER_RADAR_LLM_MODEL', 'LARK_APP_ID', 'LARK_APP_SECRET', 'LARK_RECIPIENT_OPEN_ID')
)

$ErrorActionPreference = 'Stop'

$Services = @($Services | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$RequiredEnv = @($RequiredEnv | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })

function Resolve-RepoRoot {
  $gitCommonDir = git -C $PSScriptRoot rev-parse --path-format=absolute --git-common-dir 2>$null
  if (-not $gitCommonDir) {
    throw 'Unable to resolve git common dir.'
  }

  $gitDir = [System.IO.Path]::GetFullPath($gitCommonDir.Trim())
  return (Split-Path -Parent $gitDir)
}

$repoRoot = Resolve-RepoRoot
$deployRoot = Join-Path $repoRoot '.worktrees\deploy-main'
$composeFile = Join-Path $deployRoot 'deploy\docker-compose.yml'
$envFile = Join-Path $deployRoot '.env'
$projectDir = Join-Path $deployRoot 'deploy'

if (-not (Test-Path $deployRoot)) {
  throw "Missing deploy worktree: $deployRoot"
}

if (-not (Test-Path $composeFile)) {
  throw "Missing compose file: $composeFile"
}

if (-not (Test-Path $envFile)) {
  throw "Missing env file: $envFile"
}

$envMap = @{}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*#') { return }
  if ($_ -match '^\s*$') { return }
  $parts = $_ -split '=', 2
  if ($parts.Count -eq 2) {
    $envMap[$parts[0].Trim()] = $parts[1].Trim()
  }
}

foreach ($name in $RequiredEnv) {
  if (-not $envMap.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($envMap[$name])) {
    throw "Required env missing from ${envFile}: $name"
  }
}

Write-Host "==> docker compose config"
docker compose --project-directory $projectDir --env-file $envFile -f $composeFile config | Out-Null

Write-Host "==> docker compose up"
docker compose --project-directory $projectDir --env-file $envFile -f $composeFile up -d --build @Services

foreach ($service in $Services) {
  $containerId = docker compose --project-directory $projectDir --env-file $envFile -f $composeFile ps -q $service
  if (-not $containerId) {
    throw "No container found for service: $service"
  }

  $running = docker inspect -f '{{.State.Running}}' $containerId
  if ($running.Trim() -ne 'true') {
    throw "Container is not running for service: $service"
  }

  foreach ($name in $RequiredEnv) {
    $value = docker exec $containerId /bin/sh -lc "printenv $name"
    if ([string]::IsNullOrWhiteSpace($value)) {
      throw "Container env check failed for ${service}: $name"
    }
  }
}

Write-Host 'Deploy verification passed.'
