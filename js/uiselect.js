// ============================================================
// uiselect.js — custom dropdown component (replaces native <select>)
// Usage:
//   1. Drop UISelect.render(id, options, value, placeholder) into your HTML string
//   2. After inserting into the DOM, call UISelect.bind(id, onChange)
//   3. Read the current value any time with UISelect.getValue(id)
// options: array of strings OR [{value,label}]
// ============================================================
const UISelect = (() => {
  // (2026-07-13) Clean parent stacking on closeAll; was classList open only
  function closeAll(except){
    document.querySelectorAll(".ui-select.open").forEach(d => {
      if(d !== except) {
        d.classList.remove("open");
        d.closest(".field")?.classList.remove("select-field-open");
        d.closest(".input-row")?.classList.remove("select-row-open");
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

  // (2026-07-13) Support touch, click & parent elevation in UISelect; was desktop
  function bind(id, onChange){
    const el = typeof id === "string" ? document.getElementById(id) : id;
    if(!el) return;
    const btn = el.querySelector(".ui-select-btn");
    btn.onclick = (e) => {
      if(e){ e.preventDefault(); e.stopPropagation(); }
      const willOpen = !el.classList.contains("open");
      closeAll(el);
      el.classList.toggle("open", willOpen);
      if(willOpen){
        el.closest(".field")?.classList.add("select-field-open");
        el.closest(".input-row")?.classList.add("select-row-open");
      } else {
        el.closest(".field")?.classList.remove("select-field-open");
        el.closest(".input-row")?.classList.remove("select-row-open");
      }
    };
    el.querySelectorAll(".ui-select-opt").forEach(opt => {
      opt.onclick = (e) => {
        if(e){ e.preventDefault(); e.stopPropagation(); }
        el.dataset.value = opt.dataset.v;
        el.querySelector(".ui-select-label").textContent = opt.textContent;
        el.querySelectorAll(".ui-select-opt").forEach(o => o.classList.toggle("active", o === opt));
        el.closest(".field")?.classList.remove("select-field-open");
        el.closest(".input-row")?.classList.remove("select-row-open");
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
