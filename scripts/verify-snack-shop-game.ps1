$templatePath = 'src\main\resources\templates\game\index.html'
$cssPath = 'src\main\resources\static\css\game.css'
$scriptPaths = @(
    'src\main\resources\static\js\game\game-config.mjs',
    'src\main\resources\static\js\game\game-state.mjs',
    'src\main\resources\static\js\game\game-world.mjs',
    'src\main\resources\static\js\game\game-customer.mjs',
    'src\main\resources\static\js\game\game-scene.mjs',
    'src\main\resources\static\js\game\game-ui.mjs',
    'src\main\resources\static\js\game\main.mjs'
)
$assetPaths = @(
    'src\main\resources\static\images\game\snack-shop-empty-scene.png',
    'src\main\resources\static\images\game\shelf-empty.png',
    'src\main\resources\static\images\game\checkout-counter.png',
    'src\main\resources\static\images\game\characters.png',
    'src\main\resources\static\images\game\fixtures-and-products.png'
)

$template = Get-Content -LiteralPath $templatePath -Encoding utf8 -Raw
$requiredTokens = @(
    'id="snack-shop-canvas"',
    'id="inventory-panel"',
    'id="supply-panel"',
    'id="upgrades-panel"',
    'id="ledger-panel"',
    'id="customer-order"',
    'id="shelf-panel"',
    'id="restock-full"',
    'id="game-toast"',
    'id="reset-game-dialog"',
    'th:href="@{/css/game.css}"',
    'th:src="@{/js/game/main.mjs'
)

foreach ($token in $requiredTokens) {
    if (-not $template.Contains($token)) {
        throw "Missing game template token: $token"
    }
}
if ($template.Contains('小游戏建设中')) {
    throw 'Placeholder game copy is still present.'
}
if ($template.Contains('id="serve-customer"')) {
    throw 'Legacy manual serve action is still present.'
}

if (-not (Test-Path -LiteralPath $cssPath)) {
    throw 'Game stylesheet is missing.'
}
$css = Get-Content -LiteralPath $cssPath -Encoding utf8 -Raw
if (-not $css.Contains('image-rendering:pixelated')) {
    throw 'Pixelated rendering rule is missing.'
}

foreach ($path in $scriptPaths + $assetPaths) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Required game file is missing: $path"
    }
}

Write-Output 'Snack shop game structure verification passed.'
