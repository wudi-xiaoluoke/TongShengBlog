$ErrorActionPreference = 'Stop'
$css = Get-Content -LiteralPath 'src\main\resources\static\css\home.css' -Encoding utf8 -Raw
$homeJs = Get-Content -LiteralPath 'src\main\resources\static\js\home.mjs' -Encoding utf8 -Raw
$template = Get-Content -LiteralPath 'src\main\resources\templates\home\index.html' -Encoding utf8 -Raw

if (-not $css.Contains('.music-toggle.music-playing{')) {
    throw 'Playing-state sway rule is missing from home.css.'
}
if (-not $css.Contains('animation:music-float 3.4s ease-in-out infinite;')) {
    throw 'music-float animation binding is missing from home.css.'
}
if (-not $css.Contains('@keyframes music-float')) {
    throw 'music-float keyframes are missing from home.css.'
}
if (-not $css.Contains('@media (prefers-reduced-motion:reduce)')) {
    throw 'Reduced-motion guard is missing from home.css.'
}
if (-not $homeJs.Contains("musicToggle.classList.toggle('music-playing', playing);")) {
    throw 'Playing-state class toggle is missing from home.mjs.'
}
if (-not $template.Contains("(v='20260905')")) {
    throw 'home.mjs cache version was not bumped in the home template.'
}
if ($template.Contains('id="music-toggle" class="music-toggle" hidden')) {
    throw 'Home music button must no longer start hidden.'
}
$idleIcon = [char]::ConvertFromUtf32(0x25B6)
if (-not $template.Contains(">$idleIcon<")) {
    throw 'Idle play icon is missing from the home music button.'
}

Write-Output 'Music sway verification passed.'
