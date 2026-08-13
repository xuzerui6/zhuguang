param(
  [string]$ConfigPath = "dist\server\wrangler.web.json"
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
if (-not (Test-Path -LiteralPath $credentialPath)) {
  throw "Cloudflare credentials are missing at $credentialPath"
}
if (-not (Test-Path -LiteralPath $ConfigPath)) {
  throw "Prepared Worker config is missing at $ConfigPath"
}

$credentials = Import-Clixml -LiteralPath $credentialPath
$secrets = @{
  ZHUGUANG_OPERATOR_API_SECRET = Read-SecureValue $credentials.OPERATOR_API_SECRET
  ZHUGUANG_PILOT_APP_KEY = Read-SecureValue $credentials.PILOT_APP_KEY
}

try {
  foreach ($name in $secrets.Keys) {
    $secrets[$name] | & npx.cmd wrangler secret put $name --config $ConfigPath
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to configure Worker secret $name"
    }
  }
} finally {
  foreach ($name in @($secrets.Keys)) { $secrets[$name] = $null }
  $credentials = $null
}
