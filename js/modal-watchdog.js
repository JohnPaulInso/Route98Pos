(function () {
  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:45vh;overflow:auto;background:#000;color:#0f0;font:11px monospace;padding:6px;z-index:2147483647;white-space:pre-wrap;pointer-events:none';
  document.body.appendChild(box);
  function nm(e) { return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''); }
  function ctx(e) {
    var c = getComputedStyle(e), r = [];
    if (c.position !== 'static') r.push(c.position);
    if (c.zIndex !== 'auto') r.push('z=' + c.zIndex);
    if (c.transform !== 'none') r.push('transform');
    if (c.filter !== 'none') r.push('filter');
    if ((c.backdropFilter || c.webkitBackdropFilter || 'none') !== 'none') r.push('backdrop');
    if (c.willChange !== 'auto') r.push('will-change');
    if (c.contain !== 'none') r.push('contain');
    if (c.isolation === 'isolate') r.push('isolate');
    if (+c.opacity < 1) r.push('opacity');
    return r.join(' ');
  }
  document.addEventListener('touchend', function (ev) {
    var t = ev.changedTouches[0], el = document.elementFromPoint(t.clientX, t.clientY);
    var out = ['TOP ELEMENT AT TAP:'];
    for (var n = el, i = 0; n && n !== document.documentElement && i < 8; n = n.parentElement, i++) out.push('  ' + nm(n) + '  [' + ctx(n) + ']');
    var m = document.querySelectorAll('.modal-backdrop,.modal-product-form-backdrop,.modal-loy-dialog-backdrop');
    out.push('modals open: ' + m.length + (m[0] ? '  parent: ' + nm(m[0].parentElement) : ''));
    out.push('portal exists: ' + !!document.getElementById('cap-modal-portal'));
    box.textContent = out.join('\n');
  }, true);
})();