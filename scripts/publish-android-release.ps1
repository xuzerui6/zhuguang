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

  [Parameter(Mandatory = $true)]
  [ValidateLength(4, 500)]
  [string]$Reason,

  [string]$ApiBaseUrl = 'https://api.beijingzhuguang.top'
)

$ErrorActionPreference = 'Stop'
if ([uri]$ApiBaseUrl | Where-Object { $_.Scheme -ne 'https' -or $_.UserInfo }) { throw 'Use an HTTPS API origin without credentials.' }

function Save-ReleaseJournal {
  $journal | Export-Clixml -LiteralPath $journalPath -Force
}

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
    $Body.confirmed = $true
    $Body.reason = $Reason
    $parameters.Headers = @{} + $Headers
    $ordered = [ordered]@{}
    foreach ($name in ($Body.Keys | Sort-Object)) { $ordered[$name] = $Body[$name] }
    $payload = $ordered | ConvertTo-Json -Depth 8 -Compress
    $operation = "$Method $Path"
    if ($journal.operations.ContainsKey($operation)) {
      if ($journal.operations[$operation].payload -ne $payload) { throw 'Existing operation has different parameters. Inspect the saved journal before retrying.' }
    } else {
      $journal.operations[$operation] = @{ key = [guid]::NewGuid().ToString(); payload = $payload }
      Save-ReleaseJournal
    }
    $parameters.Headers['idempotency-key'] = $journal.operations[$operation].key
    $parameters.Body = $journal.operations[$operation].payload
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

$journalDirectory = Join-Path $env:USERPROFILE '.zhuguang\release-journals'
New-Item -ItemType Directory -Path $journalDirectory -Force | Out-Null
$journalPath = Join-Path $journalDirectory "code-$VersionCode-$sha256.xml"
$journal = if (Test-Path -LiteralPath $journalPath) { Import-Clixml -LiteralPath $journalPath } else { @{ api = $ApiBaseUrl; operations = @{}; upload = $null } }
if ($journal.api -ne $ApiBaseUrl) { throw 'Release journal belongs to a different API. Do not reuse it across environments.' }

$cloudflare = Import-Clixml -LiteralPath $cloudflareConfigPath
$operatorSecret = Read-SecureValue $cloudflare.OPERATOR_API_SECRET
$pilotAppKey = Read-SecureValue $cloudflare.PILOT_APP_KEY
$operatorHeaders = @{
  'x-operator-actor' = 'xuzerui6@gmail.com'
  'x-operator-secret' = $operatorSecret
  'x-zhuguang-app-key' = $pilotAppKey
}

function Invoke-ReleaseUpload {
  $uploadHeaders = @{
    'content-type' = 'application/vnd.android.package-archive'
    'x-operator-actor' = 'xuzerui6@gmail.com'
    'x-operator-secret' = $operatorSecret
    'x-release-version-name' = $VersionName
    'x-zhuguang-app-key' = $pilotAppKey
  }
  $result = Invoke-RestMethod `
    -Headers $uploadHeaders `
    -InFile $apkPath `
    -Method Put `
    -TimeoutSec 90 `
    -Uri "$ApiBaseUrl/api/v1/operator/releases/$VersionCode/artifact"
  if ($result.data.sha256 -ne $sha256 -or $result.data.sizeBytes -ne $file.Length -or $result.data.versionCode -ne $VersionCode -or $result.data.versionName -ne $VersionName) {
    throw 'R2 upload verification does not match the local signed build manifest.'
  }
  $journal.upload = $result
  Save-ReleaseJournal
  return $result
}

try {
  Write-Host "[release] Uploading $VersionName (code $VersionCode) to private R2 storage"
  $uploaded = $journal.upload
  if ($null -eq $uploaded) {
    $uploaded = Invoke-ReleaseUpload
  }

  if ($uploaded.data.sha256 -ne $sha256 -or $uploaded.data.sizeBytes -ne $file.Length -or $uploaded.data.versionCode -ne $VersionCode -or $uploaded.data.versionName -ne $VersionName) {
    throw 'Saved upload receipt does not match the local signed build manifest.'
  }

  Write-Host '[release] Creating immutable release metadata'
  $createPath = '/api/v1/operator/releases'
  $createOperation = "Post $createPath"
  $createAttempts = 0
  while ($true) {
    $createAttempts += 1
    $release = @{
      certificateSha256 = $manifest.certificateSha256
      forced = $false
      minimumSupportedVersionCode = $MinimumSupportedVersionCode
      notes = $Notes
      receiptId = $uploaded.data.receiptId
      rolloutPercentage = $RolloutPercentage
    }
    try {
      Invoke-OperatorJson -Method Post -Path $createPath -Headers $operatorHeaders -Body $release | Out-Null
      break
    } catch {
      $failure = "$($_.Exception.Message) $($_.ErrorDetails.Message)"
      $recoverableReceipt = $failure -match 'upload_receipt_invalid|release_artifact_mismatch'
      if (-not $recoverableReceipt -or $createAttempts -ge 2) { throw }
      Write-Host '[release] Upload receipt expired or no longer matches storage; uploading once more with a new operation key'
      $journal.upload = $null
      $journal.operations.Remove($createOperation)
      Save-ReleaseJournal
      $uploaded = Invoke-ReleaseUpload
    }
  }

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
