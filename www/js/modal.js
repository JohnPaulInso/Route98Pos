// ============================================================
// modal.js — small reusable modal/dialog system
// Locks background scroll while open, closes on backdrop click
// or Escape, and animates in/out.
// ============================================================
// (2026-07-13) Support stacked modal overlays; was closing all backdrops
const Modal = (() => {
  function close(targetBd, onClosed){
    if(typeof targetBd === "function"){ onClosed = targetBd; targetBd = null; }
    const bds = document.querySelectorAll(".modal-backdrop, .modal-backdropz");
    if(!bds.length) return;
    const toRemove = targetBd ? [targetBd] : [bds[bds.length - 1]];
    toRemove.forEach(bd => {
      if(bd && bd.remove) bd.remove();
    });
    if(!document.querySelector(".modal-backdrop, .modal-backdropz")){
      document.body.classList.remove("scroll-locked");
      document.documentElement.classList.remove("scroll-locked");
    }
    if(typeof onClosed === "function") onClosed();
  }

  function open({ title, body, actions = [], wide = false, onClose, modalClass = "", overlay = false }){
    if(!overlay){
      close();
    }
    if(typeof UISelect !== "undefined" && UISelect.closeAll) UISelect.closeAll();
    document.body.classList.add("scroll-locked");
    const backdrop = document.createElement("div");
    // (2026-07-13) Safe modal extra classes; was string interpolation space bug
    const extra = (modalClass || "").trim().split(/\s+/).filter(Boolean).map(c => `${c}-backdrop modal-${c}-backdrop`).join(" ");
    backdrop.className = `modal-backdrop modal-backdropz ${extra}`.trim();
    const existingBds = document.querySelectorAll(".modal-backdrop, .modal-backdropz");
    if(overlay || existingBds.length > 0){
      backdrop.style.zIndex = 10000 + (existingBds.length * 20);
    }
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
    const closeThis = () => {
      document.removeEventListener("keydown", escHandler);
      close(backdrop);
    };
    backdrop.addEventListener("mousedown", (e)=>{ if(e.target === backdrop){ closeThis(); onClose?.(); } });
    const xBtn = backdrop.querySelector("#modal-x, #modal-xz");
    if(xBtn) xBtn.onclick = () => { closeThis(); onClose?.(); };
    const escHandler = (e) => {
      if(e.key === "Escape"){
        const allBds = document.querySelectorAll(".modal-backdrop, .modal-backdropz");
        if(allBds.length && allBds[allBds.length - 1] === backdrop){
          closeThis();
          onClose?.();
        }
      }
    };
    document.addEventListener("keydown", escHandler);
    actions.forEach((a,i) => {
      const btn = backdrop.querySelector(`[data-i="${i}"]`);
      if(btn) btn.onclick = () => {
        if(a.onClick) a.onClick();
        else { closeThis(); onClose?.(); }
      };
    });
    return backdrop;
  }

  function confirm({ title = "Are you sure?", message, danger = false, onConfirm, onCancel, overlay = false }){
    const hasExisting = !!document.querySelector(".modal-backdrop, .modal-backdropz");
    open({
      title,
      body: `<p>${message}</p>`,
      overlay: overlay || hasExisting,
      actions: [
        { label:"Cancel", cls:"btn-ghost", onClick: () => { close(); onCancel?.(); } },
        { label: danger ? "Yes, delete" : "Confirm", cls: danger ? "btn-danger" : "btn-primary", onClick: () => { close(); onConfirm(); } }
      ],
      onClose: onCancel
    });
  }

  // (2026-07-13) Add modal alert dialog helper; was missing causing TypeError
  function alert({ title = "Notice", message, onOk }){
    return open({
      title,
      body: `<p>${message}</p>`,
      actions: [
        { label: "OK", cls: "btn-primary", onClick: () => { close(); onOk?.(); } }
      ],
      onClose: onOk
    });
  }

  return { open, close, confirm, alert };
})();
window.Modal = Modal;
window.Modalz = Modal;
