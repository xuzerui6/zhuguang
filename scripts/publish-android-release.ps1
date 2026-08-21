param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d+\.\d+\.\d+$')]
  [string]$VersionName,

  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 2147483647)]
  [int]$VersionCode,

  [ValidateRange(1, 2147483647)]
  [int]$MinimumSupportedVersionCode = 5,

  [ValidateRange(0, 100)]
  [int]$RolloutPercentage = 100,

  [string[]]$Notes = @(),

  [int]$PauseVersionCode = 0,

  [string]$ApiBaseUrl = 'https://api.beijingzhuguang.top'
)

$ErrorActionPreference = 'Stop'

if (-not $Notes.Count) {
  $Notes = @(
    [regex]::Unescape('\u4f18\u5316\u7248\u672c\u4e2d\u5fc3\u79bb\u7ebf\u72b6\u6001'),
    [regex]::Unescape('\u4fee\u6b63\u5df2\u5b89\u88c5\u7248\u672c\u8bfb\u53d6'),
    [regex]::Unescape('\u63d0\u5347\u66f4\u65b0\u670d\u52a1\u5f02\u5e38\u63d0\u793a')
  )
}

function Read-SecureValue([Security.SecureString]$Value) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function Invoke-OperatorJson(
  [string]$Method,
  [string]$Path,
  [hashtable]$Headers,
  [object]$Body = $null
) {
  $parameters = @{
    Headers = $Headers
    Method = $Method
    TimeoutSec = 30
    Uri = "$ApiBaseUrl$Path"
  }
  if ($null -ne $Body) {
    $parameters.Body = $Body | ConvertTo-Json -Depth 8 -Compress
    $parameters.ContentType = 'application/json; charset=utf-8'
  }
  return Invoke-RestMethod @parameters
}

$releaseDirectory = Join-Path $PSScriptRoot '..\outputs\releases'
$apkPath = Join-Path $releaseDirectory "zhuguang-android-private-$VersionName.apk"
$manifestPath = Join-Path $releaseDirectory "android-private-release-$VersionName.json"
$cloudflareConfigPath = Join-Path $env:USERPROFILE '.zhuguang\cloudflare\mobile-api-secrets.xml'

if (-not (Test-Path -LiteralPath $apkPath)) {
  throw "Release APK is missing at $apkPath"
}
if (-not (Test-Path -LiteralPath $manifestPath)) {
  throw "Release manifest is missing at $manifestPath"
}
if (-not (Test-Path -LiteralPath $cloudflareConfigPath)) {
  throw "Mobile API credentials are missing at $cloudflareConfigPath"
}

$manifest = Get-Content -Raw -Encoding utf8 -LiteralPath $manifestPath | ConvertFrom-Json
$file = Get-Item -LiteralPath $apkPath
$sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $apkPath).Hash.ToLowerInvariant()

if ($manifest.versionCode -ne $VersionCode -or $manifest.versionName -ne $VersionName) {
  throw 'Release manifest version does not match the requested version.'
}
if ($manifest.sizeBytes -ne $file.Length -or $manifest.sha256 -ne $sha256) {
  throw 'Release APK does not match its signed build manifest.'
}
if ($manifest.signature -ne 'release' -or $manifest.packageId -ne 'com.zhuguang.coachos') {
  throw 'Only the signed production package can be published.'
}

$cloudflare = Import-Clixml -LiteralPath $cloudflareConfigPath
$operatorSecret = Read-SecureValue $cloudflare.OPERATOR_API_SECRET
$pilotAppKey = Read-SecureValue $cloudflare.PILOT_APP_KEY
$operatorHeaders = @{
  'x-operator-actor' = 'xuzerui6@gmail.com'
  'x-operator-secret' = $operatorSecret
  'x-zhuguang-app-key' = $pilotAppKey
}

try {
  Write-Host "[release] Uploading $VersionName (code $VersionCode) to private R2 storage"
  $uploadHeaders = @{
    'content-type' = 'application/vnd.android.package-archive'
    'x-operator-actor' = 'xuzerui6@gmail.com'
    'x-operator-secret' = $operatorSecret
    'x-release-version-name' = $VersionName
    'x-zhuguang-app-key' = $pilotAppKey
  }
  $uploaded = Invoke-RestMethod `
    -Headers $uploadHeaders `
    -InFile $apkPath `
    -Method Put `
    -TimeoutSec 90 `
    -Uri "$ApiBaseUrl/api/v1/operator/releases/$VersionCode/artifact"

  if ($uploaded.data.sha256 -ne $sha256 -or $uploaded.data.sizeBytes -ne $file.Length) {
    throw 'R2 upload verification does not match the local APK.'
  }

  Write-Host '[release] Creating immutable release metadata'
  $release = @{
    certificateSha256 = $manifest.certificateSha256
    forced = $false
    minimumSupportedVersionCode = $MinimumSupportedVersionCode
    notes = $Notes
    objectKey = $uploaded.data.objectKey
    packageId = $manifest.packageId
    rolloutPercentage = $RolloutPercentage
    sha256 = $sha256
    sizeBytes = $file.Length
    versionCode = $VersionCode
    versionName = $VersionName
  }
  Invoke-OperatorJson -Method Post -Path '/api/v1/operator/releases' -Headers $operatorHeaders -Body $release | Out-Null

  Write-Host "[release] Publishing at $RolloutPercentage% rollout"
  Invoke-OperatorJson -Method Post -Path "/api/v1/operator/releases/$VersionCode/publish" -Headers $operatorHeaders -Body @{} | Out-Null

  if ($PauseVersionCode -gt 0) {
    Write-Host "[release] Pausing superseded code $PauseVersionCode"
    Invoke-OperatorJson -Method Post -Path "/api/v1/operator/releases/$PauseVersionCode/pause" -Headers $operatorHeaders -Body @{} | Out-Null
  }

  Write-Host "[release] Published $VersionName (code $VersionCode)"
  Write-Host "[release] SHA-256: $sha256"
  Write-Host "[release] Certificate SHA-256: $($manifest.certificateSha256)"
} finally {
  $operatorSecret = $null
  $pilotAppKey = $null
  $operatorHeaders = $null
}
