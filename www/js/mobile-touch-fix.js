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

  // Fix for buttons that don't respond in APK
  function fixButtonClicks() {
    if (!isCapacitor()) return;

    // Add touch event listeners to all buttons
    document.addEventListener('touchstart', (e) => {
      const btn = e.target.closest('button, .btn, .icon-btn, .nav-btn, .bn-btn');
      if (btn && !btn.disabled) {
        btn.classList.add('touch-active');
      }
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const btn = e.target.closest('button, .btn, .icon-btn, .nav-btn, .bn-btn');
      if (btn) {
        btn.classList.remove('touch-active');
        // Force click event if it wasn't triggered
        if (!btn._touched) {
          btn._touched = true;
          setTimeout(() => btn._touched = false, 300);
        }
      }
    }, { passive: true });
  }

  // Fix for modals not showing/responding
  function fixModals() {
    if (!isCapacitor()) return;

    // Override Modal.open to ensure proper z-index and touch handling
    const originalModalOpen = Modal?.open;
    if (originalModalOpen && typeof originalModalOpen === 'function') {
      Modal.open = function(...args) {
        const backdrop = originalModalOpen.apply(this, args);
        if (backdrop) {
          // Ensure modal is above everything
          backdrop.style.zIndex = '10000';
          backdrop.style.position = 'fixed';
          backdrop.style.inset = '0';
          
          // Fix touch events on modal
          const modal = backdrop.querySelector('.modal');
          if (modal) {
            modal.style.touchAction = 'auto';
            modal.style.pointerEvents = 'auto';
          }
        }
        return backdrop;
      };
    }
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

  // Fix for dropdowns/selects not working
  function fixDropdowns() {
    if (!isCapacitor()) return;

    // Make sure UISelect works on mobile
    document.addEventListener('touchstart', (e) => {
      const select = e.target.closest('.ui-select-trigger, [data-select]');
      if (select) {
        e.stopPropagation();
      }
    }, { passive: false });
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
      * {
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }
      
      button, .btn, .icon-btn, a, [onclick] {
        cursor: pointer;
        -webkit-user-select: none;
        user-select: none;
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

  // Prevent accidental zoom
  function preventZoom() {
    if (!isCapacitor()) return;

    document.addEventListener('gesturestart', (e) => {
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (e.scale !== 1) {
        e.preventDefault();
      }
    }, { passive: false });
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
