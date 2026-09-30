param(
  [string]$ApiOrigin = 'https://api.beijingzhuguang.top',
  [switch]$EnableWechatLogin,
  [switch]$EnableFuzzyLocation
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

function Invoke-Checked([string]$Script) {
  & npm.cmd run $Script
  if ($LASTEXITCODE -ne 0) {
    throw "$Script failed with exit code $LASTEXITCODE"
  }
}

if ($ApiOrigin -ne 'https://api.beijingzhuguang.top') {
  throw 'The production miniapp API origin must be https://api.beijingzhuguang.top'
}

$credentialPath = Join-Path $env:USERPROFILE '.zhuguang\cloudflare\mobile-api-secrets.xml'
if (-not (Test-Path -LiteralPath $credentialPath)) {
  throw "Mobile API channel credentials are missing at $credentialPath"
}

$credentials = Import-Clixml -LiteralPath $credentialPath
if (-not $credentials.PILOT_APP_KEY) {
  throw 'PILOT_APP_KEY is missing from the encrypted mobile API credentials'
}

$env:TARO_APP_API_ORIGIN = $ApiOrigin
$env:TARO_APP_CHANNEL_KEY = Read-SecureValue $credentials.PILOT_APP_KEY
$env:TARO_APP_WECHAT_LOGIN_ENABLED = if ($EnableWechatLogin) { 'true' } else { 'false' }
$env:TARO_APP_FUZZY_LOCATION_ENABLED = if ($EnableFuzzyLocation) { 'true' } else { 'false' }

try {
  Invoke-Checked 'miniapp:typecheck'
  Invoke-Checked 'miniapp:build'
  Invoke-Checked 'miniapp:check'
} finally {
  Remove-Item Env:TARO_APP_API_ORIGIN -ErrorAction SilentlyContinue
  Remove-Item Env:TARO_APP_CHANNEL_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:TARO_APP_WECHAT_LOGIN_ENABLED -ErrorAction SilentlyContinue
  Remove-Item Env:TARO_APP_FUZZY_LOCATION_ENABLED -ErrorAction SilentlyContinue
}
