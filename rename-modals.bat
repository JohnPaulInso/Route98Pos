@echo off
echo ========================================
echo   RENAME MODALS TO MODALZ
echo ========================================
echo.
echo This script will rename ALL modal-related identifiers:
echo   - .modal          -^> .modalz
echo   - .modal-backdrop -^> .modal-backdropz
echo   - .modal-head     -^> .modal-headz
echo   - .modal-body     -^> .modal-bodyz
echo   - .modal-foot     -^> .modal-footz
echo   - Modal.open()    -^> Modalz.open()
echo   - #modal-x        -^> #modal-xz
echo   - modalOpen       -^> modalOpenz
echo.
echo This will affect 50+ files across:
echo   - JavaScript (.js)
echo   - CSS (.css)
echo   - HTML (.html)
echo.
echo ⚠️  WARNING: This is a MAJOR refactoring!
echo.
echo Press Ctrl+C to cancel, or
pause
echo.

echo [1/4] Running rename script...
node rename-modals-to-modalz.js
if %errorlevel% neq 0 (
    echo [ERROR] Rename script failed!
    pause
    exit /b 1
)
echo.

echo [2/4] Rebuilding web assets...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)
echo.

echo [3/4] Syncing with Android...
call npx cap sync android
if %errorlevel% neq 0 (
    echo [ERROR] Sync failed!
    pause
    exit /b 1
)
echo.

echo [4/4] Summary...
echo.
echo ========================================
echo   RENAMING COMPLETE!
echo ========================================
echo.
echo NEXT STEPS:
echo   1. Review changes: git diff
echo   2. Test in browser: Open www/index.html
echo   3. Test modals work correctly
echo   4. If all good, build APK:
echo      cd android
echo      .\gradlew.bat clean assembleDebug
echo      cd ..
echo.
echo If anything is broken, revert with:
echo   git checkout .
echo.
pause
