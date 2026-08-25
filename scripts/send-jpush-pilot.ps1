param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^device_[A-Za-z0-9-]+$')]
  [string]$InstallationId,

  [Parameter(Mandatory = $true)]
  [ValidateSet('booking', 'message', 'update')]
  [string]$Type,

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

$credentialsPath = Join-Path $env:USERPROFILE '.zhuguang\cloudflare\mobile-api-secrets.xml'
if (-not (Test-Path -LiteralPath $credentialsPath)) {
  throw "Mobile API credentials are missing at $credentialsPath"
}

$credentials = Import-Clixml -LiteralPath $credentialsPath
$operatorSecret = Read-SecureValue $credentials.OPERATOR_API_SECRET
$pilotAppKey = Read-SecureValue $credentials.PILOT_APP_KEY
try {
  $response = Invoke-RestMethod `
    -Body (@{ installationId = $InstallationId; type = $Type } | ConvertTo-Json -Compress) `
    -ContentType 'application/json; charset=utf-8' `
    -Headers @{
      'x-operator-actor' = 'xuzerui6@gmail.com'
      'x-operator-secret' = $operatorSecret
      'x-zhuguang-app-key' = $pilotAppKey
    } `
    -Method Post `
    -TimeoutSec 30 `
    -Uri "$ApiBaseUrl/api/v1/operator/push/test"

  [pscustomobject]@{
    Accepted = $response.data.accepted
    Channel = $response.data.channelId
    DeepLink = $response.data.deepLink
    ProviderMessageId = $response.data.messageId
    Type = $response.data.type
  }
} finally {
  $operatorSecret = $null
  $pilotAppKey = $null
}
