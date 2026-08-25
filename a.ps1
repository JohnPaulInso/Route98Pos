# (2026-07-13) PowerShell build script for debug APK. Prev: empty file
Write-Host "[1/3] Building assets..." -ForegroundColor Green
npm run build

Write-Host "[2/3] Syncing Android project..." -ForegroundColor Green
npx cap sync android

Write-Host "[3/3] Assembling Debug APK..." -ForegroundColor Green
Push-Location android
.\gradlew.bat clean assembleDebug
Pop-Location

Write-Host "Build complete." -ForegroundColor Cyan
$apkPath = Join-Path $PSScriptRoot "android\app\build\outputs\apk\debug\route98.apk"
if (Test-Path $apkPath) {
    explorer.exe /select,$apkPath
}
