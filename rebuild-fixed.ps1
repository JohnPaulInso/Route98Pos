# Quick rebuild script for Capacitor APK with button click fixes

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CAPACITOR APK REBUILD (FIXED)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[INFO] This script will rebuild your APK with the following fixes:" -ForegroundColor Yellow
Write-Host " - Null safety checks in all render functions" -ForegroundColor Gray
Write-Host " - Image loading CORS configuration" -ForegroundColor Gray
Write-Host " - Enhanced Capacitor security settings" -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter to continue"
Write-Host ""

# Step 1: Build web assets
Write-Host "[1/4] Copying fixed files to www..." -ForegroundColor Green
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Build failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Step 2: Update Android assets
Write-Host "[2/4] Updating Android assets..." -ForegroundColor Green
Copy-Item -Path "capacitor.config.json" -Destination "android/app/src/main/assets/capacitor.config.json" -Force
Write-Host "Updated capacitor config in Android assets" -ForegroundColor Gray
Write-Host ""

# Step 3: Sync with Android
Write-Host "[3/4] Syncing with Android project..." -ForegroundColor Green
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Sync failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Step 4: Build APK
Write-Host "[4/4] Building APK (this may take a few minutes)..." -ForegroundColor Green
Push-Location android
./gradlew.bat clean assembleDebug
$buildResult = $LASTEXITCODE
Pop-Location

if ($buildResult -ne 0) {
    Write-Host "[ERROR] APK build failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BUILD COMPLETE!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "APK Location: android\app\build\outputs\apk\debug\route98.apk" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host " 1. Install APK on your device" -ForegroundColor White
Write-Host " 2. Test button functionality (Charge, Open Shift, etc.)" -ForegroundColor White
Write-Host " 3. Verify images load properly" -ForegroundColor White
Write-Host " 4. Check console for errors (chrome://inspect)" -ForegroundColor White
Write-Host ""

# Open APK folder
$apkPath = Join-Path $PSScriptRoot "android\app\build\outputs\apk\debug\route98.apk"
if (Test-Path $apkPath) {
    Write-Host "Opening APK folder..." -ForegroundColor Green
    explorer.exe /select,"$apkPath"
} else {
    Write-Host "[WARNING] APK file not found at expected location!" -ForegroundColor Yellow
}

Read-Host "Press Enter to exit"
