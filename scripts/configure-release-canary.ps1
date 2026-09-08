param(
  [Parameter(Mandatory = $true)][ValidateRange(1, 2147483647)][int]$VersionCode,
  [ValidateRange(1, 24)][int]$Hours = 2
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$wrangler = Join-Path $root 'node_modules/wrangler/bin/wrangler.js'
$bounded = Join-Path $root 'scripts/run-bounded.mjs'
$config = Join-Path $root 'wrangler.mobile-api.jsonc'
# Only the primary operator's already bound Android installation can be selected.
$sql = "SELECT i.id FROM app_installations i JOIN coaches c ON c.user_id=i.user_id WHERE c.id=5 AND i.platform='android' AND i.status='active' AND i.last_seen_at > (unixepoch()*1000-86400000)"
$raw = & node $bounded 45000 node $wrangler d1 execute zhuguang-mobile-api --remote --config $config --json --command $sql
if ($LASTEXITCODE -ne 0) { throw 'Installation lookup failed.' }
$rows = @(($raw | ConvertFrom-Json).results)
if ($rows.Count -ne 1) { throw 'Expected exactly one recently active operator Android installation. No canary was configured.' }
$hash = [Security.Cryptography.SHA256]::Create()
try {
  $digest = [BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($rows[0].id))).Replace('-', '').ToLowerInvariant()
} finally { $hash.Dispose() }
$expires = [DateTimeOffset]::UtcNow.AddHours($Hours)
$payload = @{ versionCode=$VersionCode; installationSha256=$digest; expiresAt=$expires.ToUnixTimeMilliseconds() } | ConvertTo-Json -Compress
$payload | & node $bounded 45000 node $wrangler secret put RELEASE_CANARY_JSON --config $config
if ($LASTEXITCODE -ne 0) { throw 'Canary configuration failed.' }
Write-Host "Canary version $VersionCode expires $($expires.ToString('o')); public rollout unchanged."
$payload = $null
$raw = $null
$rows = $null
