// ============================================================
// modal.js — small reusable modal/dialog system
// Locks background scroll while open, closes on backdrop click
// or Escape, and animates in/out.
// ============================================================
const Modal = (() => {
  // (2026-07-13) Modal smooth exit animation timing; was 120ms opacity fade
  function close(){
    const bd = document.querySelector(".modal-backdrop");
    if(bd && !bd.classList.contains("modal-closing")){
      bd.classList.add("modal-closing");
      setTimeout(() => {
        bd.remove();
        if(!document.querySelector(".modal-backdrop")) document.body.classList.remove("scroll-locked");
      }, 180);
    } else if(!bd){
      document.body.classList.remove("scroll-locked");
    }
  }

  // (2026-07-13) Support modalClass for custom dialog styling; was default only
  function open({ title, body, actions = [], wide = false, onClose, modalClass = "" }){
    close();
    // (2026-07-13) Close open dropdowns before opening modal; was staying open
    if(typeof UISelect !== "undefined" && UISelect.closeAll) UISelect.closeAll();
    document.body.classList.add("scroll-locked");
    const backdrop = document.createElement("div");
    backdrop.className = `modal-backdrop ${modalClass ? `${modalClass}-backdrop` : ""}`;
    backdrop.innerHTML = `
      <div class="modal ${wide ? "modal-wide":""} ${modalClass}">
        <div class="modal-head">
          <h3>${title}</h3>
          <button class="icon-btn" id="modal-x">${Icons.get("x", { size:16 })}</button>
        </div>
        <div class="modal-body">${body}</div>
        ${actions.length ? `<div class="modal-foot">${actions.map((a,i)=>`<button class="btn ${a.cls||""}" data-i="${i}">${a.label}</button>`).join("")}</div>` : ""}
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener("mousedown", (e)=>{ if(e.target === backdrop){ close(); onClose?.(); } });
    backdrop.querySelector("#modal-x").onclick = () => { close(); onClose?.(); };
    const escHandler = (e) => { if(e.key === "Escape"){ close(); onClose?.(); document.removeEventListener("keydown", escHandler); } };
    document.addEventListener("keydown", escHandler);
    actions.forEach((a,i) => {
      backdrop.querySelector(`[data-i="${i}"]`).onclick = () => a.onClick ? a.onClick() : close();
    });
    return backdrop;
  }

  // (2026-07-13) Support onCancel and modal dismiss; was confirm only
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

  return { open, close, confirm };
})();
