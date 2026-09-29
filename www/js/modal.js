// ============================================================
// modal.js — small reusable modal/dialog system
// Locks background scroll while open, closes on backdrop click
// or Escape, and animates in/out.
// ============================================================
const Modal = (() => {
  let isHandlingHistoryPop = false;

  // (2026-07-13) Close topmost modal slowly one by one; was closing first modal
  function close(targetBd, onClosed){
    if(typeof targetBd === "function"){ onClosed = targetBd; targetBd = null; }
    const bds = document.querySelectorAll(".modal-backdrop:not(.modal-closing)");
    const bd = targetBd || (bds.length ? bds[bds.length - 1] : null);
    if(bd){
      bd.classList.add("modal-closing");
      if(!isHandlingHistoryPop && window.history.state?.modalOpen){
        isHandlingHistoryPop = true;
        window.history.back();
        setTimeout(() => { isHandlingHistoryPop = false; }, 260);
      }
      setTimeout(() => {
        bd.remove();
        if(!document.querySelector(".modal-backdrop")) document.body.classList.remove("scroll-locked");
        if(typeof onClosed === "function") onClosed();
        else if(typeof bd._onClose === "function") bd._onClose();
      }, 240);
    } else if(!document.querySelector(".modal-backdrop")){
      document.body.classList.remove("scroll-locked");
      if(typeof onClosed === "function") onClosed();
    }
  }

  // (2026-07-13) Push history state & preserve modal stack; was close() wiping
  function open({ title, body, actions = [], wide = false, onClose, modalClass = "" }){
    if(typeof UISelect !== "undefined" && UISelect.closeAll) UISelect.closeAll();
    try { window.history.pushState({ modalOpen: true, modalId: Date.now() }, ""); } catch(e){}
    document.body.classList.add("scroll-locked");
    const backdrop = document.createElement("div");
    backdrop._onClose = onClose;
    const extraBackdrop = modalClass ? modalClass.trim().split(/\s+/).filter(Boolean).map(c => `${c}-backdrop`).join(" ") : "";
    backdrop.className = `modal-backdrop ${extraBackdrop}`.trim();
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
    backdrop.addEventListener("mousedown", (e)=>{ if(e.target === backdrop){ close(backdrop, onClose); } });
    backdrop.querySelector("#modal-x").onclick = () => { close(backdrop, onClose); };
    const escHandler = (e) => { if(e.key === "Escape"){ close(backdrop, onClose); document.removeEventListener("keydown", escHandler); } };
    document.addEventListener("keydown", escHandler);
    actions.forEach((a,i) => {
      backdrop.querySelector(`[data-i="${i}"]`).onclick = () => a.onClick ? a.onClick() : close(backdrop, onClose);
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

  let lastBackTs = 0;
  // (2026-07-13) Universal back throttled one by one; was closing first modal
  function handleUniversalBack(){
    const now = Date.now();
    if(now - lastBackTs < 320) return true;
    lastBackTs = now;
    const bds = document.querySelectorAll(".modal-backdrop:not(.modal-closing)");
    if(bds.length){
      const bd = bds[bds.length - 1];
      const xBtn = bd.querySelector("#modal-x");
      if(xBtn) xBtn.click();
      else close(bd, bd._onClose);
      return true;
    }
    const scanner = document.getElementById("scanner-overlay");
    if(scanner){
      const closeScan = scanner.querySelector(".scan-close-btn");
      if(closeScan) closeScan.click();
      else if(typeof Scanner !== "undefined" && Scanner.stop) Scanner.stop();
      return true;
    }
    const cartEl = document.querySelector(".pos-cart.expanded");
    if(cartEl){
      cartEl.classList.remove("expanded");
      return true;
    }
    if(typeof UISelect !== "undefined" && UISelect.closeAll && document.querySelector(".ui-select-list")){
      UISelect.closeAll();
      return true;
    }
    return false;
  }

  window.addEventListener("popstate", () => {
    if(isHandlingHistoryPop){
      isHandlingHistoryPop = false;
      return;
    }
    isHandlingHistoryPop = true;
    handleUniversalBack();
    setTimeout(() => { isHandlingHistoryPop = false; }, 260);
  });

  document.addEventListener("backbutton", (e) => {
    if(handleUniversalBack()){
      e.preventDefault();
      e.stopPropagation();
    }
  }, false);

  function attachCapacitorBack(){
    if(window.Capacitor?.Plugins?.App?.addListener){
      window.Capacitor.Plugins.App.addListener("backButton", () => {
        handleUniversalBack();
      }).catch(() => {});
    }
  }
  attachCapacitorBack();
  document.addEventListener("deviceready", attachCapacitorBack, false);

  return { open, close, confirm, handleUniversalBack };
})();
