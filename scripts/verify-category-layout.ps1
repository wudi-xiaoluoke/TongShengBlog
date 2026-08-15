$template = Get-Content -LiteralPath 'src\main\resources\templates\admin\categories.html' -Raw
$css = Get-Content -LiteralPath 'src\main\resources\static\css\admin.css' -Raw

$requiredTemplateTokens = @(
    'class="category-table"',
    'class="category-sort-input"',
    'class="category-name-input"',
    'class="category-description-input"',
    'class="actions category-actions"'
)

$requiredCssTokens = @(
    '.category-table{min-width:760px;table-layout:fixed}',
    '.category-actions{flex-wrap:nowrap;justify-content:flex-start}',
    '.category-table tbody td{height:62px;vertical-align:middle}',
    '.category-description-input{width:100%}'
)

foreach ($token in $requiredTemplateTokens) {
    if (-not $template.Contains($token)) {
        throw "Missing category template layout token: $token"
    }
}

foreach ($token in $requiredCssTokens) {
    if (-not $css.Contains($token)) {
        throw "Missing category CSS layout token: $token"
    }
}

if ($template.Contains('<th style="width:70px;">')) {
    throw 'Legacy inline category column width is still present.'
}

Write-Output 'Category table layout verification passed.'
