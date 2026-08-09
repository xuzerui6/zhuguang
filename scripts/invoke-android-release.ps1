param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d+\.\d+\.\d+$')]
  [string]$VersionName,

  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 2147483647)]
  [int]$VersionCode,

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

$signingDirectory = Join-Path $env:USERPROFILE '.zhuguang\signing'
$signingConfigPath = Join-Path $signingDirectory 'android-release.xml'
$cloudflareConfigPath = Join-Path $env:USERPROFILE '.zhuguang\cloudflare\mobile-api-secrets.xml'

if (-not (Test-Path -LiteralPath $signingConfigPath)) {
  throw "Android signing credentials are missing at $signingConfigPath"
}
if (-not (Test-Path -LiteralPath $cloudflareConfigPath)) {
  throw "Mobile API channel credentials are missing at $cloudflareConfigPath"
}

$signing = Import-Clixml -LiteralPath $signingConfigPath
$cloudflare = Import-Clixml -LiteralPath $cloudflareConfigPath

$env:ZHUGUANG_ANDROID_KEYSTORE = $signing.KeystorePath
$env:ZHUGUANG_ANDROID_KEY_ALIAS = $signing.Alias
$env:ZHUGUANG_ANDROID_STORE_PASSWORD = Read-SecureValue $signing.StorePassword
$env:ZHUGUANG_ANDROID_KEY_PASSWORD = Read-SecureValue $signing.KeyPassword
$env:ZHUGUANG_ANDROID_VERSION_NAME = $VersionName
$env:ZHUGUANG_ANDROID_VERSION_CODE = [string]$VersionCode
$env:ZHUGUANG_API_BASE_URL = $ApiBaseUrl
$env:ZHUGUANG_PILOT_APP_KEY = Read-SecureValue $cloudflare.PILOT_APP_KEY

try {
  & npm.cmd run mobile:android:release
  if ($LASTEXITCODE -ne 0) {
    throw "Android release build failed with exit code $LASTEXITCODE"
  }
} finally {
  Remove-Item Env:ZHUGUANG_ANDROID_STORE_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:ZHUGUANG_ANDROID_KEY_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:ZHUGUANG_PILOT_APP_KEY -ErrorAction SilentlyContinue
}
