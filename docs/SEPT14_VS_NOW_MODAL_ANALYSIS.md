# Sept 14, 2026 vs Current Modal Architecture Analysis

## 1. Executive Summary
On September 14, 2026 (commit 5048cdc), modals displayed and functioned without issue on Android APK builds. In subsequent commits (notably Oct 6-7), extensive mobile-sheet refactoring, renaming scripts, history pushState listeners, and multi-layer CSS overrides were added. These introduced four primary failure modes that prevented modals from rendering or staying visible in the APK WebView.

---

## 2. File and Architecture Breakdown: Sept 14 vs Current

### A. Stylesheet Inclusion (index.html)
- **Sept 14 (5048cdc):**
  Only 3 stylesheets loaded:
  1. css/tokens.css
  2. css/base.css
  3. css/views.css
  No mobile override sheets existed. Modal CSS in base.css was minimal and clean.

- **Current:**
  7 stylesheets loaded:
  1. css/tokens.css
  2. css/base.css
  3. css/views.css
  4. css/mobile.css
  5. css/mobile-fixes.css (5,560+ lines)
  6. css/dropdown-fix.css
  7. css/apk-fixes.css (530+ lines)
  Multiple competing stylesheets override modal positioning, z-index, and pointer events.

---

### B. Modal Positioning & Layout
- **Sept 14:**
  - .modal-backdrop used `display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 100;`.
  - .modal was relative-positioned with `max-width: 640px; border-radius: var(--r-lg);`.
  - The modal floated in the optical center of the screen, completely clear of bottom navigation bars and cart drawers.

- **Current (Before Fix):**
  - css/mobile-fixes.css (line 1347) forced `.modal-backdropz { align-items: flex-end !important; padding: 0 !important; }`.
  - This converted the modal into a bottom sheet pinned to y = 100% viewport bottom.
  - At the bottom of the viewport, the 60px .bottom-nav and .pos-cart (z-index 92, bottom 60px) physically covered the modal.
  - css/apk-fixes.css (line 496) gave `.pos-cart` `pointer-events: auto !important;`, intercepting all user touch events meant for the modal.

---

### C. Event Handling & Ghost-Click Auto Dismiss (modal.js)
- **Sept 14:**
  - Backdrop dismissal listened to `mousedown`:
    `backdrop.addEventListener("mousedown", (e) => { if(e.target === backdrop) close(); });`
  - When a user tapped a button on Android touch screen:
    1. touchstart fired on the button.
    2. Button handler executed and created the modal.
    3. Because mousedown had already dispatched before the modal was appended, the opening touch never triggered backdrop mousedown.
    4. The modal stayed open reliably.

- **Current (Before Fix):**
  - Backdrop dismissal was changed to `click` with a 200ms guard:
    `backdrop.addEventListener("click", (e) => { if(Date.now() - openTs < 200) return; if(e.target === backdrop) close(); });`
  - In Android WebView (Capacitor), standard mobile touch-to-click delay is ~300ms.
  - The synthetic click event fired at 300ms (greater than 200ms), hitting the newly rendered backdrop.
  - Result: The modal auto-closed immediately in the exact same tap cycle, appearing as if it never opened.

---

### D. Capacitor History & Popstate Conflicts
- **Sept 14:**
  - modal.js was completely independent of browser history. No pushState, no popstate, no history.back().
  - Modals opened and closed purely via DOM operations.

- **Current (Before Fix):**
  - modal.js added `history.pushState({ modalOpen: true })` inside open(), and `history.back()` inside close().
  - Added global `window.addEventListener("popstate")` calling handleUniversalBack().
  - In Android WebView running local file/capacitor scheme, pushState manipulations triggered immediate popstate events or back stack cycles, resulting in premature modal disposal.

---

### E. Identifier Renaming Desynchronization (rename-source-modalz.js)
- **Sept 14:**
  - Standard class names: `.modal`, `.modal-backdrop`, `#modal-x`, and global `Modal`.
- **Current (Before Fix):**
  - Automated rename script added "z" suffix across 536 occurrences (`Modalz`, `.modalz`, `.modal-backdropz`, `#modal-xz`).
  - Any dynamic view or HTML template referencing standard `.modal` classes lost styling or broke event binding.

---

## 3. Remediation Applied
1. **css/mobile-fixes.css & www/css/mobile-fixes.css**:
   Reverted `.modal-backdropz` from `align-items: flex-end; padding: 0` back to `align-items: center; justify-content: center; padding: 16px;`.
2. **css/apk-fixes.css & www/css/apk-fixes.css**:
   Blocked `.pos-cart` touch capture during modal open by enforcing `pointer-events: none !important; z-index: 0 !important;`.
3. **js/modal.js & www/js/modal.js**:
   - Replaced delayed click listener with `mousedown` listener to eliminate 300ms synthetic click auto-dismiss.
   - Removed `history.pushState` and `popstate` back-stack loops, relying directly on native Capacitor hardware back button handler.
   - Restored dual selector compatibility (`.modal-backdrop, .modal-backdropz`).
