@echo off
echo ========================================
echo   MODAL FIX VERIFICATION
echo ========================================
echo.
echo This script checks if modal fixes are applied
echo.
echo [1/5] Checking js/modal.js...
findstr /C:"Portal shown" js\modal.js >nul
if %errorlevel% equ 0 (
    echo [PASS] Modal.js has portal visibility logging
) else (
    echo [FAIL] Modal.js missing portal visibility code
    echo        Search for: portal.style.setProperty
)
echo.

echo [2/5] Checking index.html portal...
findstr /C:"cap-modal-portal" index.html >nul
if %errorlevel% equ 0 (
    echo [PASS] Portal div exists in index.html
    findstr /C:"visibility:hidden" index.html >nul
    if %errorlevel% equ 0 (
        echo [PASS] Portal starts hidden
    ) else (
        echo [WARN] Portal may not start hidden
    )
) else (
    echo [FAIL] Portal div missing in index.html
)
echo.

echo [3/5] Checking css/apk-fixes.css...
findstr /C:"#cap-modal-portal" css\apk-fixes.css >nul
if %errorlevel% equ 0 (
    echo [PASS] Portal CSS rules exist
    findstr /C:"transform" css\apk-fixes.css | findstr /C:"modal-portal" >nul
    if %errorlevel% equ 0 (
        echo [WARN] Portal may still have transform isolation
        echo        Remove: transform, will-change, isolation
    ) else (
        echo [PASS] Portal has no transform isolation
    )
) else (
    echo [FAIL] Portal CSS missing in apk-fixes.css
)
echo.

echo [4/5] Checking js/app.js drag-scroll guard...
findstr /C:"Mobile/Capacitor detected" js\app.js >nul
if %errorlevel% equ 0 (
    echo [PASS] Mobile drag-scroll guard present
) else (
    echo [FAIL] Mobile drag-scroll guard missing
    echo        Add: isMobileContext() early return
)
echo.

echo [5/5] Checking www build...
if exist www\index.html (
    echo [PASS] www directory exists
    findstr /C:"cap-modal-portal" www\index.html >nul
    if %errorlevel% equ 0 (
        echo [PASS] Portal in built www/index.html
    ) else (
        echo [FAIL] Portal missing in www build
        echo        Run: npm run build
    )
) else (
    echo [FAIL] www directory not found
    echo        Run: npm run build
)
echo.

echo ========================================
echo   VERIFICATION COMPLETE
echo ========================================
echo.
echo If all checks pass, rebuild APK:
echo   rebuild-fixed.bat
echo.
echo If any checks fail:
echo   1. Review MODAL_FIX_SUMMARY.md
echo   2. Re-apply missing fixes
echo   3. Run this script again
echo.
pause
