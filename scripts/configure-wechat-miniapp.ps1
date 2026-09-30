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
  $output = $process.StandardOutput.ReadToEnd()
  $errorOutput = $process.StandardError.ReadToEnd()
  if ($process.ExitCode -ne 0) {
    throw "Failed to set $Name. $errorOutput"
  }
  if ($output -match 'Success|secret') {
    Write-Host "$Name configured." -ForegroundColor Green
  }
}

$appId = (Read-Host 'Paste the public WeChat Mini Program AppID').Trim()
if ($appId -notmatch '^wx[a-fA-F0-9]{16}$') {
  throw 'The AppID must start with wx followed by 16 hexadecimal characters.'
}
$secureSecret = Read-Host 'Paste a newly rotated AppSecret (input is hidden)' -AsSecureString
$plainSecret = Read-SecureValue $secureSecret
if ($plainSecret -notmatch '^[a-fA-F0-9]{32}$') {
  throw 'The newly rotated AppSecret must contain 32 hexadecimal characters.'
}

try {
  $privateConfig = @{
    appid = $appId
    projectname = 'zhuguang-wechat-miniapp'
  } | ConvertTo-Json
  [IO.File]::WriteAllText((Join-Path (Get-Location) 'miniapp\project.private.config.json'), $privateConfig, [Text.UTF8Encoding]::new($false))
  Set-WorkerSecret 'WECHAT_MINIAPP_APP_ID' $appId
  Set-WorkerSecret 'WECHAT_MINIAPP_APP_SECRET' $plainSecret
  & powershell -NoProfile -ExecutionPolicy Bypass -File scripts\invoke-miniapp-build.ps1 -EnableWechatLogin
  if ($LASTEXITCODE -ne 0) {
    throw "Miniapp build failed with exit code $LASTEXITCODE"
  }
  Write-Host 'WeChat Mini Program configuration and production build completed.' -ForegroundColor Green
} finally {
  $plainSecret = $null
  $secureSecret = $null
}
