@echo off
rem Quick rebuild script for button click fixes
echo ========================================
echo   CAPACITOR APK REBUILD (FIXED)
echo ========================================
echo.
echo [INFO] This script will rebuild your APK with the following fixes:
echo  - Null safety checks in all render functions
echo  - Image loading CORS configuration
echo  - Enhanced Capacitor security settings
echo.
pause
echo.

echo [1/4] Copying fixed files to www...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo [2/4] Updating Android assets...
copy /Y capacitor.config.json android\app\src\main\assets\capacitor.config.json
echo Updated capacitor config in Android assets
echo.

echo [3/4] Syncing with Android project...
call npx cap sync android
if %errorlevel% neq 0 (
    echo [ERROR] Sync failed!
    pause
    exit /b 1
)

echo [4/4] Building APK (this may take a few minutes)...
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
echo ========================================
echo   BUILD COMPLETE!
echo ========================================
echo.
echo APK Location: android\app\build\outputs\apk\debug\route98.apk
echo.
echo Next Steps:
echo  1. Install APK on your device
echo  2. Test button functionality (Charge, Open Shift, etc.)
echo  3. Verify images load properly
echo  4. Check console for errors (chrome://inspect)
echo.
echo Opening APK folder...
explorer.exe /select,"%~dp0android\app\build\outputs\apk\debug\route98.apk"
pause
