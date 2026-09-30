$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$directory = Join-Path $env:USERPROFILE '.zhuguang\backups'
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$directory = [IO.Path]::GetFullPath($directory)
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $directory /inheritance:r /grant:r "${identity}:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Failed to restrict backup permissions' }
$plain = Join-Path $directory ("mobile-api-before-0025-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.sql')
$encrypted = $plain + '.dpapi'
try {
  $exportOutput = & node scripts/run-bounded.mjs 90000 node node_modules/wrangler/bin/wrangler.js d1 export zhuguang-mobile-api --remote --config wrangler.mobile-api.jsonc --output $plain 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'D1 export failed' }
  $bytes = [IO.File]::ReadAllBytes($plain)
  $protected = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  [IO.File]::WriteAllBytes($encrypted, $protected)
  $restored = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($encrypted), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  if ([Convert]::ToBase64String($restored) -cne [Convert]::ToBase64String($bytes)) { throw 'Encrypted backup verification failed' }
  & node scripts/run-bounded.mjs 30000 node scripts/verify-multicity-backup.mjs $plain
  if ($LASTEXITCODE -ne 0) { throw 'D1 restore or migration verification failed; encrypted backup retained' }
  Write-Host "Verified encrypted D1 backup: $encrypted"
} finally {
  if (Test-Path -LiteralPath $plain) {
    $resolved = [IO.Path]::GetFullPath($plain)
    if (-not $resolved.StartsWith($directory + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe backup cleanup target' }
    Remove-Item -LiteralPath $resolved -Force
  }
  if ($bytes) { [Array]::Clear($bytes,0,$bytes.Length) }
  if ($restored) { [Array]::Clear($restored,0,$restored.Length) }
}
