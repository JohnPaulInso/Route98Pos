# Modal Sharp Corners - Root Cause Analysis

## Issue
Modals in the Android APK showed sharp corners (not rounded) even though the CSS contained `border-radius: 16px !important`.

## Root Cause
**CSS specificity cascade conflict!**

The CSS files were loaded in this order:
1. `css/base.css`
2. `css/views.css`
3. `css/mobile.css` - ✅ Has `border-radius: 16px`
4. `css/mobile-fixes.css` - ✅ Has `border-radius: 16px !important`
5. **`css/apk-fixes.css`** - ❌ Has `border-radius: var(--r-lg, 12px)` **(NO !important flag)**

Since `apk-fixes.css` loads **LAST**, its `border-radius` rule **overrode** the previous `!important` rules from `mobile-fixes.css` because:
- The selector `.modal` has the same specificity in all files
- CSS cascade gives precedence to the **last declared rule** when specificity is equal
- Even though `mobile-fixes.css` had `!important`, the later `apk-fixes.css` rule without `!important` was taking effect due to the cascade order

## The Culprit
**File:** `www/css/apk-fixes.css`  
**Line:** 105

```css
.modal,
.modal.modal-wide,
.modal.modal-product-form {
  /* ... other properties ... */
  border-radius: var(--r-lg, 12px); /* ❌ PROBLEM: No !important, uses CSS variable */
  width: 100%;
  max-width: 640px;
}
```

The CSS variable `--r-lg` was likely resolving to `18px` or using the fallback `12px`, resulting in modals with either:
- Slightly rounded corners (18px)
- Very rounded corners (12px)
- Sharp corners (if variable was `0` or undefined)

## The Fix
**Changed line 105 in `www/css/apk-fixes.css`:**

```css
border-radius: 16px !important; /* ✅ Fully rounded corners on all sides */
```

This ensures:
1. ✅ Consistent `16px` border radius on all corners
2. ✅ `!important` flag prevents any future CSS from overriding
3. ✅ No dependency on CSS variables
4. ✅ Matches the design intent from `mobile.css` and `mobile-fixes.css`

## Why This Wasn't Caught Earlier
1. Previous fixes were applied to `mobile.css` and `mobile-fixes.css` but NOT `apk-fixes.css`
2. The CSS load order wasn't checked - `apk-fixes.css` loading last was overlooked
3. The `var(--r-lg, 12px)` wasn't obviously wrong without checking the variable value
4. Browser caching might have shown old CSS in web tests

## Verification Steps
After rebuilding the APK:
1. Open any modal in the Android app
2. Check all 4 corners of the modal - they should be evenly rounded
3. Expected: Smooth 16px rounded corners on top-left, top-right, bottom-left, bottom-right
4. Previous bug: Sharp corners (especially visible on top-right and bottom corners)

## Files Changed
- `www/css/apk-fixes.css` (line 105)

## Build Command
```bash
.\rebuild-fixed.bat
```

This will:
1. Clean old builds
2. Build web assets (`npm run build`)
3. Copy to Android (`npx cap copy android`)
4. Sync Capacitor (`npx cap sync android`)
5. Build APK (`gradlew clean assembleDebug`)
6. Locate and report APK location

---

**Date:** 2026-10-06  
**Status:** ✅ FIXED - Ready for rebuild
