@echo off
echo ========================================
echo   VERIFY MODALZ RENAMING
echo ========================================
echo.

echo [1/4] Checking if old Modal references exist (should be NONE)...
findstr /R /N /C:"const Modal =" /C:"window\.Modal" /C:"\.modal-backdrop[^z]" www\js\*.js www\css\*.css 2>nul
if %errorlevel% equ 0 (
    echo ❌ Found old Modal references! Rename incomplete.
    pause
    exit /b 1
) else (
    echo ✅ No old Modal references found
)
echo.

echo [2/4] Checking if new Modalz references exist (should have MANY)...
findstr /R /N /C:"const Modalz" www\js\modal.js >nul
if %errorlevel% equ 0 (
    echo ✅ Found Modalz in modal.js
) else (
    echo ❌ Modalz not found in modal.js!
    pause
    exit /b 1
)
echo.

echo [3/4] Checking CSS classes...
findstr /R /N /C:"\.modalz" www\css\base.css >nul
if %errorlevel% equ 0 (
    echo ✅ Found .modalz in CSS
) else (
    echo ❌ .modalz not found in CSS!
    pause
    exit /b 1
)
echo.

echo [4/4] Checking Android assets...
findstr /R /N /C:"\.modalz" android\app\src\main\assets\public\css\base.css >nul
if %errorlevel% equ 0 (
    echo ✅ Found .modalz in Android assets
) else (
    echo ❌ .modalz not found in Android assets!
    echo Run: npx cap sync android
    pause
    exit /b 1
)
echo.

echo ========================================
echo   ✅ VERIFICATION COMPLETE!
echo ========================================
echo.
echo All modal references successfully renamed to Modalz!
echo.
echo NEXT: Test in browser (www/index.html)
echo.
pause
