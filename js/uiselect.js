// ============================================================
// uiselect.js — custom dropdown component (replaces native <select>)
// Usage:
//   1. Drop UISelect.render(id, options, value, placeholder) into your HTML string
//   2. After inserting into the DOM, call UISelect.bind(id, onChange)
//   3. Read the current value any time with UISelect.getValue(id)
// options: array of strings OR [{value,label}]
// ============================================================
const UISelect = (() => {
  // (2026-07-13) Set explicit z-index on open UISelect and parents; was class only
  function closeAll(except){
    document.querySelectorAll(".ui-select.open").forEach(d => {
      if(d !== except) {
        d.classList.remove("open");
        d.style.removeProperty("z-index");
        const fld = d.closest(".field") || d.parentElement;
        const row = d.closest(".input-row") || (fld ? fld.parentElement : null);
        if(fld){ fld.classList.remove("select-field-open"); fld.style.removeProperty("z-index"); }
        if(row){ row.classList.remove("select-row-open"); row.style.removeProperty("z-index"); }
      }
    });
  }
  document.addEventListener("click", (e) => { if(!e.target.closest(".ui-select")) closeAll(); });
  document.addEventListener("keydown", (e) => { if(e.key === "Escape") closeAll(); });

  function normalize(options){
    return options.map(o => typeof o === "string" ? { value:o, label:o } : o);
  }

  function render(id, options, value, placeholder = "Select…"){
    const opts = normalize(options);
    const selected = opts.find(o => o.value === value) || opts[0];
    return `
      <div class="ui-select" id="${id}" data-value="${selected ? Utils.escapeHtml(selected.value) : ""}">
        <button type="button" class="ui-select-btn">
          <span class="ui-select-label">${selected ? Utils.escapeHtml(selected.label) : placeholder}</span>
          ${Icons.get("chevron-down", { size:15, cls:"ui-select-chevron" })}
        </button>
        <div class="ui-select-list" role="listbox">
          ${opts.map(o => `<div class="ui-select-opt ${o.value===value?"active":""}" data-v="${Utils.escapeHtml(o.value)}" role="option">${Utils.escapeHtml(o.label)}</div>`).join("")}
        </div>
      </div>`;
  }

  // (2026-07-13) Set explicit z-index & elevation on open UISelect; was desktop
  function bind(id, onChange){
    const el = typeof id === "string" ? document.getElementById(id) : id;
    if(!el) return;
    const btn = el.querySelector(".ui-select-btn");
    btn.onclick = (e) => {
      if(e){ e.preventDefault(); e.stopPropagation(); }
      const willOpen = !el.classList.contains("open");
      closeAll(el);
      el.classList.toggle("open", willOpen);
      const fld = el.closest(".field") || el.parentElement;
      const row = el.closest(".input-row") || (fld ? fld.parentElement : null);
      if(willOpen){
        el.style.setProperty("z-index", "10010", "important");
        el.style.setProperty("position", "relative", "important");
        if(fld){ fld.classList.add("select-field-open"); fld.style.setProperty("z-index", "10005", "important"); fld.style.setProperty("position", "relative", "important"); }
        if(row){ row.classList.add("select-row-open"); row.style.setProperty("z-index", "10005", "important"); row.style.setProperty("position", "relative", "important"); }
      } else {
        el.style.removeProperty("z-index");
        if(fld){ fld.classList.remove("select-field-open"); fld.style.removeProperty("z-index"); }
        if(row){ row.classList.remove("select-row-open"); row.style.removeProperty("z-index"); }
      }
    };
    el.querySelectorAll(".ui-select-opt").forEach(opt => {
      opt.onclick = (e) => {
        if(e){ e.preventDefault(); e.stopPropagation(); }
        el.dataset.value = opt.dataset.v;
        el.querySelector(".ui-select-label").textContent = opt.textContent;
        el.querySelectorAll(".ui-select-opt").forEach(o => o.classList.toggle("active", o === opt));
        const fld = el.closest(".field") || el.parentElement;
        const row = el.closest(".input-row") || (fld ? fld.parentElement : null);
        if(fld){ fld.classList.remove("select-field-open"); fld.style.removeProperty("z-index"); }
        if(row){ row.classList.remove("select-row-open"); row.style.removeProperty("z-index"); }
        el.style.removeProperty("z-index");
        closeAll();
        onChange?.(opt.dataset.v);
      };
    });
  }

  function getValue(id){ return document.getElementById(id)?.dataset.value ?? ""; }

  function setValue(id, value){
    const el = document.getElementById(id);
    if(!el) return;
    const opt = el.querySelector(`.ui-select-opt[data-v="${CSS.escape(String(value))}"]`);
    if(!opt) return;
    el.dataset.value = value;
    el.querySelector(".ui-select-label").textContent = opt.textContent;
    el.querySelectorAll(".ui-select-opt").forEach(o => o.classList.toggle("active", o === opt));
  }

  return { render, bind, getValue, setValue, closeAll };
})();
