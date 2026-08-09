param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d+\.\d+\.\d+$')]
  [string]$VersionName,

  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 2147483647)]
  [int]$VersionCode,

  [ValidateRange(0, 2147483647)]
  [int]$CurrentVersionCode = 0,

  [string]$ApiBaseUrl = 'https://zhuguang-mobile-api.xuzerui6.workers.dev'
)

$ErrorActionPreference = 'Stop'

function Read-SecureValue([Security.SecureString]$Value) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

$releaseDirectory = Join-Path $PSScriptRoot '..\outputs\releases'
$manifestPath = Join-Path $releaseDirectory "android-private-release-$VersionName.json"
$cloudflareConfigPath = Join-Path $env:USERPROFILE '.zhuguang\cloudflare\mobile-api-secrets.xml'
$temporaryApk = Join-Path $env:TEMP "zhuguang-release-verification-$VersionCode.apk"

if (-not (Test-Path -LiteralPath $manifestPath)) {
  throw "Release manifest is missing at $manifestPath"
}
if (-not (Test-Path -LiteralPath $cloudflareConfigPath)) {
  throw "Mobile API credentials are missing at $cloudflareConfigPath"
}

$manifest = Get-Content -Raw -Encoding utf8 -LiteralPath $manifestPath | ConvertFrom-Json
if ($manifest.versionCode -ne $VersionCode -or $manifest.versionName -ne $VersionName) {
  throw 'Release manifest version does not match the requested version.'
}

$cloudflare = Import-Clixml -LiteralPath $cloudflareConfigPath
$pilotAppKey = Read-SecureValue $cloudflare.PILOT_APP_KEY
$installationId = "release-verification-$VersionCode"
$headers = @{
  'x-app-platform' = 'android'
  'x-app-version' = $VersionName
  'x-app-version-code' = [string]$CurrentVersionCode
  'x-device-id' = $installationId
  'x-zhuguang-app-key' = $pilotAppKey
}

try {
  Write-Host "[verify] Resolving the latest release for code $CurrentVersionCode"
  $latest = Invoke-RestMethod `
    -Headers $headers `
    -Method Get `
    -TimeoutSec 30 `
    -Uri "$ApiBaseUrl/api/v1/app/releases/latest"
  if ($latest.data.versionCode -ne $VersionCode -or $latest.data.versionName -ne $VersionName) {
    throw 'Latest release response does not match the expected version.'
  }
  if ($latest.data.sha256 -ne $manifest.sha256 -or $latest.data.sizeBytes -ne $manifest.sizeBytes) {
    throw 'Published release metadata does not match the signed build manifest.'
  }

  Write-Host '[verify] Requesting a five-minute download ticket'
  $ticket = Invoke-RestMethod `
    -Headers $headers `
    -Method Post `
    -TimeoutSec 30 `
    -Uri "$ApiBaseUrl/api/v1/app/releases/$VersionCode/download-ticket"

  Write-Host '[verify] Downloading and hashing the ticketed APK'
  Invoke-WebRequest -OutFile $temporaryApk -TimeoutSec 90 -Uri $ticket.data.url | Out-Null
  $download = Get-Item -LiteralPath $temporaryApk
  $downloadSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $temporaryApk).Hash.ToLowerInvariant()
  if ($download.Length -ne $manifest.sizeBytes -or $downloadSha256 -ne $manifest.sha256) {
    throw 'Ticketed APK failed size or SHA-256 verification.'
  }

  Write-Host "[verify] Verified $VersionName (code $VersionCode)"
  Write-Host "[verify] SHA-256: $downloadSha256"
  Write-Host "[verify] Size: $($download.Length) bytes"
} finally {
  if (Test-Path -LiteralPath $temporaryApk) {
    Remove-Item -Force -LiteralPath $temporaryApk
  }
  $pilotAppKey = $null
  $headers = $null
}
