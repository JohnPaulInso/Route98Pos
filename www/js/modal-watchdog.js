(function () {
  var SEL = '.modal-backdrop,.modal-product-form-backdrop,.modal-loy-dialog-backdrop';
  var portal = document.getElementById('cap-modal-portal');
  if (!portal) return;

  // portal is inline visibility:hidden; make it visible (it has pointer-events:none, so it's harmless)
  portal.style.visibility = 'visible';

  function moveModals() {
    document.querySelectorAll(SEL).forEach(function (el) {
      if (el.parentNode !== portal) portal.appendChild(el);
    });
  }

  var t;
  function sweep() {
    if (document.querySelector(SEL)) return;
    ['modal-open', 'scroll-locked'].forEach(function (c) {
      document.documentElement.classList.remove(c);
      document.body.classList.remove(c);
    });
  }

  new MutationObserver(function () {
    moveModals();
    clearTimeout(t);
    t = setTimeout(sweep, 400);
  }).observe(document.body, { childList: true, subtree: true });

  moveModals();
})();