[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$imagesPath = Join-Path $projectRoot 'images'
$outputPath = Join-Path $imagesPath 'icon.png'
New-Item -ItemType Directory -Force -Path $imagesPath | Out-Null

$source = [System.Drawing.Bitmap]::new(512, 512)
$graphics = [System.Drawing.Graphics]::FromImage($source)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

try {
    $background = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        [System.Drawing.PointF]::new(48, 32),
        [System.Drawing.PointF]::new(464, 480),
        [System.Drawing.ColorTranslator]::FromHtml('#4F46E5'),
        [System.Drawing.ColorTranslator]::FromHtml('#7C3AED')
    )
    $graphics.FillRectangle($background, 24, 24, 464, 464)

    $tableFill = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#F8FAFC'))
    $graphics.FillRectangle($tableFill, 82, 92, 348, 324)

    $headerFill = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#22D3EE'))
    $graphics.FillRectangle($headerFill, 82, 92, 348, 78)

    $gridPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#4338CA'), 14)
    $gridPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Miter
    $graphics.DrawRectangle($gridPen, 82, 92, 348, 324)
    foreach ($x in 198, 314) {
        $graphics.DrawLine($gridPen, $x, 92, $x, 416)
    }
    foreach ($y in 170, 252, 334) {
        $graphics.DrawLine($gridPen, 82, $y, 430, $y)
    }

    $funnel = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $funnel.AddPolygon(@(
            [System.Drawing.PointF]::new(296, 278),
            [System.Drawing.PointF]::new(458, 278),
            [System.Drawing.PointF]::new(402, 344),
            [System.Drawing.PointF]::new(402, 418),
            [System.Drawing.PointF]::new(352, 446),
            [System.Drawing.PointF]::new(352, 344)
        ))
    $funnelFill = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#FBBF24'))
    $funnelOutline = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#312E81'), 14)
    $funnelOutline.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $graphics.FillPath($funnelFill, $funnel)
    $graphics.DrawPath($funnelOutline, $funnel)

    $output = [System.Drawing.Bitmap]::new(128, 128)
    $outputGraphics = [System.Drawing.Graphics]::FromImage($output)
    try {
        $outputGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $outputGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $outputGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $outputGraphics.DrawImage($source, 0, 0, 128, 128)
        $output.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $outputGraphics.Dispose()
        $output.Dispose()
    }
}
finally {
    if ($funnelOutline) { $funnelOutline.Dispose() }
    if ($funnelFill) { $funnelFill.Dispose() }
    if ($funnel) { $funnel.Dispose() }
    if ($gridPen) { $gridPen.Dispose() }
    if ($headerFill) { $headerFill.Dispose() }
    if ($tableFill) { $tableFill.Dispose() }
    if ($background) { $background.Dispose() }
    $graphics.Dispose()
    $source.Dispose()
}

Write-Output $outputPath