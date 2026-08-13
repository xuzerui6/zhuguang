param(
  [string]$ConfigPath = "wrangler.mobile-api.jsonc"
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$imageRoot = Join-Path $root 'public\images'
$desktop = [Environment]::GetFolderPath('Desktop')
$zhangFile = (-join @([char]0x5f20, [char]0x5c55, [char]0x7941)) + '.jpg'
$haoFile = (-join @([char]0x90dd, [char]0x5065, [char]0x58ee)) + '.jpg'

$uploads = @(
  @{ Source = Join-Path $desktop $zhangFile; Key = 'coaches/6/private/original.jpg'; Type = 'image/jpeg'; Cache = 'private, no-store' },
  @{ Source = Join-Path $desktop $haoFile; Key = 'coaches/7/private/original.jpg'; Type = 'image/jpeg'; Cache = 'private, no-store' }
)

foreach ($coach in @(
  @{ Id = 6; Prefix = 'coach-zhang-zhanqi' },
  @{ Id = 7; Prefix = 'coach-hao-jianzhuang' }
)) {
  foreach ($kind in @('avatar', 'card', 'hero')) {
    foreach ($format in @('webp', 'avif')) {
      $uploads += @{
        Source = Join-Path $imageRoot "$($coach.Prefix)-$kind.$format"
        Key = "coaches/$($coach.Id)/public/$kind-v1.$format"
        Type = "image/$format"
        Cache = 'public, max-age=31536000, immutable'
      }
    }
  }
}

foreach ($format in @('webp', 'avif')) {
  $uploads += @{
    Source = Join-Path $imageRoot "coach-xu-zerui-portrait.$format"
    Key = "coaches/5/public/card-v1.$format"
    Type = "image/$format"
    Cache = 'public, max-age=31536000, immutable'
  }
  foreach ($sport in @('athletics', 'badminton', 'swimming', 'tennis', 'basketball', 'conditioning')) {
    $uploads += @{
      Source = Join-Path $imageRoot "demo-$sport.$format"
      Key = "coaches/demo/public/$sport-v1.$format"
      Type = "image/$format"
      Cache = 'public, max-age=31536000, immutable'
    }
  }
}

foreach ($upload in $uploads) {
  if (-not (Test-Path -LiteralPath $upload.Source)) {
    throw "Coach media source is missing: $($upload.Source)"
  }
  & npx.cmd wrangler r2 object put "zhuguang-coach-media/$($upload.Key)" `
    --file $upload.Source `
    --remote `
    --content-type $upload.Type `
    --cache-control $upload.Cache `
    --force `
    --config $ConfigPath
  if ($LASTEXITCODE -ne 0) {
    throw "R2 upload failed for $($upload.Key)"
  }
}

Write-Host "Uploaded $($uploads.Count) private/public coach media objects."
