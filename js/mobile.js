// ============================================================
// mobile.js — Mobile-specific enhancements and interactions
// ============================================================

const MobileUtils = (() => {
  let isExpanded = false;
  
  // ============ DETECT MOBILE DEVICE ============
  function isMobile() {
    return window.innerWidth <= 767;
  }
  
  function isTablet() {
    return window.innerWidth >= 768 && window.innerWidth <= 1024;
  }
  
  function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }
  
  // ============ CART EXPANSION FOR MOBILE ============
  function initMobileCart() {
    if (!isMobile()) return;
    
    const cartEl = document.querySelector('.pos-cart');
    const cartHead = document.querySelector('.cart-head');
    
    if (!cartEl || !cartHead) return;
    
    // Add visual indicator if not present
    if (!cartHead.querySelector('.cart-expand-handle')) {
      const handle = document.createElement('div');
      handle.className = 'cart-expand-handle';
      handle.style.cssText = 'position:absolute;top:8px;left:50%;transform:translateX(-50%);width:40px;height:4px;background:var(--line-strong);border-radius:2px;';
      cartHead.insertBefore(handle, cartHead.firstChild);
    }
    
    // Add tap handler to expand/collapse cart
    cartHead.addEventListener('click', (e) => {
      // Don't trigger if clicking buttons inside cart head
      if (e.target.closest('button, .btn, .icon-btn')) return;
      
      isExpanded = !isExpanded;
      if (isExpanded) {
        cartEl.classList.add('expanded');
        hapticLight();
      } else {
        cartEl.classList.remove('expanded');
        hapticLight();
      }
    });
    
    // Expand cart when items are added
    const observer = new MutationObserver(() => {
      const itemCount = document.querySelectorAll('.cart-line').length;
      if (itemCount > 0 && !isExpanded) {
        setTimeout(() => {
          isExpanded = true;
          cartEl.classList.add('expanded');
        }, 300);
      } else if (itemCount === 0 && isExpanded) {
        isExpanded = false;
        cartEl.classList.remove('expanded');
      }
    });
    
    const cartItems = document.querySelector('.cart-items');
    if (cartItems) {
      observer.observe(cartItems, { childList: true, subtree: true });
    }
  }
  
  // ============ PREVENT ZOOM ON INPUT FOCUS ============
  function preventInputZoom() {
    if (!isMobile()) return;
    
    // Ensure all inputs have minimum 16px font to prevent zoom
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 767px) {
        input[type="text"],
        input[type="number"],
        input[type="email"],
        input[type="tel"],
        input[type="search"],
        textarea,
        select {
          font-size: 16px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  // ============ HAPTIC FEEDBACK ============
  function vibrate(pattern = 10) {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }
  
  function hapticLight() {
    vibrate(5);
  }
  
  function hapticMedium() {
    vibrate(10);
  }
  
  function hapticSuccess() {
    vibrate([10, 50, 10]);
  }
  
  function hapticError() {
    vibrate([50, 100, 50]);
  }
  
  // ============ ADD HAPTIC TO BUTTONS ============
  function initHapticFeedback() {
    if (!isTouchDevice()) return;
    
    // Add haptic to all buttons
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn, .chip, .product-card, .nav-btn, .bn-btn');
      if (btn) {
        hapticLight();
      }
    }, { passive: true });
  }
  
  // ============ SMOOTH SCROLL TO TOP ============
  function scrollToTop(smooth = true) {
    const view = document.querySelector('.view');
    if (view) {
      view.scrollTo({
        top: 0,
        behavior: smooth ? 'smooth' : 'auto'
      });
    } else {
      window.scrollTo({
        top: 0,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }
  
  // ============ SHOW/HIDE ELEMENTS ON SCROLL ============
  function initScrollBehaviors() {
    const view = document.querySelector('.view');
    if (!view) return;
    
    let lastScroll = 0;
    let ticking = false;
    
    view.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScroll = view.scrollTop;
          
          // Show/hide back to top button
          const backToTopBtn = document.querySelector('.back-to-top-btn');
          if (backToTopBtn) {
            if (currentScroll > 300) {
              backToTopBtn.style.display = 'flex';
            } else {
              backToTopBtn.style.display = 'none';
            }
          }
          
          lastScroll = currentScroll;
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }
  
  // ============ PULL TO REFRESH (Optional) ============
  function initPullToRefresh() {
    if (!isMobile()) return;
    
    const view = document.querySelector('.view');
    if (!view) return;
    
    let startY = 0;
    let isPulling = false;
    const threshold = 80;
    
    view.addEventListener('touchstart', (e) => {
      if (view.scrollTop === 0) {
        startY = e.touches[0].pageY;
        isPulling = false;
      }
    }, { passive: true });
    
    view.addEventListener('touchmove', (e) => {
      if (view.scrollTop === 0 && startY) {
        const currentY = e.touches[0].pageY;
        const pullDistance = currentY - startY;
        
        if (pullDistance > threshold && !isPulling) {
          isPulling = true;
          hapticMedium();
        }
      }
    }, { passive: true });
    
    view.addEventListener('touchend', () => {
      if (isPulling) {
        // Reload current view
        if (typeof window.currentView === 'string' && window.App && window.App.render) {
          window.App.render(window.currentView);
          hapticSuccess();
        }
      }
      startY = 0;
      isPulling = false;
    }, { passive: true });
  }
  
  // ============ OPTIMIZE TOUCH SCROLLING ============
  function optimizeTouchScrolling() {
    // Add momentum scrolling to scrollable elements
    const scrollableElements = document.querySelectorAll('.view, .cart-items, .product-grid, .table-wrap');
    scrollableElements.forEach(el => {
      el.style.webkitOverflowScrolling = 'touch';
      el.style.overscrollBehavior = 'contain';
    });
  }
  
  // ============ PREVENT OVERSCROLL BOUNCE ============
  function preventOverscrollBounce() {
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';
  }
  
  // ============ SAFE AREA INSETS ============
  function handleSafeAreas() {
    // Set CSS custom properties for safe areas
    const root = document.documentElement;
    
    // Check if device supports safe areas
    if (CSS.supports('padding-top: env(safe-area-inset-top)')) {
      root.style.setProperty('--safe-top', 'env(safe-area-inset-top)');
      root.style.setProperty('--safe-bottom', 'env(safe-area-inset-bottom)');
      root.style.setProperty('--safe-left', 'env(safe-area-inset-left)');
      root.style.setProperty('--safe-right', 'env(safe-area-inset-right)');
    } else {
      root.style.setProperty('--safe-top', '0px');
      root.style.setProperty('--safe-bottom', '0px');
      root.style.setProperty('--safe-left', '0px');
      root.style.setProperty('--safe-right', '0px');
    }
  }
  
  // ============ ORIENTATION CHANGE HANDLER ============
  function handleOrientationChange() {
    window.addEventListener('orientationchange', () => {
      // Re-initialize mobile features after orientation change
      setTimeout(() => {
        optimizeTouchScrolling();
        handleSafeAreas();
        
        // Collapse cart on orientation change
        const cartEl = document.querySelector('.pos-cart');
        if (cartEl && isExpanded) {
          isExpanded = false;
          cartEl.classList.remove('expanded');
        }
      }, 100);
    });
  }
  
  // ============ SWIPE GESTURES ============
  function initSwipeGestures() {
    if (!isTouchDevice()) return;
    
    let startX = 0;
    let startY = 0;
    let endX = 0;
    let endY = 0;
    const minSwipeDistance = 50;
    
    document.addEventListener('touchstart', (e) => {
      startX = e.touches[0].pageX;
      startY = e.touches[0].pageY;
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
      endX = e.changedTouches[0].pageX;
      endY = e.changedTouches[0].pageY;
      handleSwipe();
    }, { passive: true });
    
    function handleSwipe() {
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      
      // Check if horizontal swipe is dominant
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
        if (deltaX > 0) {
          // Swipe right
          onSwipeRight();
        } else {
          // Swipe left
          onSwipeLeft();
        }
      }
    }
    
    function onSwipeRight() {
      // Could be used for navigation back
      hapticLight();
    }
    
    function onSwipeLeft() {
      // Could be used for navigation forward
      hapticLight();
    }
  }
  
  // ============ ENHANCE MODALS FOR MOBILE ============
  function enhanceMobileModals() {
    // Close modal on backdrop click
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop') && isMobile()) {
        hapticLight();
        const closeBtn = document.querySelector('.modal-foot .btn-ghost, .modal-foot .btn:not(.btn-primary)');
        if (closeBtn) {
          closeBtn.click();
        }
      }
    });
    
    // Add swipe down to close modal
    if (!isTouchDevice()) return;
    
    let modalStartY = 0;
    let modalCurrentY = 0;
    let isDragging = false;
    
    document.addEventListener('touchstart', (e) => {
      const modal = e.target.closest('.modal');
      const modalBody = e.target.closest('.modal-body');
      if (modal && !modalBody && isMobile()) {
        modalStartY = e.touches[0].pageY;
        isDragging = false;
      }
    }, { passive: true });
    
    document.addEventListener('touchmove', (e) => {
      const modal = e.target.closest('.modal');
      const modalBody = e.target.closest('.modal-body');
      
      if (modal && modalStartY && !modalBody && isMobile()) {
        modalCurrentY = e.touches[0].pageY;
        const deltaY = modalCurrentY - modalStartY;
        
        // Only allow downward swipe
        if (deltaY > 0) {
          isDragging = true;
          modal.style.transform = `translateY(${Math.min(deltaY * 0.5, 100)}px)`;
          modal.style.transition = 'none';
        }
      }
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
      const modal = e.target.closest('.modal');
      if (modal && modalStartY && isMobile()) {
        const deltaY = modalCurrentY - modalStartY;
        
        if (deltaY > 100 && isDragging) {
          // Close modal
          hapticMedium();
          const closeBtn = document.querySelector('.modal-foot .btn-ghost, .modal-foot .btn:not(.btn-primary)');
          if (closeBtn) {
            closeBtn.click();
          }
        }
        
        modal.style.transform = '';
        modal.style.transition = '';
        modalStartY = 0;
        modalCurrentY = 0;
        isDragging = false;
      }
    }, { passive: true });
  }
  
  // ============ INITIALIZE ALL MOBILE FEATURES ============
  function init() {
    if (typeof window === 'undefined') return;
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }
    
    preventInputZoom();
    preventOverscrollBounce();
    handleSafeAreas();
    optimizeTouchScrolling();
    initHapticFeedback();
    handleOrientationChange();
    initSwipeGestures();
    enhanceMobileModals();
    
    // Mobile-specific features
    if (isMobile()) {
      initMobileCart();
      initScrollBehaviors();
      // initPullToRefresh(); // Uncomment to enable pull-to-refresh
    }
  }
  
  // Auto-initialize on script load
  init();
  
  // Re-initialize on view changes
  if (typeof window !== 'undefined') {
    window.addEventListener('viewchange', () => {
      setTimeout(() => {
        if (isMobile()) {
          initMobileCart();
          initScrollBehaviors();
        }
        optimizeTouchScrolling();
      }, 100);
    });
  }
  
  // Public API
  return {
    isMobile,
    isTablet,
    isTouchDevice,
    vibrate,
    hapticLight,
    hapticMedium,
    hapticSuccess,
    hapticError,
    scrollToTop,
    init
  };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.MobileUtils = MobileUtils;
}
