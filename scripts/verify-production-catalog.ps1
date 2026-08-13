param(
  [string]$ApiBaseUrl = 'https://api.beijingzhuguang.top'
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

$credentialPath = Join-Path $env:USERPROFILE '.zhuguang\cloudflare\mobile-api-secrets.xml'
$credentials = Import-Clixml -LiteralPath $credentialPath
$appKey = Read-SecureValue $credentials.PILOT_APP_KEY
$operatorSecret = Read-SecureValue $credentials.OPERATOR_API_SECRET
$headers = @{ 'x-zhuguang-app-key' = $appKey }
$operatorHeaders = @{
  'content-type' = 'application/json; charset=utf-8'
  'x-operator-actor' = 'release-qa'
  'x-operator-secret' = $operatorSecret
  'x-zhuguang-app-key' = $appKey
}

try {
  $health = Invoke-RestMethod -Headers $headers -Method Get -TimeoutSec 15 -Uri "$ApiBaseUrl/api/v1/health"
  $catalog = Invoke-RestMethod -Headers $headers -Method Get -TimeoutSec 15 -Uri "$ApiBaseUrl/api/v1/coaches"
  $coaches = @($catalog.data)
  $districts = @($coaches | ForEach-Object district | Sort-Object -Unique)
  $sports = @($coaches | ForEach-Object sport | Sort-Object -Unique)
  $realProfiles = @($coaches | Where-Object profileKind -eq 'real')

  $media = Invoke-WebRequest -Headers $headers -Method Get -TimeoutSec 15 -UseBasicParsing -Uri "$ApiBaseUrl/api/v1/media/coaches/6/avatar"
  $body = @{ reason = 'Release QA visibility check'; status = 'offline' } | ConvertTo-Json -Compress
  $null = Invoke-RestMethod -Body $body -Headers $operatorHeaders -Method Patch -TimeoutSec 15 -Uri "$ApiBaseUrl/api/v1/operator/coaches/18/listing"
  $hiddenCatalog = Invoke-RestMethod -Headers $headers -Method Get -TimeoutSec 15 -Uri "$ApiBaseUrl/api/v1/coaches"
  try {
    $null = Invoke-WebRequest -Headers $headers -Method Get -TimeoutSec 15 -UseBasicParsing -Uri "$ApiBaseUrl/api/v1/coaches/18"
    throw 'Offline coach detail unexpectedly remained public.'
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 410) { throw }
  }
  $history = Invoke-RestMethod -Headers $operatorHeaders -Method Get -TimeoutSec 15 -Uri "$ApiBaseUrl/api/v1/operator/coaches/18/events"

  [pscustomobject]@{
    Database = $health.data.database
    Media = $health.data.media
    Releases = $health.data.releases
    CoachCount = $coaches.Count
    RealProfileCount = $realProfiles.Count
    DistrictCount = $districts.Count
    SportCount = $sports.Count
    HiddenCount = @($hiddenCatalog.data).Count
    MediaStatus = $media.StatusCode
    MediaETag = $media.Headers.ETag
    ListingEvent = $history.data[0].event_type
  }
} finally {
  try {
    $restore = @{ reason = 'Release QA completed'; status = 'online' } | ConvertTo-Json -Compress
    $null = Invoke-RestMethod -Body $restore -Headers $operatorHeaders -Method Patch -TimeoutSec 15 -Uri "$ApiBaseUrl/api/v1/operator/coaches/18/listing"
  } catch {
    Write-Warning 'Automatic listing restoration failed; coach 18 must be restored manually.'
  }
  $appKey = $null
  $operatorSecret = $null
  $credentials = $null
}
