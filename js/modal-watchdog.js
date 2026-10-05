(function () {
  var SEL = '.modal-backdrop,.modal-product-form-backdrop,.modal-loy-dialog-backdrop';
  var t;
  function sweep() {
    if (document.querySelector(SEL)) return;
    ['modal-open', 'scroll-locked'].forEach(function (c) {
      document.documentElement.classList.remove(c);
      document.body.classList.remove(c);
    });
  }
  new MutationObserver(function () { clearTimeout(t); t = setTimeout(sweep, 400); })
    .observe(document.body, { childList: true, subtree: true });
})();