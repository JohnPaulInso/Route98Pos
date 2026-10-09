// ============================================================
// modal.js — small reusable modal/dialog system
// Locks background scroll while open, closes on backdrop click
// or Escape, and animates in/out.
// ============================================================
// (2026-07-13) Sept 14 modal logic and lifecycle; was complex back-stack loops
const Modal = (() => {
  function close(targetBd, onClosed){
    if(typeof targetBd === "function"){ onClosed = targetBd; targetBd = null; }
    const bds = document.querySelectorAll(".modal-backdrop, .modal-backdropz");
    const toRemove = targetBd ? [targetBd] : Array.from(bds);
    toRemove.forEach(bd => {
      if(bd && bd.remove) bd.remove();
    });
    if(!document.querySelector(".modal-backdrop, .modal-backdropz")){
      document.body.classList.remove("scroll-locked", "modal-open", "modal-openz");
      document.documentElement.classList.remove("scroll-locked", "modal-open", "modal-openz");
    }
    if(typeof onClosed === "function") onClosed();
  }

  function open({ title, body, actions = [], wide = false, onClose, modalClass = "" }){
    close();
    if(typeof UISelect !== "undefined" && UISelect.closeAll) UISelect.closeAll();
    document.body.classList.add("scroll-locked", "modal-open");
    const backdrop = document.createElement("div");
    const extra = modalClass ? `${modalClass}-backdrop modal-${modalClass}-backdrop` : "";
    backdrop.className = `modal-backdrop modal-backdropz ${extra}`.trim();
    backdrop.innerHTML = `
      <div class="modal modalz ${wide ? "modal-wide modal-widez":""} ${modalClass || ""}">
        <div class="modal-head modal-headz">
          <h3>${title}</h3>
          <button class="icon-btn" id="modal-x">${Icons.get("x", { size:16 })}</button>
        </div>
        <div class="modal-body modal-bodyz">${body}</div>
        ${actions.length ? `<div class="modal-foot modal-footz">${actions.map((a,i)=>`<button class="btn ${a.cls||""}" data-i="${i}">${a.label}</button>`).join("")}</div>` : ""}
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener("mousedown", (e)=>{ if(e.target === backdrop){ close(); onClose?.(); } });
    const xBtn = backdrop.querySelector("#modal-x, #modal-xz");
    if(xBtn) xBtn.onclick = () => { close(); onClose?.(); };
    const escHandler = (e) => { if(e.key === "Escape"){ close(); onClose?.(); document.removeEventListener("keydown", escHandler); } };
    document.addEventListener("keydown", escHandler);
    actions.forEach((a,i) => {
      const btn = backdrop.querySelector(`[data-i="${i}"]`);
      if(btn) btn.onclick = () => a.onClick ? a.onClick() : close();
    });
    return backdrop;
  }

  function confirm({ title = "Are you sure?", message, danger = false, onConfirm, onCancel }){
    open({
      title,
      body: `<p>${message}</p>`,
      actions: [
        { label:"Cancel", cls:"btn-ghost", onClick: () => { close(); onCancel?.(); } },
        { label: danger ? "Yes, delete" : "Confirm", cls: danger ? "btn-danger" : "btn-primary", onClick: () => { close(); onConfirm(); } }
      ],
      onClose: onCancel
    });
  }

  document.addEventListener("backbutton", (e) => {
    const bds = document.querySelectorAll(".modal-backdrop, .modal-backdropz");
    if(bds.length){
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  }, false);

  if(window.Capacitor?.Plugins?.App?.addListener){
    window.Capacitor.Plugins.App.addListener("backButton", () => {
      const bds = document.querySelectorAll(".modal-backdrop, .modal-backdropz");
      if(bds.length){
        close();
      }
    }).catch(() => {});
  }

  return { open, close, confirm };
})();
window.Modal = Modal;
window.Modalz = Modal;
