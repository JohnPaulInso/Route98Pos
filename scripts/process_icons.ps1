Add-Type -AssemblyName System.Drawing

$rootDir = Split-Path -Parent $PSScriptRoot
$srcLogoPath = Join-Path $rootDir "route98_logo.png"
$resDir = Join-Path $rootDir "android\app\src\main\res"

if (-not (Test-Path $srcLogoPath)) {
    Write-Error "route98_logo.png not found at $srcLogoPath"
    exit 1
}

$srcImage = [System.Drawing.Image]::FromFile($srcLogoPath)

function Create-PaddedIcon {
    param(
        [System.Drawing.Image]$Source,
        [int]$Width,
        [int]$Height,
        [double]$ScaleRatio = 0.72,
        [string]$BgColorHex = "#FFFFFF",
        [string]$OutPath
    )

    $bmp = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    if ($BgColorHex -eq "transparent") {
        $g.Clear([System.Drawing.Color]::Transparent)
    } else {
        $color = [System.Drawing.ColorTranslator]::FromHtml($BgColorHex)
        $g.Clear($color)
    }

    $destW = [int]($Width * $ScaleRatio)
    $destH = [int]($Height * $ScaleRatio)
    $destX = [int](($Width - $destW) / 2)
    $destY = [int](($Height - $destH) / 2)

    $g.DrawImage($Source, $destX, $destY, $destW, $destH)
    $g.Dispose()

    $dir = Split-Path -Parent $OutPath
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

# 1. Update root icon.png and logo.png with white background and padded logo
Create-PaddedIcon -Source $srcImage -Width 512 -Height 512 -ScaleRatio 0.78 -BgColorHex "#FFFFFF" -OutPath (Join-Path $rootDir "icon.png")
Create-PaddedIcon -Source $srcImage -Width 512 -Height 512 -ScaleRatio 0.78 -BgColorHex "#FFFFFF" -OutPath (Join-Path $rootDir "logo.png")

# 2. Update Android mipmaps
$mipmaps = @{
    "mipmap-mdpi"    = @{ Launcher = 48; Foreground = 108 }
    "mipmap-hdpi"    = @{ Launcher = 72; Foreground = 162 }
    "mipmap-xhdpi"   = @{ Launcher = 96; Foreground = 216 }
    "mipmap-xxhdpi"  = @{ Launcher = 144; Foreground = 324 }
    "mipmap-xxxhdpi" = @{ Launcher = 192; Foreground = 432 }
}

foreach ($folder in $mipmaps.Keys) {
    $sizes = $mipmaps[$folder]
    $folderPath = Join-Path $resDir $folder

    # Legacy launcher icons: white background, ~78% scale
    Create-PaddedIcon -Source $srcImage -Width $sizes.Launcher -Height $sizes.Launcher -ScaleRatio 0.78 -BgColorHex "#FFFFFF" -OutPath (Join-Path $folderPath "ic_launcher.png")
    Create-PaddedIcon -Source $srcImage -Width $sizes.Launcher -Height $sizes.Launcher -ScaleRatio 0.78 -BgColorHex "#FFFFFF" -OutPath (Join-Path $folderPath "ic_launcher_round.png")

    # Adaptive foreground: safe zone ~65% scale on transparent background
    Create-PaddedIcon -Source $srcImage -Width $sizes.Foreground -Height $sizes.Foreground -ScaleRatio 0.65 -BgColorHex "transparent" -OutPath (Join-Path $folderPath "ic_launcher_foreground.png")
}

# 3. Update Splash screens in drawables
$drawables = @(
    "drawable",
    "drawable-land-hdpi",
    "drawable-land-mdpi",
    "drawable-land-xhdpi",
    "drawable-land-xxhdpi",
    "drawable-land-xxxhdpi",
    "drawable-port-hdpi",
    "drawable-port-mdpi",
    "drawable-port-xhdpi",
    "drawable-port-xxhdpi",
    "drawable-port-xxxhdpi"
)

foreach ($folder in $drawables) {
    $folderPath = Join-Path $resDir $folder
    Create-PaddedIcon -Source $srcImage -Width 480 -Height 480 -ScaleRatio 0.60 -BgColorHex "#FFFFFF" -OutPath (Join-Path $folderPath "splash.png")
}

$srcImage.Dispose()
Write-Output "Successfully generated padded, white-background icons and splash screens."
