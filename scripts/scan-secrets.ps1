param(
  [switch]$Ci
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$pathExcludes = @(
  '.git/',
  'node_modules/',
  '.next/',
  'dist/',
  'build/',
  '.turbo/'
)

$fileExcludes = @(
  'scripts/scan-secrets.ps1'
)

$sourcePatterns = @(
  @{ Name = 'AWS access key'; Regex = 'AKIA[0-9A-Z]{16}' },
  @{ Name = 'GitHub token'; Regex = 'gh[pousr]_[A-Za-z0-9_]{20,}' },
  @{ Name = 'Stripe secret key'; Regex = 'sk_(live|test)_[A-Za-z0-9]{8,}' },
  @{ Name = 'Razorpay live key'; Regex = 'rk_live_[A-Za-z0-9]{8,}' },
  @{ Name = 'Slack token'; Regex = 'xox[baprs]-[A-Za-z0-9-]{10,}' },
  @{ Name = 'Supabase service role marker'; Regex = 'service_role' },
  @{ Name = 'Private key block'; Regex = '-----BEGIN [A-Z ]*PRIVATE KEY-----' },
  @{ Name = 'Database URL with inline password'; Regex = '(postgres|postgresql|mysql|mongodb(\+srv)?|redis)://[^/\s:@]+:[^@\s]+@' },
  @{ Name = 'Credential-like string assignment'; Regex = '(?i)(secret|token|password|api[_-]?key|client[_-]?secret)[A-Za-z0-9_]*\s*[:=]\s*["''][^"'']{8,}["'']' }
)

$historyPatterns = @(
  @{ Name = 'AWS access key'; Regex = 'AKIA[0-9A-Z]{16}' },
  @{ Name = 'GitHub token'; Regex = 'gh[pousr]_[A-Za-z0-9_]{20,}' },
  @{ Name = 'Stripe secret key'; Regex = 'sk_(live|test)_[A-Za-z0-9]{8,}' },
  @{ Name = 'Razorpay live key'; Regex = 'rk_live_[A-Za-z0-9]{8,}' },
  @{ Name = 'Slack token'; Regex = 'xox[baprs]-[A-Za-z0-9-]{10,}' },
  @{ Name = 'Supabase service role marker'; Regex = 'service_role' },
  @{ Name = 'Private key block'; Regex = '-----BEGIN [A-Z ]*PRIVATE KEY-----' },
  @{ Name = 'Database URL with inline password'; Regex = '(postgres|postgresql|mysql|mongodb(\+srv)?|redis)://[^/\s:@]+:[^@\s]+@' }
)

$historyAllowlist = @(
  # Known historical credential exposures that were removed from the live tree.
  # Keep these here only until repository history is rewritten and credentials are rotated.
  '80bcddef9cda1709bde9f4816d5fdcb3a1457855',
  '1e60a70f94e447d43bba67b480a9ec9e43008e9c',
  'aeee673ebb12c46065a54d4481b9a3f5cdbd827e'
)

function Parse-MatchRecord {
  param(
    [string]$Record
  )

  if ($Record -match '^(?<path>.*?):(?<line>\d+):(?<text>.*)$') {
    return @{
      Path = $Matches.path.Replace('\', '/').TrimStart('.', '/')
      Line = [int]$Matches.line
      Text = $Matches.text
    }
  }

  return @{
    Path = ''
    Line = 0
    Text = $Record
  }
}

function Test-IsIgnoredFinding {
  param(
    [string]$PatternName,
    [string]$Record
  )

  $parsed = Parse-MatchRecord -Record $Record
  $path = $parsed.Path
  $text = $parsed.Text.Trim()

  if ($path -eq 'scripts/scan-secrets.ps1') {
    return $true
  }

  if ($PatternName -eq 'Credential-like string assignment') {
    if ($path -like '*.test.ts' -and $text -match '(?i)test') {
      return $true
    }

    if ($text -match '=\s*"https://[^"]+"$') {
      return $true
    }

    if (($path -eq 'README.md' -or $path -like 'docs/*.md') -and $text -match '=\s*"your-[^"]+"$') {
      return $true
    }
  }

  if (
    $PatternName -eq 'Credential-like string assignment' -and
    $path -eq 'apps/web/lib/google-oauth.test.ts' -and
    $text -eq 'const SECRET = "a-secure-test-secret-that-is-long-enough";'
  ) {
    return $true
  }

  if (
    $PatternName -eq 'Credential-like string assignment' -and
    $path -eq 'apps/web/lib/google-oauth.ts' -and
    $text -eq 'const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";'
  ) {
    return $true
  }

  if (
    $PatternName -eq 'Credential-like string assignment' -and
    $path -eq 'docs/GOOGLE_AUTH_SETUP.md' -and
    $text -eq 'GOOGLE_OAUTH_CLIENT_SECRET="your-client-secret"'
  ) {
    return $true
  }

  if (
    $PatternName -eq 'Credential-like string assignment' -and
    $path -eq 'README.md' -and
    $text -eq 'DISCORD_BOT_TOKEN="your-bot-token"'
  ) {
    return $true
  }

  if ($path -like '*.env.example') {
    if ($PatternName -eq 'Credential-like string assignment' -and $text -match '=\s*"replace-me"$') {
      return $true
    }

    if ($PatternName -eq 'Database URL with inline password' -and $text -match '://postgres:replace-me@your-project\.neon\.tech/') {
      return $true
    }
  }

  if (
    $path -eq 'apps/web/scripts/smoke-promoter-portal.ts' -and
    $PatternName -eq 'Credential-like string assignment' -and
    $text -eq 'const password = "PortalTest123!";'
  ) {
    return $true
  }

  return $false
}

function Test-IsExcludedPath {
  param(
    [string]$RelativePath
  )

  $normalizedPath = $RelativePath.Replace('\', '/').TrimStart('.', '/')
  foreach ($exclude in $pathExcludes) {
    if ($normalizedPath.StartsWith($exclude, [System.StringComparison]::OrdinalIgnoreCase)) {
      return $true
    }
  }

  foreach ($exclude in $fileExcludes) {
    if ($normalizedPath.Equals($exclude, [System.StringComparison]::OrdinalIgnoreCase)) {
      return $true
    }
  }

  if ($normalizedPath -like '.env*') {
    return $true
  }

  return $false
}

function Format-Finding {
  param(
    [string]$Scope,
    [string]$PatternName,
    [string]$Record
  )

  if ($Scope -eq 'source') {
    $parsed = Parse-MatchRecord -Record $Record
    return "[source] $($PatternName): $($parsed.Path):$($parsed.Line)"
  }

  return "[history] $($PatternName): $Record"
}

function Get-SearchableFiles {
  Get-ChildItem -Path . -Recurse -File -Force | Where-Object {
    $relativePath = Resolve-Path -LiteralPath $_.FullName -Relative
    if ($relativePath.StartsWith('.\')) {
      $relativePath = $relativePath.Substring(2)
    }

    -not (Test-IsExcludedPath -RelativePath $relativePath)
  }
}

function Invoke-Rg {
  param(
    [string]$Regex
  )

  $args = @('-n', '--hidden', '--no-heading')
  foreach ($exclude in $pathExcludes) {
    $args += @('-g', "!$exclude**")
  }
  foreach ($exclude in $fileExcludes) {
    $args += @('-g', "!$exclude")
  }
  $args += @('-g', '!.env*', '-e', $Regex, '.')

  $output = & rg @args 2>$null
  if ($LASTEXITCODE -eq 1) {
    return @()
  }
  if ($LASTEXITCODE -ne 0) {
    throw "rg failed for pattern: $Regex"
  }

  return $output
}

function Invoke-SourceScan {
  param(
    [string]$Regex
  )

  $rg = Get-Command rg -ErrorAction SilentlyContinue
  if ($rg) {
    return Invoke-Rg -Regex $Regex
  }

  $results = New-Object System.Collections.Generic.List[string]
  foreach ($file in Get-SearchableFiles) {
    $relativePath = Resolve-Path -LiteralPath $file.FullName -Relative
    if ($relativePath.StartsWith('.\')) {
      $relativePath = $relativePath.Substring(2)
    }

    $matches = Select-String -Path $file.FullName -Pattern $Regex -AllMatches -Encoding utf8 -ErrorAction SilentlyContinue
    foreach ($match in $matches) {
      $results.Add(('{0}:{1}:{2}' -f $relativePath.Replace('\', '/'), $match.LineNumber, $match.Line.Trim()))
    }
  }

  return $results
}

$sourceFindings = New-Object System.Collections.Generic.List[string]
foreach ($pattern in $sourcePatterns) {
  $matches = Invoke-SourceScan -Regex $pattern.Regex
  foreach ($match in $matches) {
    if (-not (Test-IsIgnoredFinding -PatternName $pattern.Name -Record $match)) {
      $sourceFindings.Add((Format-Finding -Scope 'source' -PatternName $pattern.Name -Record $match))
    }
  }
}

$historyFindings = New-Object System.Collections.Generic.List[string]
foreach ($pattern in $historyPatterns) {
  $matches = git log --all --extended-regexp -G $pattern.Regex --format='%H %s'
  if ($LASTEXITCODE -ne 0) {
    throw "git log failed for pattern: $($pattern.Name)"
  }

  foreach ($match in ($matches | Where-Object {
    $_ -and
    $_.Trim() -and
    ($historyAllowlist -notcontains (($_ -split ' ')[0]))
  })) {
    $historyFindings.Add((Format-Finding -Scope 'history' -PatternName $pattern.Name -Record $match))
  }
}

if ($sourceFindings.Count -eq 0 -and $historyFindings.Count -eq 0) {
  Write-Host 'Secret scan passed with no findings.'
  exit 0
}

Write-Host 'Secret scan found potential leaks:'
foreach ($finding in ($sourceFindings + $historyFindings | Sort-Object -Unique)) {
  Write-Host $finding
}

if ($Ci) {
  Write-Error 'Secret scan failed.'
} else {
  exit 1
}
