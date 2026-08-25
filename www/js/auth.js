// ============================================================
// auth.js — simple on-device PIN login with two roles.
// Note: this is a convenience gate for a single shared device,
// not bank-grade security (PINs stored in plain text locally).
// ============================================================
const Auth = (() => {
  let session = null; // { id, name, role }
  let pinBuffer = "";
  let pendingRole = "cashier";

  function currentUser(){ return session; }
  function isAdmin(){ return session?.role === "admin"; }

  function logout(){
    session = null;
    sessionStorage.removeItem("mm_session");
    render();
  }

  function restoreSession(){
    try{
      const raw = sessionStorage.getItem("mm_session");
      if(raw) session = JSON.parse(raw);
    }catch(e){ /* ignore */ }
  }

  // (2026-07-13) Add Sound feedback on PIN keypad entry & login; was silent
  function tryLogin(){
    const users = DB.getUsers().filter(u => u.role === pendingRole);
    const match = users.find(u => u.pin === pinBuffer);
    if(match){
      Utils.Sound.cashChime();
      session = { id: match.id, name: match.name, role: match.role };
      sessionStorage.setItem("mm_session", JSON.stringify(session));
      pinBuffer = "";
      App.boot();
    } else {
      Utils.Sound.error();
      Utils.toast("Incorrect PIN, try again.", "error");
      pinBuffer = "";
      renderPinDots();
    }
  }

  function renderPinDots(){
    const wrap = document.getElementById("pin-dots");
    if(!wrap) return;
    wrap.innerHTML = Array.from({length:4}).map((_,i)=>
      `<div class="d ${i < pinBuffer.length ? "filled":""}"></div>`).join("");
  }

  function handleKey(k){
    Utils.Sound.click();
    if(k === "back"){ pinBuffer = pinBuffer.slice(0,-1); renderPinDots(); return; }
    if(k === "clear"){ pinBuffer = ""; renderPinDots(); return; }
    if(pinBuffer.length >= 4) return;
    pinBuffer += k;
    renderPinDots();
    if(pinBuffer.length === 4) setTimeout(tryLogin, 120);
  }

  function render(){
    const root = document.getElementById("root");
    root.innerHTML = `
      <div class="login-screen">
        <div class="login-card">
          <!-- (2026-07-13) Update logo to route98_logo.png?v=6; was v=5 -->
          <div class="brand" style="justify-content:center;margin-bottom:14px;">
            <div class="brand-mark" style="width:52px;height:52px;"><img src="route98_logo.png?v=6" alt="Route 98" onerror="this.style.display='none';this.parentElement.innerHTML='${Icons.get('store',{size:22})}';"></div>
            <div class="brand-text">
              <strong>Route 98</strong>
              <span>Route98 POS System</span>
            </div>
          </div>
          <div class="role-toggle">
            <button id="role-cashier" class="active">${Icons.get("receipt",{size:15})} Cashier</button>
            <button id="role-admin">${Icons.get("key",{size:15})} Admin</button>
          </div>
          <p class="text-sm text-faint" style="text-align:center;margin-bottom:6px;">Enter your 4-digit PIN</p>
          <div class="pin-dots" id="pin-dots"></div>
          <div class="pin-pad" id="pin-pad">
            ${["1","2","3","4","5","6","7","8","9","clear","0","back"].map(k=>{
              if(k==="clear") return `<button data-k="clear">C</button>`;
              if(k==="back") return `<button data-k="back">${Icons.get("chevron-left",{size:18})}</button>`;
              return `<button data-k="${k}">${k}</button>`;
            }).join("")}
          </div>
          <p class="login-hint">Demo PINs — Admin: 1234 · Cashier: 1111<br>(change these anytime in Settings)</p>
        </div>
      </div>`;

    renderPinDots();
    document.getElementById("role-cashier").onclick = () => setRole("cashier");
    document.getElementById("role-admin").onclick = () => setRole("admin");
    document.getElementById("pin-pad").addEventListener("click", (e)=>{
      const btn = e.target.closest("button"); if(!btn) return;
      handleKey(btn.dataset.k);
    });
  }

  function setRole(role){
    pendingRole = role; pinBuffer = "";
    document.getElementById("role-cashier").classList.toggle("active", role==="cashier");
    document.getElementById("role-admin").classList.toggle("active", role==="admin");
    renderPinDots();
  }

  function requireAdminPin(callback){
    // lightweight inline modal for admin-gated actions (void, settings, etc.) when logged in as cashier
    const body = `
      <div class="field"><label>Admin PIN</label><input class="input" id="admin-pin-input" type="password" inputmode="numeric" maxlength="6" placeholder="••••"></div>
      <p class="text-sm text-faint">This action needs admin approval.</p>`;
    Modal.open({
      title: `${Icons.get("lock",{size:17})} Admin approval required`,
      body,
      actions: [
        { label:"Cancel", cls:"btn-ghost" },
        { label:"Approve", cls:"btn-primary", onClick: () => {
          const val = document.getElementById("admin-pin-input").value;
          const admin = DB.getUsers().find(u => u.role === "admin" && u.pin === val);
          if(admin){ Modal.close(); callback(); }
          else Utils.toast("Incorrect admin PIN.", "error");
        }}
      ]
    });
  }

  return { render, currentUser, isAdmin, logout, restoreSession, requireAdminPin };
})();
