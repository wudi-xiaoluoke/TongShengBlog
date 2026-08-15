$emojiEye = [char]::ConvertFromUtf32(0x1F440)
$homeTemplate = Get-Content -LiteralPath 'src\main\resources\templates\home\index.html' -Encoding utf8 -Raw
$detailTemplate = Get-Content -LiteralPath 'src\main\resources\templates\article\detail.html' -Encoding utf8 -Raw
$css = Get-Content -LiteralPath 'src\main\resources\static\css\home.css' -Encoding utf8 -Raw

foreach ($entry in @(
    @{ Name = 'home template'; Content = $homeTemplate },
    @{ Name = 'detail template'; Content = $detailTemplate }
)) {
    if ($entry.Content.Contains($emojiEye)) {
        throw "Emoji eye remains in $($entry.Name)."
    }
    if (-not $entry.Content.Contains('class="views-icon"')) {
        throw "SVG eye icon is missing from $($entry.Name)."
    }
    if (-not $entry.Content.Contains('aria-hidden="true"')) {
        throw "Decorative SVG accessibility marker is missing from $($entry.Name)."
    }
}

if (-not $homeTemplate.Contains('th:text="${n.views == null ? 0 : n.views}"')) {
    throw 'Home view count expression changed or is missing.'
}
if (-not $detailTemplate.Contains('th:text="${article.views}"')) {
    throw 'Detail view count expression changed or is missing.'
}
if (-not $css.Contains('.views-icon{width:14px;height:14px;fill:none;stroke:currentColor;')) {
    throw 'Shared SVG eye styling is missing.'
}

Write-Output 'View count SVG icon verification passed.'
