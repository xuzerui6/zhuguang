param(
  [ValidatePattern('^\d+\.\d+\.\d+$')]
  [string]$VersionName = '1.3.4',

  [ValidateRange(1, 2147483647)]
  [int]$VersionCode = 19,

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

$configPath = Join-Path $env:USERPROFILE '.zhuguang\cloudflare\mobile-api-secrets.xml'
if (-not (Test-Path -LiteralPath $configPath)) {
  throw "Mobile API channel credentials are missing at $configPath"
}

$config = Import-Clixml -LiteralPath $configPath
$env:ZHUGUANG_IOS_VERSION_NAME = $VersionName
$env:ZHUGUANG_IOS_VERSION_CODE = [string]$VersionCode
$env:ZHUGUANG_API_BASE_URL = $ApiBaseUrl
$env:VITE_PILOT_APP_KEY = Read-SecureValue $config.PILOT_APP_KEY

try {
  & npm.cmd run mobile:ios:sync
  if ($LASTEXITCODE -ne 0) { throw "iOS source sync failed with exit code $LASTEXITCODE" }
} finally {
  Remove-Item Env:VITE_PILOT_APP_KEY -ErrorAction SilentlyContinue
}
