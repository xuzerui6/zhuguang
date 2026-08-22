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
  'x-operator-actor' = 'xuzerui6@gmail.com'
  'x-operator-secret' = $operatorSecret
  'x-zhuguang-app-key' = $appKey
}

try {
  $health = Invoke-RestMethod -Headers $headers -Method Get -TimeoutSec 15 -Uri "$ApiBaseUrl/api/v1/health"
  $catalog = Invoke-RestMethod -Headers $headers -Method Get -TimeoutSec 15 -Uri "$ApiBaseUrl/api/v1/coaches"
  $normalizedCatalog = Invoke-RestMethod -Headers $headers -Method Get -TimeoutSec 15 -Uri "$ApiBaseUrl/api/v1/coaches?sport=%E7%94%B0%E8%B5%9B&district=%E5%8C%97%E4%BA%AC%E5%B8%82%E9%80%9A%E5%B7%9E&goal=%E4%B8%AD%E8%80%83&audience=%E9%9D%92%E5%B0%91%E5%B9%B4"
  $coaches = @($catalog.data)
  $districts = @($coaches | ForEach-Object district | Sort-Object -Unique)
  $sports = @($coaches | ForEach-Object sport | Sort-Object -Unique)
  $realProfiles = @($coaches | Where-Object profileKind -eq 'real')
  if (
    @($normalizedCatalog.data).Count -lt 1 -or
    $normalizedCatalog.meta.appliedFilters.sport -ne [regex]::Unescape('\u7530\u5f84') -or
    $normalizedCatalog.meta.appliedFilters.district -ne [regex]::Unescape('\u901a\u5dde\u533a') -or
    $normalizedCatalog.meta.appliedFilters.goal -ne [regex]::Unescape('\u4e2d\u8003\u4f53\u80b2') -or
    $normalizedCatalog.meta.appliedFilters.audience -ne [regex]::Unescape('\u9752\u5c11\u5e74\u513f\u7ae5')
  ) {
    throw 'Production coach filter normalization failed.'
  }

  $media = Invoke-WebRequest -Headers $headers -Method Get -TimeoutSec 15 -UseBasicParsing -Uri "$ApiBaseUrl/api/v1/media/coaches/6/avatar"
  $body = @{ reason = 'Release QA visibility check'; status = 'offline' } | ConvertTo-Json -Compress
  $null = Invoke-RestMethod -Body $body -Headers $operatorHeaders -Method Patch -TimeoutSec 15 -Uri "$ApiBaseUrl/api/v1/operator/coaches/18/listing"
  $hiddenCatalog = Invoke-RestMethod -Headers $headers -Method Get -TimeoutSec 15 -Uri "$ApiBaseUrl/api/v1/coaches"
  try {
    $null = Invoke-WebRequest -Headers $headers -Method Get -TimeoutSec 15 -UseBasicParsing -Uri "$ApiBaseUrl/api/v1/coaches/18"
    throw 'Offline coach detail unexpectedly remained public.'
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -notin @(404, 410)) { throw }
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
    NormalizedFilterCount = @($normalizedCatalog.data).Count
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
