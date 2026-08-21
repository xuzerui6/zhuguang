param([string]$OutputDirectory = "media/remotion/zhuguang-story/public/audio")

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$lines = @(
  "专业训练，从真实目标开始。先说明项目、区域和你想达到的目标。",
  "查看经过确认的教练档案，比较经历、方向和服务是否适合。",
  "从咨询到教练确认，每一步都有状态，费用和安排清楚可查。",
  "课程结束不是终点。把每一次训练，变成持续可见的进步。"
)
$speaker = New-Object -ComObject SAPI.SpVoice
$speaker.Voice = $speaker.GetVoices() | Where-Object { $_.GetDescription() -like "*Huihui*" } | Select-Object -First 1
$speaker.Rate = -1
$speaker.Volume = 92
for ($index = 0; $index -lt $lines.Count; $index++) {
  $stream = New-Object -ComObject SAPI.SpFileStream
  $target = (Resolve-Path $OutputDirectory).Path + "\\scene-$($index + 1).wav"
  $stream.Open($target, 3, $false)
  $speaker.AudioOutputStream = $stream
  [void]$speaker.Speak($lines[$index])
  $stream.Close()
}

