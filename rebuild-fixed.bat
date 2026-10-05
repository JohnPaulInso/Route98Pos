@echo off
echo ========================================
echo   MODAL FIX - COMPLETE REBUILD
echo ========================================
echo.
echo This will:
echo  1. Clean old builds
echo  2. Copy all fixed files to www
echo  3. Sync with Android
echo  4. Build APK
echo.
echo Press Ctrl+C to cancel, or
pause
echo.

echo [1/7] Cleaning old builds...
if exist www rmdir /S /Q www
echo Deleted www folder
if exist android\app\build rmdir /S /Q android\app\build
echo Deleted Android build cache
echo.

echo [2/7] Building web assets...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed! Check if Node.js is installed.
    pause
    exit /b 1
)
echo.

echo [3/7] Verifying fixes in www...
findstr /C:"Portal shown" www\js\modal.js >nul
if %errorlevel% equ 0 (
    echo [PASS] Portal visibility code in www build
) else (
    echo [WARN] Portal visibility code may be missing
)

findstr /C:"border-radius: 16px" www\css\mobile-fixes.css >nul
if %errorlevel% equ 0 (
    echo [PASS] Rounded corners fix in www build
) else (
    echo [WARN] Rounded corners fix may be missing
)
echo.

echo [4/7] Copying to Android assets...
call npx cap copy android
if %errorlevel% neq 0 (
    echo [ERROR] Copy failed!
    pause
    exit /b 1
)
echo.

echo [5/7] Syncing Capacitor...
call npx cap sync android
if %errorlevel% neq 0 (
    echo [ERROR] Sync failed!
    pause
    exit /b 1
)
echo.

echo [6/7] Building APK (this takes 2-5 minutes)...
cd android
call gradlew.bat clean assembleDebug
if %errorlevel% neq 0 (
    echo [ERROR] APK build failed!
    cd ..
    pause
    exit /b 1
)
cd ..
echo.

echo [7/7] Locating APK...
set APK_PATH=android\app\build\outputs\apk\debug\route98.apk
if not exist %APK_PATH% (
    set APK_PATH=android\app\build\outputs\apk\debug\app-debug.apk
)

if exist %APK_PATH% (
    echo [SUCCESS] APK built successfully!
    echo.
    echo APK Location: %APK_PATH%
    for %%F in (%APK_PATH%) do echo APK Size: %%~zF bytes
) else (
    echo [ERROR] APK file not found!
    echo Searched locations:
    echo  - android\app\build\outputs\apk\debug\route98.apk
    echo  - android\app\build\outputs\apk\debug\app-debug.apk
    pause
    exit /b 1
)
echo.

echo ========================================
echo   BUILD COMPLETE!
echo ========================================
echo.
echo NEXT STEPS:
echo  1. Install APK: adb install -r %APK_PATH%
echo     OR manually copy to phone: %APK_PATH%
echo  2. Open app on device
echo  3. Click any button (Charge, Open Shift, etc.)
echo  4. VERIFY: Modal appears with rounded corners
echo.
echo DEBUG (if modals don't appear):
echo  1. Connect device to PC
echo  2. Open Chrome: chrome://inspect
echo  3. Click "Inspect" on your device
echo  4. Check Console for "✅ Modal opened in portal" message
echo.
pause
