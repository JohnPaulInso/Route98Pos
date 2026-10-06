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
    return document.getElementById("cap-modal-portal") || document.getElementById("cap-modal-portalz") || document.body;
  }

  // (2026-10-05) Position the portal list over the trigger rect
  function positionPortalList(el) {
    if (!_portalList) return;
    const rect = el.getBoundingClientRect();
    const vpH = window.innerHeight;
    const listH = _portalList.offsetHeight || 200;
    const spaceBelow = vpH - rect.bottom;
    _portalList.style.position = "fixed";
    _portalList.style.left = rect.left + "px";
    _portalList.style.width = rect.width + "px";
    _portalList.style.zIndex = "2147483647";
    _portalList.style.pointerEvents = "auto";
    if (spaceBelow < listH && rect.top > listH) {
      // open upward
      _portalList.style.top = (rect.top - listH) + "px";
      _portalList.style.bottom = "";
    } else {
      _portalList.style.top = rect.bottom + "px";
      _portalList.style.bottom = "";
    }
  }

  function detachPortalList() {
    if (_portalList && _activeEl) {
      // (2026-10-05) Return list to its original .ui-select parent; was orphaning it
      _portalList.style.display = "";
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
        // (2026-10-05) Teleport list into portal; was inline DOM causing stacking issues
        const portal = getPortal();
        portal.style.setProperty("pointer-events", "auto", "important");
        // Clone-free: just move the node
        portal.appendChild(list);
        list.classList.add("ui-select-portal-list", "ui-select-portal-listz");
        list.style.display = "block";
        list.style.position = "fixed";
        list.style.zIndex = "2147483647";
        list.style.pointerEvents = "auto";
        _portalList = list;
        positionPortalList(el);
        // Re-position on scroll (modal body scrolls)
        _positionTimer = setInterval(() => positionPortalList(el), 100);
      }
    };

    el.querySelectorAll(".ui-select-opt, .ui-select-optz").forEach(opt => {
      opt.onclick = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        el.dataset.value = opt.dataset.v;
        const lbl = el.querySelector(".ui-select-label, .ui-select-labelz");
        if (lbl) lbl.textContent = opt.textContent;
        el.querySelectorAll(".ui-select-opt, .ui-select-optz").forEach(o => o.classList.toggle("active", o === opt));
        // (2026-10-05) Return list back to el before closing; was detaching
        if (list.parentElement !== el) el.appendChild(list);
        list.style.display = "";
        list.classList.remove("ui-select-portal-list", "ui-select-portal-listz");
        el.classList.remove("open");
        detachPortalList();
        // (2026-10-05) Reset portal ptr-events if no modals open
        if (!document.querySelector(".modal-backdropz")) {
          const portal = getPortal();
          if (portal && (portal.id === "cap-modal-portal" || portal.id === "cap-modal-portalz")) portal.style.setProperty("pointer-events", "none", "important");
        }
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

