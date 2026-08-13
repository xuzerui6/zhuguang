param(
  [string]$ApiBaseUrl = 'https://api.beijingzhuguang.top',
  [string]$SiteOrigin = 'https://beijingzhuguang.top'
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

function Send-Request(
  [System.Net.Http.HttpClient]$Client,
  [System.Net.Http.HttpMethod]$Method,
  [string]$Uri,
  [hashtable]$Headers = @{}
) {
  $request = [System.Net.Http.HttpRequestMessage]::new($Method, $Uri)
  try {
    foreach ($entry in $Headers.GetEnumerator()) {
      $null = $request.Headers.TryAddWithoutValidation($entry.Key, [string]$entry.Value)
    }
    return $Client.SendAsync($request).GetAwaiter().GetResult()
  } finally {
    $request.Dispose()
  }
}

Add-Type -AssemblyName System.Net.Http
$credentialPath = Join-Path $env:USERPROFILE '.zhuguang\cloudflare\mobile-api-secrets.xml'
$credentials = Import-Clixml -LiteralPath $credentialPath
$appKey = Read-SecureValue $credentials.PILOT_APP_KEY
$handler = [System.Net.Http.HttpClientHandler]::new()
$handler.AllowAutoRedirect = $false
$client = [System.Net.Http.HttpClient]::new($handler)
$client.Timeout = [TimeSpan]::FromSeconds(15)
$client.DefaultRequestHeaders.UserAgent.ParseAdd('ZhuguangReleaseQA/1.0')

try {
  $site = Send-Request $client ([System.Net.Http.HttpMethod]::Get) "$SiteOrigin/"
  $siteBody = $site.Content.ReadAsStringAsync().GetAwaiter().GetResult()

  $workspace = Send-Request $client ([System.Net.Http.HttpMethod]::Get) "$SiteOrigin/ops"
  $workspaceBody = $workspace.Content.ReadAsStringAsync().GetAwaiter().GetResult()

  $www = Send-Request $client ([System.Net.Http.HttpMethod]::Get) 'https://www.beijingzhuguang.top/coaches/7?from=www'

  $mediaHeaders = @{ 'x-zhuguang-app-key' = $appKey }
  $media = Send-Request $client ([System.Net.Http.HttpMethod]::Get) "$ApiBaseUrl/api/v1/media/coaches/6/avatar" $mediaHeaders
  $etag = $media.Headers.ETag.Tag
  $cachedHeaders = @{ 'if-none-match' = $etag; 'x-zhuguang-app-key' = $appKey }
  $cachedMedia = Send-Request $client ([System.Net.Http.HttpMethod]::Get) "$ApiBaseUrl/api/v1/media/coaches/6/avatar" $cachedHeaders

  $preflightHeaders = @{
    'access-control-request-headers' = 'x-zhuguang-app-key'
    'access-control-request-method' = 'GET'
    origin = $SiteOrigin
  }
  $allowedCors = Send-Request $client ([System.Net.Http.HttpMethod]::Options) "$ApiBaseUrl/api/v1/coaches" $preflightHeaders
  $hostileHeaders = $preflightHeaders.Clone()
  $hostileHeaders.origin = 'https://example.invalid'
  $hostileCors = Send-Request $client ([System.Net.Http.HttpMethod]::Options) "$ApiBaseUrl/api/v1/coaches" $hostileHeaders

  $result = [pscustomobject]@{
    SiteStatus = [int]$site.StatusCode
    SiteBrandPresent = $siteBody.Contains('href="/coaches"')
    WorkspaceStatus = [int]$workspace.StatusCode
    WorkspaceProtected = $workspaceBody.Contains('href="/login?next=') -and -not $workspaceBody.Contains('listing-status-control')
    WwwStatus = [int]$www.StatusCode
    WwwLocation = $www.Headers.Location.AbsoluteUri
    MediaStatus = [int]$media.StatusCode
    MediaETag = $etag
    MediaCacheStatus = [int]$cachedMedia.StatusCode
    AllowedCorsOrigin = $allowedCors.Headers.GetValues('access-control-allow-origin') -join ','
    HostileCorsRejected = -not $hostileCors.Headers.Contains('access-control-allow-origin')
  }

  if (
    $result.SiteStatus -ne 200 -or
    -not $result.SiteBrandPresent -or
    $result.WorkspaceStatus -ne 200 -or
    -not $result.WorkspaceProtected -or
    $result.WwwStatus -ne 301 -or
    $result.WwwLocation -ne "$SiteOrigin/coaches/7?from=www" -or
    $result.MediaStatus -ne 200 -or
    $result.MediaCacheStatus -ne 304 -or
    $result.AllowedCorsOrigin -ne $SiteOrigin -or
    -not $result.HostileCorsRejected
  ) {
    throw "Production edge verification failed: $($result | ConvertTo-Json -Compress)"
  }

  $result
} finally {
  foreach ($response in @($site, $workspace, $www, $media, $cachedMedia, $allowedCors, $hostileCors)) {
    if ($null -ne $response) { $response.Dispose() }
  }
  $client.Dispose()
  $handler.Dispose()
  $appKey = $null
  $credentials = $null
}
