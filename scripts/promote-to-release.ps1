<#
.SYNOPSIS
  Promote production-only files from Dev into branch `release` and tag a version.

.EXAMPLE
  .\scripts\promote-to-release.ps1 -Tag v1.0.0
  .\scripts\promote-to-release.ps1 -Tag v1.0.1 -Push
  .\scripts\promote-to-release.ps1 -Tag v1.0.0 -DryRun
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^v\d+\.\d+\.\d+$')]
  [string]$Tag,

  [switch]$Push,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Assert-GitRepo {
  git rev-parse --is-inside-work-tree 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Not inside a git repository.' }
}

function Get-RepoRoot {
  (git rev-parse --show-toplevel).Trim()
}

function Test-CleanWorktree {
  # Ignore untracked files (.cursor/, local notes); block staged/unstaged tracked changes.
  git diff --quiet
  if ($LASTEXITCODE -ne 0) {
    throw 'Working tree has unstaged changes. Commit or stash before promote.'
  }
  git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    throw 'Index has staged changes. Commit or stash before promote.'
  }
}

function New-ReleaseGitignore {
  @'
._*
.DS_Store
node_modules

# Secrets — never commit on release
.env
.env.*
!.env.example
server/.env
server/.env.*
!server/.env.example
server/license.json
server/logs/
server/uploads/

# Non-production / clutter safety net
docs/
.cursor/
db/
tmp/
dist/
scripts/
*.sql
rekon-*
Rekon*
kpi_kc.json
kpi_kck.json
kpi_kcp.json
kpi_pelaksana.json
kpi_corporate_dump.sql
tmp-*
server/check_*
server/test_*
server/fix_*
server/update_*
server/generate_*
server/import-*
server/seed*
server/cleanup*
server/*.xlsx
server/database.sqlite
server/dump.sql
server/production_dump.sql
server/index.cjs
server/db.cjs
server/dummy_output.txt
server/missing_kpis_output.txt
'@
}

# Relative paths / dirs synced from Dev into release (no .env ever).
$RootFiles = @(
  'index.html',
  'index.php',
  '.htaccess',
  'favicon.jpg',
  'bank-sumut-logo-terang.png',
  'ecosystem.config.cjs',
  'nginx-kpi-production.conf',
  'package.json',
  'package-lock.json',
  'vite.config.js',
  'api/.htaccess'
)

$RootDirs = @(
  'assets'
)

$ServerFiles = @(
  'server/index.js',
  'server/db.js',
  'server/.htaccess',
  'server/package.json',
  'server/package-lock.json',
  'server/.env.example',
  'server/scripts/migrate-passwords.js'
)

$ServerDirs = @(
  'server/routes',
  'server/lib',
  'server/middleware',
  'server/migrations',
  'server/services'
)

$BlockedNamePatterns = @(
  '(^|/)\.env$',
  '(^|/)\.env\.',
  '(^|/)server/\.env$',
  '(^|/)server/\.env\.'
)

function Test-BlockedPath([string]$RelPath) {
  $norm = $RelPath.Replace('\', '/')
  foreach ($pat in $BlockedNamePatterns) {
    if ($norm -match $pat) {
      # Allow *.example
      if ($norm -match '\.env\.example$') { return $false }
      return $true
    }
  }
  return $false
}

function Export-AllowlistFromDev {
  param(
    [string]$DevSha,
    [string]$WorkDir
  )

  if (Test-Path $WorkDir) {
    Remove-Item -Recurse -Force $WorkDir
  }
  New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null

  $exportList = New-TemporaryFile
  try {
    $lines = New-Object System.Collections.Generic.List[string]
    foreach ($f in ($RootFiles + $ServerFiles)) {
      $norm = $f.Replace('\', '/')
      git cat-file -e "${DevSha}:${norm}" 2>$null
      if ($LASTEXITCODE -eq 0) { [void]$lines.Add($norm) }
      else { Write-Host "SKIP (missing on Dev): $norm" }
    }
    foreach ($d in ($RootDirs + $ServerDirs)) {
      $norm = $d.Replace('\', '/')
      git cat-file -e "${DevSha}:${norm}" 2>$null
      if ($LASTEXITCODE -eq 0) { [void]$lines.Add($norm) }
      else { Write-Host "SKIP (missing on Dev): $norm" }
    }
    $lines | Set-Content -Path $exportList -Encoding utf8

    # git archive with path list
    $archive = Join-Path ([System.IO.Path]::GetTempPath()) ("kb-release-" + [guid]::NewGuid().ToString('n') + '.tar')
    $pathArgs = @('archive', '--format=tar', '-o', $archive, $DevSha) + $lines
    & git @pathArgs
    if ($LASTEXITCODE -ne 0) { throw 'git archive failed' }

    # Extract with tar if available, else PowerShell tar (Windows 10+)
    Push-Location $WorkDir
    try {
      tar -xf $archive
      if ($LASTEXITCODE -ne 0) { throw 'tar extract failed' }
    }
    finally {
      Pop-Location
      Remove-Item -Force $archive -ErrorAction SilentlyContinue
    }
  }
  finally {
    Remove-Item -Force $exportList -ErrorAction SilentlyContinue
  }

  # Write release .gitignore (not taken from Dev)
  $gi = Join-Path $WorkDir '.gitignore'
  New-ReleaseGitignore | Set-Content -Path $gi -Encoding utf8

  # Defense: delete any .env that slipped in
  Get-ChildItem -Path $WorkDir -Recurse -Force -File -ErrorAction SilentlyContinue |
    Where-Object {
      $rel = $_.FullName.Substring($WorkDir.Length).TrimStart('\', '/').Replace('\', '/')
      (Test-BlockedPath $rel) -and ($rel -notmatch '\.env\.example$')
    } |
    ForEach-Object {
      Write-Warning "Removing blocked file from export: $($_.FullName)"
      Remove-Item -Force $_.FullName
    }
}

function Assert-NoEnvInTree([string]$Root) {
  $bad = Get-ChildItem -Path $Root -Recurse -Force -File -ErrorAction SilentlyContinue |
    Where-Object {
      $name = $_.Name
      ($name -eq '.env' -or $name -like '.env.*') -and ($name -ne '.env.example')
    }
  if ($bad) {
    $list = ($bad | ForEach-Object { $_.FullName }) -join "`n"
    throw "Refusing to promote: .env files present:`n$list"
  }
}

function Sync-WorktreeFromExport {
  param(
    [string]$ExportDir,
    [string]$RepoRoot
  )

  # Remove everything tracked except .git
  Get-ChildItem -Path $RepoRoot -Force |
    Where-Object { $_.Name -ne '.git' } |
    ForEach-Object { Remove-Item -Recurse -Force $_.FullName }

  # Copy export into repo root
  Copy-Item -Path (Join-Path $ExportDir '*') -Destination $RepoRoot -Recurse -Force
  # also hidden files like .gitignore / .htaccess
  Get-ChildItem -Path $ExportDir -Force |
    Where-Object { $_.Name -like '.*' } |
    ForEach-Object { Copy-Item -Path $_.FullName -Destination (Join-Path $RepoRoot $_.Name) -Recurse -Force }
}

# --- main ---
Assert-GitRepo
$repoRoot = Get-RepoRoot
Set-Location $repoRoot

$startBranch = (git branch --show-current).Trim()
if ($startBranch -ne 'Dev') {
  throw "Must run from branch Dev (current: $startBranch)."
}

Test-CleanWorktree

$devSha = (git rev-parse HEAD).Trim()
$devShort = (git rev-parse --short HEAD).Trim()

if (git rev-parse -q --verify "refs/tags/$Tag" 2>$null) {
  throw "Tag already exists: $Tag"
}

Write-Host "Promote Dev $devShort -> release as $Tag"
if ($DryRun) { Write-Host '[DryRun] No commits/tags/pushes will be made.' }

$exportDir = Join-Path ([System.IO.Path]::GetTempPath()) ("kb-release-export-" + [guid]::NewGuid().ToString('n'))
try {
  Export-AllowlistFromDev -DevSha $devSha -WorkDir $exportDir
  Assert-NoEnvInTree $exportDir

  if ($DryRun) {
    Write-Host 'Export preview (top-level):'
    Get-ChildItem $exportDir -Force | Select-Object Name, Mode | Format-Table | Out-String | Write-Host
    $fileCount = (Get-ChildItem $exportDir -Recurse -File -Force).Count
    Write-Host "File count: $fileCount"
    Write-Host 'DryRun complete.'
    return
  }

  $releaseExists = $false
  git show-ref --verify --quiet refs/heads/release
  if ($LASTEXITCODE -eq 0) { $releaseExists = $true }

  if (-not $releaseExists) {
    git checkout --orphan release
    if ($LASTEXITCODE -ne 0) { throw 'Failed to create orphan branch release' }
    git rm -rf . 2>$null | Out-Null
  }
  else {
    git checkout release
    if ($LASTEXITCODE -ne 0) { throw 'Failed to checkout release' }
  }

  Sync-WorktreeFromExport -ExportDir $exportDir -RepoRoot $repoRoot
  Assert-NoEnvInTree $repoRoot

  git add -A
  # Extra guard on index
  $staged = git diff --cached --name-only
  foreach ($s in $staged) {
    if (Test-BlockedPath $s) {
      git reset HEAD -- $s 2>$null
      if (Test-Path $s) { Remove-Item -Force $s -ErrorAction SilentlyContinue }
      throw "Blocked .env path staged: $s"
    }
  }

  $msg = "release: promote from Dev $devShort as $Tag"
  git commit -m $msg
  if ($LASTEXITCODE -ne 0) { throw 'Commit failed (maybe no changes?)' }

  git tag -a $Tag -m "Release $Tag"
  if ($LASTEXITCODE -ne 0) { throw "Failed to create tag $Tag" }

  Write-Host "Created commit on release and tag $Tag"

  if ($Push) {
    Write-Host 'Pushing release + tag to origin and server...'
    git push -u origin release
    if ($LASTEXITCODE -ne 0) { throw 'Push to origin (branch) failed' }
    git push origin $Tag
    if ($LASTEXITCODE -ne 0) { throw 'Push to origin (tag) failed' }

    git push -u server release
    if ($LASTEXITCODE -ne 0) { throw 'Push to server (branch) failed' }
    git push server $Tag
    if ($LASTEXITCODE -ne 0) { throw 'Push to server (tag) failed' }
    Write-Host 'Push complete (origin + server).'
  }
  else {
    Write-Host 'Skipping push (pass -Push to push origin + server).'
  }
}
finally {
  if (Test-Path $exportDir) {
    Remove-Item -Recurse -Force $exportDir -ErrorAction SilentlyContinue
  }
}

# Return to Dev for continued development
git checkout Dev
if ($LASTEXITCODE -ne 0) {
  Write-Warning 'Could not checkout Dev; you may still be on release.'
}
else {
  Write-Host 'Back on Dev.'
}
