[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

Push-Location $projectRoot
try {
    $manifest = Get-Content -Raw -Path 'package.json' | ConvertFrom-Json
    $distPath = Join-Path $projectRoot 'dist'
    $outputPath = Join-Path $distPath "$($manifest.name)-$($manifest.version).vsix"

    New-Item -ItemType Directory -Force -Path $distPath | Out-Null
    Get-ChildItem -Path $distPath -Filter '*.vsix' -File | Remove-Item -Force
    npx --no-install vsce package --out $outputPath
    if ($LASTEXITCODE -ne 0) {
        throw "VSCE packaging failed with exit code $LASTEXITCODE."
    }

    Write-Host "Created $outputPath"
}
finally {
    Pop-Location
}