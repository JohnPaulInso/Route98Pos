// ============================================================
// mobile-touch-fix.js — Fix touch events for Capacitor APK
// ============================================================
// (2026-10-02) Universal touch/click fix for APK where buttons don't respond
const MobileTouchFix = (() => {
  const isCapacitor = () => {
    return Boolean(window.Capacitor?.isNativePlatform?.() || window.Capacitor?.platform);
  };

  const isMobile = () => {
    return isCapacitor() ||
           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth <= 768;
  };

  // (2026-10-04) Synthesize real click on touchend; was _touched flag without .click()
  function fixButtonClicks() {
    if (!isCapacitor()) return;

    const SELECTOR = 'button, .btn, .icon-btn, .nav-btn, .bn-btn, .chip, .prod-card, .product-card, [role="button"]';
    let touchStartX = 0;
    let touchStartY = 0;
    let touchTarget = null;

    document.addEventListener('touchstart', (e) => {
      const el = e.target.closest(SELECTOR);
      if (el && !el.disabled) {
        touchTarget = el;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        el.classList.add('touch-active');
      }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!touchTarget) return;
      const dx = Math.abs(e.touches[0].clientX - touchStartX);
      const dy = Math.abs(e.touches[0].clientY - touchStartY);
      // (2026-10-04) Cancel touch if moved more than 10px; was no threshold
      if (dx > 10 || dy > 10) {
        touchTarget.classList.remove('touch-active');
        touchTarget = null;
      }
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const el = touchTarget;
      touchTarget = null;
      if (!el) return;
      el.classList.remove('touch-active');
      if (el.disabled) return;
      // (2026-10-04) Synthesize click when native click suppressed; was no-op
      if (!el._clickPending) {
        el._clickPending = true;
        // Small delay so browser's own click fires first if it will
        setTimeout(() => {
          if (el._clickPending) {
            el._clickPending = false;
            el.click();
          }
        }, 10);
        // Clear pending flag when native click arrives
        el.addEventListener('click', () => { el._clickPending = false; }, { once: true });
      }
    }, { passive: true });
  }

  // (2026-07-13) Safe Modal check & top z-index for APK; was Modal crash & 10000
  function fixModals() {
    const getM = () => (typeof Modal !== 'undefined' ? Modal : (window.Modal || null));
    const m = getM();
    if (!m || typeof m.open !== 'function') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fixModals, { once: true });
      }
      return;
    }
    if (m._apkWrapped) return;
    m._apkWrapped = true;
    const originalModalOpen = m.open;
    m.open = function(...args) {
      const backdrop = originalModalOpen.apply(this, args);
      if (backdrop) {
        // (2026-07-13) Ensure modal is on body with max z-index; was unparented check
        if (backdrop.parentElement !== document.body) {
          document.body.appendChild(backdrop);
        }
        backdrop.style.zIndex = '9999999';
        backdrop.style.position = 'fixed';
        backdrop.style.inset = '0';
        backdrop.style.pointerEvents = 'auto';
        backdrop.style.opacity = '1';
        backdrop.style.visibility = 'visible';
        const modal = backdrop.querySelector('.modal');
        if (modal) {
          modal.style.zIndex = '10000000';
          modal.style.touchAction = 'auto';
          modal.style.pointerEvents = 'auto';
          modal.style.opacity = '1';
          modal.style.visibility = 'visible';
        }
      }
      return backdrop;
    };
  }

  // Fix for inputs not focusing
  function fixInputs() {
    if (!isCapacitor()) return;

    document.addEventListener('touchstart', (e) => {
      const input = e.target.closest('input, textarea, select');
      if (input) {
        // Prevent zoom on input focus
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
          const currentContent = viewport.getAttribute('content');
          if (!currentContent.includes('maximum-scale=1')) {
            viewport.setAttribute('content', currentContent + ', maximum-scale=1.0');
          }
        }
      }
    }, { passive: true });
  }

  // (2026-07-13) Permit dropdown touch bubbling in APK; was e.stopPropagation
  function fixDropdowns() {
    if (!isCapacitor()) return;

    document.addEventListener('touchstart', (e) => {
      const select = e.target.closest('.ui-select-trigger, [data-select]');
      if (select) {
        select.classList.add('touch-active');
      }
    }, { passive: true });
  }

  // Fix for scrolling issues
  function fixScrolling() {
    if (!isCapacitor()) return;

    // Enable momentum scrolling on iOS
    document.querySelectorAll('.modal-body, .view-body, .pos-catalog, .cart-items').forEach(el => {
      el.style.webkitOverflowScrolling = 'touch';
      el.style.overflowY = 'auto';
    });
  }

  // Fix tap delay (300ms delay on older mobile browsers)
  function fixTapDelay() {
    if (!isCapacitor()) return;

    // Already handled by viewport meta tag: user-scalable=no
    // But add CSS for extra safety
    const style = document.createElement('style');
    style.textContent = `
      button, .btn, .icon-btn, a, [onclick], [role="button"] {
        cursor: pointer;
        -webkit-user-select: none;
        user-select: none;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }

      button.touch-active, .btn.touch-active {
        opacity: 0.7;
        transform: scale(0.98);
        transition: all 0.1s ease;
      }

      input, textarea, select {
        -webkit-user-select: auto;
        user-select: auto;
        touch-action: auto;
      }

      .modal-backdrop {
        -webkit-tap-highlight-color: transparent;
      }
    `;
    document.head.appendChild(style);
  }

  // (2026-10-04) Removed gesturestart preventDefault; was consuming all touch events
  function preventZoom() {
    if (!isCapacitor()) return;
    // touch-action: manipulation on interactive elements handles zoom prevention
    // gesturestart preventDefault removed — it was suppressing touch events on Android
  }

  // Initialize all fixes
  function init() {
    console.log('🔧 Mobile Touch Fix initializing...');
    console.log('Capacitor:', isCapacitor());
    console.log('Mobile:', isMobile());

    if (isCapacitor() || isMobile()) {
      fixButtonClicks();
      fixModals();
      fixInputs();
      fixDropdowns();
      fixScrolling();
      fixTapDelay();
      preventZoom();

      console.log('✅ Mobile Touch Fix enabled');
    }
  }

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init, isCapacitor, isMobile };
})();
