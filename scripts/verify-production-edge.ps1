param(
  [string]$ApiBaseUrl = 'https://api.beijingzhuguang.top',
  [string]$SiteOrigin = 'https://beijingzhuguang.top',
  [string]$AccessTeamDomain = 'https://bitter-waterfall-065d.cloudflareaccess.com'
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
  $recovery = Send-Request $client ([System.Net.Http.HttpMethod]::Get) "$SiteOrigin/access-recovery"
  $recoveryLocation = $recovery.Headers.Location
  $accessOrigin = [Uri]$AccessTeamDomain

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
    WorkspaceProtected = $workspaceBody.Contains('/login?next=%2Fops') -and -not $workspaceBody.Contains('/api/v1/operator/overview')
    RecoveryStatus = [int]$recovery.StatusCode
    RecoveryProtected = $recoveryLocation.Host -eq $accessOrigin.Host -and $recoveryLocation.AbsolutePath.StartsWith('/cdn-cgi/access/login')
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
    $result.RecoveryStatus -ne 302 -or
    -not $result.RecoveryProtected -or
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
  foreach ($response in @($site, $workspace, $recovery, $www, $media, $cachedMedia, $allowedCors, $hostileCors)) {
    if ($null -ne $response) { $response.Dispose() }
  }
  $client.Dispose()
  $handler.Dispose()
  $appKey = $null
  $credentials = $null
}
