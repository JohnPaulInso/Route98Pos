@echo off
rem ============================================================
rem Route 98 POS - Automated Multi-Device Sync Playwright Runner
rem ============================================================
title Route 98 POS - Automated Live Sync Tests
echo.
echo ============================================================
echo   Starting Multi-Device Live Playwright Automated Tests...
echo ============================================================
echo.
node tests/run-all.js
echo.
pause
