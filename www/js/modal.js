// ============================================================
// modal.js — small reusable modal/dialog system
// Locks background scroll while open, closes on backdrop click
// or Escape, and animates in/out.
// ============================================================
const Modal = (() => {
  let isHandlingHistoryPop = false;

  // (2026-07-13) Universal back button closes all modals; was Escape key only
  function close(onClosed){
    const bd = document.querySelector(".modal-backdrop:not(.modal-closing)");
    if(bd){
      bd.classList.add("modal-closing");
      if(!isHandlingHistoryPop && window.history.state?.modalOpen){
        isHandlingHistoryPop = true;
        window.history.back();
        setTimeout(() => { isHandlingHistoryPop = false; }, 150);
      }
      setTimeout(() => {
        bd.remove();
        if(!document.querySelector(".modal-backdrop")) document.body.classList.remove("scroll-locked");
        if(typeof onClosed === "function") onClosed();
      }, 180);
    } else if(!document.querySelector(".modal-backdrop")){
      document.body.classList.remove("scroll-locked");
      if(typeof onClosed === "function") onClosed();
    }
  }

  // (2026-07-13) Support modalClass for custom dialog styling; was default only
  function open({ title, body, actions = [], wide = false, onClose, modalClass = "" }){
    close();
    // (2026-07-13) Close open dropdowns before opening modal; was staying open
    if(typeof UISelect !== "undefined" && UISelect.closeAll) UISelect.closeAll();
    document.body.classList.add("scroll-locked");
    // (2026-07-13) Define backdrop element; was missing element declaration
    const backdrop = document.createElement("div");
    // (2026-07-13) Clean backdrop classes mapping; was leaking dialog classes
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
    backdrop.addEventListener("mousedown", (e)=>{ if(e.target === backdrop){ close(onClose); } });
    backdrop.querySelector("#modal-x").onclick = () => { close(onClose); };
    const escHandler = (e) => { if(e.key === "Escape"){ close(onClose); document.removeEventListener("keydown", escHandler); } };
    document.addEventListener("keydown", escHandler);
    actions.forEach((a,i) => {
      backdrop.querySelector(`[data-i="${i}"]`).onclick = () => a.onClick ? a.onClick() : close(onClose);
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

  function handleUniversalBack(){
    const bd = document.querySelector(".modal-backdrop:not(.modal-closing)");
    if(bd){
      const xBtn = bd.querySelector("#modal-x");
      if(xBtn) xBtn.click();
      else close();
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
    setTimeout(() => { isHandlingHistoryPop = false; }, 150);
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
