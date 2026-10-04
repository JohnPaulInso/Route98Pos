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
    return document.getElementById("cap-modal-portal") || document.body;
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
    if (_portalList && _portalList.parentElement) {
      _portalList.parentElement.removeChild(_portalList);
    }
    _portalList = null;
    _activeList = null;
    _activeEl = null;
    if (_positionTimer) { clearInterval(_positionTimer); _positionTimer = null; }
  }

  // (2026-07-13) Set explicit z-index on open UISelect and parents; was class only
  function closeAll(except) {
    if (_activeEl && _activeEl !== except) {
      _activeEl.classList.remove("open");
      detachPortalList();
    }
    document.querySelectorAll(".ui-select.open").forEach(d => {
      if (d !== except) d.classList.remove("open");
    });
  }

  document.addEventListener("click", (e) => { if (!e.target.closest(".ui-select") && !e.target.closest(".ui-select-portal-list")) closeAll(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });

  function normalize(options) {
    return options.map(o => typeof o === "string" ? { value: o, label: o } : o);
  }

  function render(id, options, value, placeholder = "Select…") {
    const opts = normalize(options);
    const selected = opts.find(o => o.value === value) || opts[0];
    return `
      <div class="ui-select" id="${id}" data-value="${selected ? Utils.escapeHtml(selected.value) : ""}">
        <button type="button" class="ui-select-btn">
          <span class="ui-select-label">${selected ? Utils.escapeHtml(selected.label) : placeholder}</span>
          ${Icons.get("chevron-down", { size: 15, cls: "ui-select-chevron" })}
        </button>
        <div class="ui-select-list ui-select-list-hidden" role="listbox" data-select-id="${id}">
          ${opts.map(o => `<div class="ui-select-opt ${o.value === value ? "active" : ""}" data-v="${Utils.escapeHtml(o.value)}" role="option">${Utils.escapeHtml(o.label)}</div>`).join("")}
        </div>
      </div>`;
  }

  // (2026-10-05) Portal-teleport bind; list is moved to portal on open
  function bind(id, onChange) {
    const el = typeof id === "string" ? document.getElementById(id) : id;
    if (!el) return;
    const btn = el.querySelector(".ui-select-btn");
    const list = el.querySelector(".ui-select-list");

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
        list.classList.add("ui-select-portal-list");
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

    el.querySelectorAll(".ui-select-opt").forEach(opt => {
      opt.onclick = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        el.dataset.value = opt.dataset.v;
        el.querySelector(".ui-select-label").textContent = opt.textContent;
        el.querySelectorAll(".ui-select-opt").forEach(o => o.classList.toggle("active", o === opt));
        // (2026-10-05) Return list back to el before closing; was detaching
        if (list.parentElement !== el) el.appendChild(list);
        list.style.display = "";
        list.classList.remove("ui-select-portal-list");
        el.classList.remove("open");
        detachPortalList();
        // (2026-10-05) Reset portal ptr-events if no modals open
        if (!document.querySelector(".modal-backdrop")) {
          const portal = getPortal();
          if (portal.id === "cap-modal-portal") portal.style.setProperty("pointer-events", "none", "important");
        }
        onChange?.(opt.dataset.v);
      };
    });
  }

  function getValue(id) { return document.getElementById(id)?.dataset.value ?? ""; }

  function setValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const opt = el.querySelector(`.ui-select-opt[data-v="${CSS.escape(String(value))}"]`);
    if (!opt) return;
    el.dataset.value = value;
    el.querySelector(".ui-select-label").textContent = opt.textContent;
    el.querySelectorAll(".ui-select-opt").forEach(o => o.classList.toggle("active", o === opt));
  }

  return { render, bind, getValue, setValue, closeAll };
})();

