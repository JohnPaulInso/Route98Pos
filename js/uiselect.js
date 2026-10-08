// ============================================================
// uiselect.js — custom dropdown component (replaces native <select>)
// Usage:
//   1. Drop UISelect.render(id, options, value, placeholder) into your HTML string
//   2. After inserting into the DOM, call UISelect.bind(id, onChange)
//   3. Read the current value any time with UISelect.getValue(id)
// options: array of strings OR [{value,label}]
// ============================================================
const UISelect = (() => {
  // (2026-10-05) Portal-based teleport: active list is moved to cap-modal-portal
  let _activeEl = null;
  let _activeList = null;
  let _portalList = null;
  let _positionTimer = null;

  function getPortal() {
    return document.querySelector(".modal-backdropz, .modal-backdrop") || document.getElementById("cap-modal-portal") || document.getElementById("cap-modal-portalz") || document.body;
  }

  // (2026-07-13) Apply fixed !important portal styles; was overridden by css
  function positionPortalList(el) {
    if (!_portalList) return;
    const rect = el.getBoundingClientRect();
    const vpH = window.innerHeight;
    const listH = _portalList.offsetHeight || 200;
    const spaceBelow = vpH - rect.bottom;
    _portalList.style.setProperty("display", "block", "important");
    _portalList.style.setProperty("visibility", "visible", "important");
    _portalList.style.setProperty("opacity", "1", "important");
    _portalList.style.setProperty("position", "fixed", "important");
    _portalList.style.setProperty("left", rect.left + "px", "important");
    _portalList.style.setProperty("width", rect.width + "px", "important");
    _portalList.style.setProperty("z-index", "2147483647", "important");
    _portalList.style.setProperty("pointer-events", "auto", "important");
    _portalList.style.setProperty("right", "auto", "important");
    if (spaceBelow < listH && rect.top > listH) {
      // open upward
      _portalList.style.setProperty("top", (rect.top - listH) + "px", "important");
      _portalList.style.setProperty("bottom", "auto", "important");
    } else {
      _portalList.style.setProperty("top", rect.bottom + "px", "important");
      _portalList.style.setProperty("bottom", "auto", "important");
    }
  }

  function detachPortalList() {
    if (_portalList && _activeEl) {
      _portalList.style.removeProperty("display");
      _portalList.style.removeProperty("visibility");
      _portalList.style.removeProperty("opacity");
      _portalList.style.removeProperty("position");
      _portalList.style.removeProperty("left");
      _portalList.style.removeProperty("top");
      _portalList.style.removeProperty("bottom");
      _portalList.style.removeProperty("right");
      _portalList.style.removeProperty("width");
      _portalList.style.removeProperty("z-index");
      _portalList.style.removeProperty("pointer-events");
      _portalList.classList.remove("ui-select-portal-list", "ui-select-portal-listz");
      try { _activeEl.appendChild(_portalList); } catch(e){}
    } else if (_portalList && _portalList.parentElement) {
      _portalList.parentElement.removeChild(_portalList);
    }
    _portalList = null;
    _activeList = null;
    _activeEl = null;
    if (_positionTimer) { clearInterval(_positionTimer); _positionTimer = null; }
    // (2026-10-05) Reset portal ptr-events if no modals open
    if (!document.querySelector(".modal-backdropz")) {
      const portal = getPortal();
      if (portal && (portal.id === "cap-modal-portal" || portal.id === "cap-modal-portalz")) portal.style.setProperty("pointer-events", "none", "important");
    }
  }

  // (2026-07-13) Add z suffix to dropdown classes & ids; was standard names
  function closeAll(except) {
    if (_activeEl && _activeEl !== except) {
      _activeEl.classList.remove("open");
      detachPortalList();
    }
    document.querySelectorAll(".ui-select.open, .ui-selectz.open").forEach(d => {
      if (d !== except) d.classList.remove("open");
    });
  }

  document.addEventListener("click", (e) => { if (!e.target.closest(".ui-select, .ui-selectz") && !e.target.closest(".ui-select-portal-list, .ui-select-portal-listz")) closeAll(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });

  function normalize(options) {
    return options.map(o => typeof o === "string" ? { value: o, label: o } : o);
  }

  function render(id, options, value, placeholder = "Select…") {
    const opts = normalize(options);
    const selected = opts.find(o => o.value === value) || opts[0];
    return `
      <div class="ui-select ui-selectz" id="${id}" data-value="${selected ? Utils.escapeHtml(selected.value) : ""}">
        <button type="button" class="ui-select-btn ui-select-btnz">
          <span class="ui-select-label ui-select-labelz">${selected ? Utils.escapeHtml(selected.label) : placeholder}</span>
          ${Icons.get("chevron-down", { size: 15, cls: "ui-select-chevron ui-select-chevronz" })}
        </button>
        <div class="ui-select-list ui-select-listz ui-select-list-hidden ui-select-list-hiddenz" role="listbox" data-select-id="${id}">
          ${opts.map(o => `<div class="ui-select-opt ui-select-optz ${o.value === value ? "active" : ""}" data-v="${Utils.escapeHtml(o.value)}" role="option">${Utils.escapeHtml(o.label)}</div>`).join("")}
        </div>
      </div>`;
  }

  // (2026-10-05) Portal-teleport bind; list is moved to portal on open
  function bind(id, onChange) {
    const el = typeof id === "string" ? document.getElementById(id) : id;
    if (!el) return;
    const btn = el.querySelector(".ui-select-btn, .ui-select-btnz");
    const list = el.querySelector(".ui-select-list, .ui-select-listz");

    btn.onclick = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      const willOpen = !el.classList.contains("open");
      closeAll(el);
      if (willOpen) {
        el.classList.add("open");
        _activeEl = el;
        _activeList = list;
        // (2026-07-13) Teleport list & clean inline styles on close; was static append
        const portal = getPortal();
        if (portal && portal !== document.body) portal.style.setProperty("pointer-events", "auto", "important");
        portal.appendChild(list);
        list.classList.add("ui-select-portal-list", "ui-select-portal-listz");
        _portalList = list;
        positionPortalList(el);
        _positionTimer = setInterval(() => positionPortalList(el), 100);
      }
    };

    el.querySelectorAll(".ui-select-opt, .ui-select-optz").forEach(opt => {
      opt.onclick = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        el.dataset.value = opt.dataset.v;
        const lbl = el.querySelector(".ui-select-label, .ui-select-labelz");
        if (lbl) lbl.textContent = opt.textContent;
        list.querySelectorAll(".ui-select-opt, .ui-select-optz").forEach(o => o.classList.toggle("active", o === opt));
        if (list.parentElement !== el) el.appendChild(list);
        el.classList.remove("open");
        detachPortalList();
        onChange?.(opt.dataset.v);
      };
    });
  }

  function getValue(id) { return document.getElementById(id)?.dataset.value ?? ""; }

  function setValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const opt = el.querySelector(`.ui-select-opt[data-v="${CSS.escape(String(value))}"], .ui-select-optz[data-v="${CSS.escape(String(value))}"]`);
    if (!opt) return;
    el.dataset.value = value;
    const lbl = el.querySelector(".ui-select-label, .ui-select-labelz");
    if (lbl) lbl.textContent = opt.textContent;
    el.querySelectorAll(".ui-select-opt, .ui-select-optz").forEach(o => o.classList.toggle("active", o === opt));
  }

  return { render, bind, getValue, setValue, closeAll };
})();

