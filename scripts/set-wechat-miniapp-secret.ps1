$ErrorActionPreference = 'Stop'

function Read-SecureValue([Security.SecureString]$Value) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function Set-WorkerSecret([string]$Name, [string]$Value) {
  if ($Name -notmatch '^[A-Z0-9_]+$') {
    throw 'Invalid Worker secret name.'
  }
  $npx = (Get-Command npx.cmd -ErrorAction Stop).Source
  $start = [Diagnostics.ProcessStartInfo]::new()
  $start.FileName = $env:ComSpec
  $start.WorkingDirectory = (Get-Location).Path
  $start.UseShellExecute = $false
  $start.RedirectStandardInput = $true
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  $start.Arguments = "/d /s /c `"`"$npx`" wrangler secret put $Name --config wrangler.mobile-api.jsonc`""
  $process = [Diagnostics.Process]::Start($start)
  $process.StandardInput.WriteLine($Value)
  $process.StandardInput.Close()
  if (-not $process.WaitForExit(60000)) {
    $process.Kill($true)
    throw "Timed out while setting $Name"
  }
  $errorOutput = $process.StandardError.ReadToEnd()
  if ($process.ExitCode -ne 0) {
    throw "Failed to set $Name. $errorOutput"
  }
}

$privateConfigPath = Join-Path (Get-Location) 'miniapp\project.private.config.json'
if (-not (Test-Path -LiteralPath $privateConfigPath)) {
  throw 'miniapp/project.private.config.json is missing.'
}
$privateConfig = Get-Content -LiteralPath $privateConfigPath -Raw | ConvertFrom-Json
$appId = [string]$privateConfig.appid
if ($appId -notmatch '^wx[a-fA-F0-9]{16}$') {
  throw 'The private mini program configuration does not contain a valid AppID.'
}

Write-Host 'Reset the exposed AppSecret in WeChat Public Platform before continuing.' -ForegroundColor Yellow
Write-Host 'Input is hidden and will not be written to the repository or logs.' -ForegroundColor Cyan
$secureSecret = Read-Host 'Enter the newly rotated AppSecret' -AsSecureString
$plainSecret = Read-SecureValue $secureSecret
if ($plainSecret -notmatch '^[a-fA-F0-9]{32}$') {
  throw 'The newly rotated AppSecret must contain 32 hexadecimal characters.'
}

try {
  Set-WorkerSecret 'WECHAT_MINIAPP_APP_ID' $appId
  Set-WorkerSecret 'WECHAT_MINIAPP_APP_SECRET' $plainSecret
  & powershell -NoProfile -ExecutionPolicy Bypass -File scripts\invoke-miniapp-build.ps1 -EnableWechatLogin
  if ($LASTEXITCODE -ne 0) {
    throw "Miniapp build failed with exit code $LASTEXITCODE"
  }
  Write-Host 'WeChat login configuration and the production miniapp build are complete.' -ForegroundColor Green
} finally {
  $plainSecret = $null
  $secureSecret = $null
}
