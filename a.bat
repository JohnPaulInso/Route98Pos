@echo off
rem (2026-07-13) Open APK output in Explorer on complete. Prev: no open
echo [1/3] Building assets...
call npm run build
echo [2/3] Syncing Android project...
call npx cap sync android
echo [3/3] Assembling Debug APK...
cd android
rem (2026-07-13) Clean gradle assemble to ensure stale assets are deleted. Prev: assembleDebug only
call gradlew.bat clean assembleDebug
cd ..
echo Build complete.
rem (2026-07-13) Select route98.apk in Explorer. Prev: com.faiora.app.apk
explorer.exe /select,"%~dp0android\app\build\outputs\apk\debug\route98.apk"

