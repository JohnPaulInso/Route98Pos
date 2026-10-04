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
  function open({ title, body, actions = [], wide = false, onClose, modalClass = "", preventBackdropClose = false }){
    if(typeof UISelect !== "undefined" && UISelect.closeAll) UISelect.closeAll();
    try { window.history.pushState({ modalOpen: true, modalId: Date.now() }, ""); } catch(e){}
    document.body.classList.add("scroll-locked");
    const backdrop = document.createElement("div");
    backdrop._onClose = onClose;
    backdrop._preventBackdropClose = preventBackdropClose;
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
    // (2026-10-02) Fix APK: mousedown unreliable in Capacitor WebView; was mousedown
    backdrop.addEventListener("click", (e)=>{ 
      if(e.target === backdrop && !preventBackdropClose){ 
        close(backdrop, onClose); 
      } 
    });
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
  let exitPressCount = 0;
  let lastExitPressTs = 0;

  function isPageScrolled(){
    if(window.scrollY > 20 || document.documentElement.scrollTop > 20 || document.body.scrollTop > 20) return true;
    const catalog = document.querySelector(".pos-catalog");
    if(catalog && catalog.scrollTop > 20) return true;
    const view = document.querySelector(".view");
    if(view && view.scrollTop > 20) return true;
    const viewBody = document.querySelector(".view-body");
    if(viewBody && viewBody.scrollTop > 20) return true;
    const rpt = document.querySelector(".report-body");
    if(rpt && rpt.scrollTop > 20) return true;
    const scrollables = document.querySelectorAll("#root *");
    for(let i = 0; i < scrollables.length; i++){
      if(scrollables[i].scrollTop > 20) return true;
    }
    return false;
  }

  function scrollPageToTop(){
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
    document.body.scrollTo({ top: 0, behavior: "smooth" });
    const catalog = document.querySelector(".pos-catalog");
    if(catalog && catalog.scrollTop > 0) catalog.scrollTo({ top: 0, behavior: "smooth" });
    const view = document.querySelector(".view");
    if(view && view.scrollTop > 0) view.scrollTo({ top: 0, behavior: "smooth" });
    const viewBody = document.querySelector(".view-body");
    if(viewBody && viewBody.scrollTop > 0) viewBody.scrollTo({ top: 0, behavior: "smooth" });
    const scrollables = document.querySelectorAll("#root *");
    for(let i = 0; i < scrollables.length; i++){
      if(scrollables[i].scrollTop > 0) scrollables[i].scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function exitApplication(){
    if(window.Capacitor?.Plugins?.App?.exitApp){
      window.Capacitor.Plugins.App.exitApp();
    } else if(navigator.app?.exitApp){
      navigator.app.exitApp();
    } else if(navigator.device?.exitApp){
      navigator.device.exitApp();
    } else {
      window.close();
    }
  }

  // (2026-07-13) Universal back: modals, scroll, pos, exit; was modal-only
  function handleUniversalBack(){
    const now = Date.now();
    if(now - lastBackTs < 260) return true;
    lastBackTs = now;

    const bds = document.querySelectorAll(".modal-backdrop:not(.modal-closing)");
    if(bds.length){
      exitPressCount = 0;
      const bd = bds[bds.length - 1];
      const xBtn = bd.querySelector("#modal-x");
      if(xBtn) xBtn.click();
      else close(bd, bd._onClose);
      return true;
    }
    const scanner = document.getElementById("scanner-overlay");
    if(scanner){
      exitPressCount = 0;
      const closeScan = scanner.querySelector(".scan-close-btn");
      if(closeScan) closeScan.click();
      else if(typeof Scanner !== "undefined" && Scanner.stop) Scanner.stop();
      return true;
    }
    const cartEl = document.querySelector(".pos-cart.expanded");
    if(cartEl){
      exitPressCount = 0;
      cartEl.classList.remove("expanded");
      return true;
    }
    if(typeof UISelect !== "undefined" && UISelect.closeAll && document.querySelector(".ui-select-list")){
      exitPressCount = 0;
      UISelect.closeAll();
      return true;
    }
    const invMenu = document.getElementById("inv-tools-menu");
    if(invMenu && invMenu.style.display !== "none"){
      exitPressCount = 0;
      invMenu.style.display = "none";
      return true;
    }
    const openMenus = document.querySelectorAll(".rpt-dropdown-menu.show, .dropdown-menu.show");
    if(openMenus.length){
      exitPressCount = 0;
      openMenus.forEach(m => m.classList.remove("show"));
      return true;
    }

    if(isPageScrolled()){
      exitPressCount = 0;
      scrollPageToTop();
      return true;
    }

    const cur = (typeof App !== "undefined" && App.getCurrentView) ? App.getCurrentView() : "pos";
    if(cur !== "pos"){
      exitPressCount = 0;
      if(typeof App !== "undefined" && App.navigate){
        App.navigate("pos");
        return true;
      }
    }

    if(exitPressCount >= 1 && (now - lastExitPressTs < 2500)){
      exitPressCount = 0;
      lastExitPressTs = 0;
      exitApplication();
      return true;
    } else {
      exitPressCount = 1;
      lastExitPressTs = now;
      if(typeof Utils !== "undefined" && Utils.toast){
        Utils.toast("Press back again to exit", "info", 2200);
      }
      return true;
    }
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

  let capacitorBackAttached = false;
  function attachCapacitorBack(){
    if(capacitorBackAttached) return;
    const appPlugin = window.Capacitor?.Plugins?.App;
    if(appPlugin?.addListener){
      capacitorBackAttached = true;
      appPlugin.addListener("backButton", () => {
        handleUniversalBack();
      }).catch(() => {});
    }
  }
  attachCapacitorBack();
  document.addEventListener("DOMContentLoaded", attachCapacitorBack);
  document.addEventListener("deviceready", attachCapacitorBack, false);
  window.addEventListener("load", attachCapacitorBack);
  let attachTries = 0;
  const attachInterval = setInterval(() => {
    attachTries++;
    attachCapacitorBack();
    if(capacitorBackAttached || attachTries > 15) clearInterval(attachInterval);
  }, 200);

  return { open, close, confirm, handleUniversalBack };
})();
// (2026-07-13) Expose Modal on window for WebView access; was const-scoped only
window.Modal = Modal;

