@echo off
rem ========================================
rem   MODAL FIX - CAPACITOR APK REBUILD
rem ========================================
echo ========================================
echo   MODAL FIX - APK REBUILD
echo ========================================
echo.
echo [INFO] This script will rebuild your APK with modal fixes:
echo  - Portal visibility and pointer-events fix
echo  - Fixed positioning for modal backdrop
echo  - Removed transform isolation
echo  - Mobile drag-scroll guard for buttons
echo.
pause
echo.

echo [1/6] Cleaning old build...
if exist www rmdir /S /Q www
if exist android\app\src\main\assets\public rmdir /S /Q android\app\src\main\assets\public
echo.

echo [2/6] Building web assets to www...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)
echo.

echo [3/6] Copying test files...
copy /Y test-modal.html www\test-modal.html >nul 2>&1
echo Test page copied to www/test-modal.html
echo.

echo [4/6] Syncing with Android project...
call npx cap copy android
call npx cap sync android
if %errorlevel% neq 0 (
    echo [ERROR] Sync failed!
    pause
    exit /b 1
)
echo.

echo [5/6] Building debug APK...
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

echo [6/6] Verification...
echo.
echo ========================================
echo   BUILD COMPLETE!
echo ========================================
echo.
echo APK Location: android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo TESTING CHECKLIST:
echo  [_] Install APK on device
echo  [_] Click any button (Charge, Open Shift, Add Product)
echo  [_] Verify modal appears on screen
echo  [_] Tap backdrop to close modal
echo  [_] Test modal close X button
echo  [_] Test dropdown menus (Reports filters, Inventory tools)
echo.
echo DEBUG:
echo  - Open chrome://inspect in Chrome desktop
echo  - Select your device to see console logs
echo  - Look for "✅ Modal opened in portal" messages
echo  - Check for "⚠️ Portal not found" errors
echo.
echo Test page available at:
echo  capacitor://localhost/test-modal.html
echo  (Open in APK browser/webview to test modal system)
echo.
pause
