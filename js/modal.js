// ============================================================
// modal.js — small reusable modal/dialog system
// Locks background scroll while open, closes on backdrop click
// or Escape, and animates in/out.
// ============================================================
const Modal = (() => {
  function close(){
    const bd = document.querySelector(".modal-backdrop");
    if(bd){
      bd.style.opacity = "0";
      setTimeout(() => bd.remove(), 120);
    }
    if(!document.querySelector(".modal-backdrop")) document.body.classList.remove("scroll-locked");
  }

  function open({ title, body, actions = [], wide = false, onClose }){
    close();
    document.body.classList.add("scroll-locked");
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal ${wide ? "modal-wide":""}">
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

  function confirm({ title = "Are you sure?", message, danger = false, onConfirm }){
    open({
      title,
      body: `<p>${message}</p>`,
      actions: [
        { label:"Cancel", cls:"btn-ghost" },
        { label: danger ? "Yes, delete" : "Confirm", cls: danger ? "btn-danger" : "btn-primary", onClick: () => { close(); onConfirm(); } }
      ]
    });
  }

  return { open, close, confirm };
})();
