[CmdletBinding()]
param(
    [string]$VsixPath
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

if (-not $VsixPath) {
    $VsixPath = Get-ChildItem -Path (Join-Path $projectRoot 'dist') -Filter '*.vsix' |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}

if (-not $VsixPath -or -not (Test-Path -LiteralPath $VsixPath)) {
    throw 'No VSIX was found. Run .\scripts\Build-Extension.ps1 first, or pass -VsixPath.'
}

& code --install-extension $VsixPath --force
if ($LASTEXITCODE -ne 0) {
    throw "VS Code extension installation failed with exit code $LASTEXITCODE."
}