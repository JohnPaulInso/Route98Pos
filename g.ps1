# (2026-07-13) PowerShell wrapper for quick git push. Prev: none
param([string]$Message)

$date = Get-Date -Format "yyyy-MM-dd HH:mm"
if ([string]::IsNullOrWhiteSpace($Message)) {
    $Message = "Update: $date"
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " GitHub Auto-Upload" -ForegroundColor Cyan
Write-Host " $date" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Commit: `"$Message`"" -ForegroundColor Yellow
Write-Host ""

Write-Host "[1/3] Staging all changes..." -ForegroundColor Green
git add .

Write-Host "[2/3] Committing..." -ForegroundColor Green
git commit -m "$Message"

Write-Host "[3/3] Pushing to GitHub..." -ForegroundColor Green
git push -u origin main

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Done! Changes pushed to GitHub." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
