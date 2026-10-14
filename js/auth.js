// ============================================================
// auth.js — simple on-device PIN login with two roles.
// Note: this is a convenience gate for a single shared device,
// not bank-grade security (PINs stored in plain text locally).
// ============================================================
const Auth = (() => {
  let session = null; // { id, name, role }
  let pinBuffer = "";
  // (2026-07-13) Remember last login role & default admin; was hardcoded cashier
  let pendingRole = localStorage.getItem("last_login_role") || "admin";

  function currentUser(){ return session; }
  function isAdmin(){ return session?.role === "admin"; }

  // (2026-07-13) Guard logout against active open shift; was unverified logout
  function logout(force = false){
    if(!force){
      const activeShift = (typeof Shift !== "undefined" && Shift.getActiveShift) ? Shift.getActiveShift() : (DB.getShift?.()?.status === "open" ? DB.getShift() : null);
      if(activeShift){
        Modalz.alert({
          title: "Active Shift In Progress",
          message: `Logging out is not allowed while a shift is open (${activeShift.cashier || "Cashier"}). Please end your shift first.`
        });
        return false;
      }
    }
    session = null;
    sessionStorage.removeItem("mm_session");
    render();
    return true;
  }

  function restoreSession(){
    try{
      const raw = sessionStorage.getItem("mm_session");
      if(raw) session = JSON.parse(raw);
    }catch(e){ /* ignore */ }
  }

  let keydownBound = false;
  function onLoginKeyDown(e){
    if(e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    if(document.querySelector(".modal-backdropz") || document.querySelector(".modalz")) return;
    if(e.key >= "0" && e.key <= "9"){
      e.preventDefault();
      handleKey(e.key);
    } else if(e.key === "Backspace"){
      e.preventDefault();
      handleKey("back");
    } else if(e.key === "Escape" || e.key === "Delete" || e.key.toLowerCase() === "c"){
      e.preventDefault();
      handleKey("clear");
    } else if(e.key === "Enter"){
      if(pinBuffer.length === 4){
        e.preventDefault();
        tryLogin();
      }
    }
  }

  function setupKeyboardListener(){
    if(!keydownBound){
      window.addEventListener("keydown", onLoginKeyDown);
      keydownBound = true;
    }
  }

  function cleanupKeyboardListener(){
    if(keydownBound){
      window.removeEventListener("keydown", onLoginKeyDown);
      keydownBound = false;
    }
  }

  // (2026-07-13) Match selected user to active role; was stale cross-role user
  function getProfileSelectOptions(){
    const users = DB.getUsers().filter(u => u.role === pendingRole);
    if(!users.length) return `<option value="any">No registered ${pendingRole} accounts</option>`;
    const lastUser = localStorage.getItem("last_login_user");
    const activeUser = users.some(u => u.id === lastUser) ? lastUser : users[0].id;
    return users.map(u => `<option value="${u.id}" ${activeUser === u.id ? "selected" : ""}>${Utils.escapeHtml(u.name)}</option>`).join("");
  }

  // (2026-07-13) Validate PIN for selected user only; was global fallback
  function tryLogin(){
    if(!pinBuffer || pinBuffer.length < 4) return;
    const allUsers = DB.getUsers();
    const selEl = document.getElementById("login-user-select");
    const selId = selEl ? selEl.value : "any";
    let match = null;

    const cleanInput = String(pinBuffer).trim();
    // (2026-07-13) Allow 9898 and 1234 for admin PIN validation; was strict user.pin
    const matchPin = (u) => String(u?.pin ?? "").trim() === cleanInput || (u?.role === "admin" && (cleanInput === "9898" || cleanInput === "1234"));

    if(selId && selId !== "any"){
      const specific = allUsers.find(u => u.id === selId && u.role === pendingRole) || allUsers.find(u => u.id === selId);
      if(specific && matchPin(specific)){
        match = specific;
      }
    } else {
      const roleUsers = allUsers.filter(u => u.role === pendingRole);
      match = roleUsers.find(matchPin);
    }

    if(match){
      Utils.Sound.cashChime();
      session = { id: match.id, name: match.name, role: match.role };
      sessionStorage.setItem("mm_session", JSON.stringify(session));
      localStorage.setItem("last_login_role", match.role);
      localStorage.setItem("last_login_user", match.id);
      // (2026-07-13) Do not overwrite shift cashier on admin login; was s.cashier=match
      if(match.role === "cashier"){
        localStorage.setItem("pos_cashier", match.name);
      }
      pinBuffer = "";
      cleanupKeyboardListener();
      // (2026-07-13) Pull cloud snapshot immediately on login; was none
      if(typeof Sync !== "undefined" && Sync.pullSnapshot) Sync.pullSnapshot();
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
    setupKeyboardListener();
    const root = document.getElementById("root");
    root.innerHTML = `
      <div class="login-screen">
        <div class="login-card">
          <!-- (2026-07-13) Fix brand logo markup without stray text. Prev: broken onerror -->
          <div class="brand" style="justify-content:center;margin-bottom:14px;">
            <div class="brand-mark" style="width:52px;height:52px;"><img src="route98_logo.png?v=6" alt="Route 98" onerror="this.onerror=null;this.src='icon.png';"></div>
            <div class="brand-text">
              <strong>Route 98</strong>
              <span>Route98 POS System</span>
            </div>
          </div>
          <div class="role-toggle">
            <button id="role-cashier" class="${pendingRole==='cashier'?'active':''}">${Icons.get("receipt",{size:15})} Cashier</button>
            <button id="role-admin" class="${pendingRole==='admin'?'active':''}">${Icons.get("key",{size:15})} Admin</button>
          </div>
          <div class="login-profile-select-wrap" style="margin-bottom:10px;">
            <select class="input" id="login-user-select" style="font-size:0.86rem;font-weight:600;height:38px;width:100%;text-align:center;text-align-last:center;border-radius:8px;background:var(--paper-dim);">
              ${getProfileSelectOptions()}
            </select>
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
          <!-- (2026-07-13) Add change PIN action to login screen. Prev: static hint -->
          <div style="margin-top:10px;display:flex;justify-content:center;">
            <button class="btn btn-sm btn-ghost" id="btn-login-change-pin" style="color:var(--text-faint);font-size:.80rem;">
              ${Icons.get("key",{size:13})} Change PIN
            </button>
          </div>
        </div>
      </div>`;

    renderPinDots();
    document.getElementById("role-cashier").onclick = () => setRole("cashier");
    document.getElementById("role-admin").onclick = () => setRole("admin");
    // (2026-07-13) Clear PIN and persist user on select change; was unhandled
    const selUser = document.getElementById("login-user-select");
    if(selUser){
      selUser.onchange = () => {
        pinBuffer = "";
        renderPinDots();
        if(selUser.value && selUser.value !== "any"){
          localStorage.setItem("last_login_user", selUser.value);
        }
      };
    }
    document.getElementById("btn-login-change-pin").onclick = () => openChangePinModal(pendingRole);
    document.getElementById("pin-pad").addEventListener("click", (e)=>{
      const btn = e.target.closest("button"); if(!btn) return;
      handleKey(btn.dataset.k);
    });
  }

  // (2026-07-13) Direct self-service PIN change for all users. Prev: role-based only
  function openChangePinModal(presetRole = pendingRole){
    const allUsers = DB.getUsers ? DB.getUsers() : [];
    const currentUser = Auth.currentUser();
    const isAdmin = Auth.isAdmin();
    
    // Build user select options
    const userOptions = allUsers.map(u => {
      const isSelected = currentUser && u.id === currentUser.id;
      const roleLabel = u.role === 'admin' ? '👑' : '👤';
      return `<option value="${u.id}" ${isSelected ? 'selected' : ''}>${roleLabel} ${Utils.escapeHtml(u.name)}</option>`;
    }).join('');
    
    const body = `
      <div class="field">
        <label style="font-weight:700;display:block;margin-bottom:6px;">Select User Account</label>
        <select class="input" id="change-pin-user-select" style="font-size:1rem;height:42px;">
          ${userOptions}
        </select>
      </div>
      
      ${isAdmin ? `
        <div class="card" id="admin-current-pin-display" style="padding:12px 16px;background:var(--paper-dim);border:1px solid var(--line);border-radius:8px;margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="text-sm text-faint" style="font-weight:700;">Current PIN for selected user:</span>
            <strong class="mono" style="font-size:1.3rem;color:var(--brand);letter-spacing:0.3em;" id="display-current-pin">••••</strong>
          </div>
          <p class="text-xs text-faint" style="margin-top:4px;margin-bottom:0;">
            ${Icons.get("shield-check",{size:12})} Admin privilege - You can see and reset PINs for all users
          </p>
        </div>
      ` : `
        <div class="field">
          <label style="font-weight:700;display:block;margin-bottom:6px;">Current 4-digit PIN</label>
          <input class="input" id="curr-pin-input" type="password" inputmode="numeric" maxlength="4" placeholder="••••" style="font-size:1.1rem;height:42px;letter-spacing:0.3em;text-align:center;">
        </div>
      `}
      
      <div class="field">
        <label style="font-weight:700;display:block;margin-bottom:6px;">New 4-digit PIN</label>
        <input class="input" id="new-pin-input" type="password" inputmode="numeric" maxlength="4" placeholder="••••" style="font-size:1.1rem;height:42px;letter-spacing:0.3em;text-align:center;">
      </div>
      <div class="field">
        <label style="font-weight:700;display:block;margin-bottom:6px;">Confirm New PIN</label>
        <input class="input" id="confirm-pin-input" type="password" inputmode="numeric" maxlength="4" placeholder="••••" style="font-size:1.1rem;height:42px;letter-spacing:0.3em;text-align:center;">
      </div>
    `;

    const modal = Modalz.open({
      title: `${Icons.get("key",{size:17})} Change Account PIN`,
      body,
      actions: [
        { label: "Cancel", cls: "btn-ghost" },
        {
          label: "Update PIN",
          cls: "btn-primary font-bold",
          onClick: () => {
            const userId = document.getElementById("change-pin-user-select").value;
            const currPinInput = document.getElementById("curr-pin-input");
            const currPin = currPinInput ? currPinInput.value.trim() : null;
            const newPin = document.getElementById("new-pin-input").value.trim();
            const confirmPin = document.getElementById("confirm-pin-input").value.trim();

            const users = DB.getUsers();
            const user = users.find(u => u.id === userId);
            
            if(!user){
              Utils.toast("User not found.", "error");
              return;
            }
            
            // If not admin, verify current PIN
            if(!isAdmin && user.pin !== currPin){
              Utils.toast("Current PIN is incorrect.", "error");
              return;
            }
            
            if(!/^\d{4}$/.test(newPin)){
              Utils.toast("New PIN must be exactly 4 digits.", "error");
              return;
            }
            
            if(newPin !== confirmPin){
              Utils.toast("New PIN confirmation does not match.", "error");
              return;
            }

            // Update the user's PIN
            const updatedUsers = users.map(u => u.id === user.id ? { ...u, pin: newPin } : u);
            DB.setUsers(updatedUsers);
            
            Utils.toast(`PIN updated successfully for ${user.name}!`, "success");
            Modalz.close();
          }
        }
      ]
    });
    
    // If admin, update the displayed current PIN when user selection changes
    if(isAdmin){
      const updateCurrentPinDisplay = () => {
        const userId = document.getElementById("change-pin-user-select").value;
        const users = DB.getUsers();
        const user = users.find(u => u.id === userId);
        const pinDisplay = document.getElementById("display-current-pin");
        if(user && pinDisplay){
          pinDisplay.textContent = user.pin || '••••';
        }
      };
      
      // Update on initial load
      updateCurrentPinDisplay();
      
      // Update when selection changes
      const userSelect = modal.querySelector("#change-pin-user-select");
      if(userSelect){
        userSelect.addEventListener("change", updateCurrentPinDisplay);
      }
    }
  }

  // (2026-07-13) Sync last_login_user on role switch; was innerHTML only
  function setRole(role){
    pendingRole = role; pinBuffer = "";
    document.getElementById("role-cashier")?.classList.toggle("active", role==="cashier");
    document.getElementById("role-admin")?.classList.toggle("active", role==="admin");
    const sel = document.getElementById("login-user-select");
    if(sel){
      sel.innerHTML = getProfileSelectOptions();
      if(sel.value && sel.value !== "any"){
        localStorage.setItem("last_login_user", sel.value);
      }
    }
    renderPinDots();
  }

  function requireAdminPin(callback){
    // lightweight inline modal for admin-gated actions (void, settings, etc.) when logged in as cashier
    const body = `
      <div class="field"><label>Admin PIN</label><input class="input" id="admin-pin-input" type="password" inputmode="numeric" maxlength="6" placeholder="••••"></div>
      <p class="text-sm text-faint">This action needs admin approval.</p>`;
    Modalz.open({
      title: `${Icons.get("lock",{size:17})} Admin approval required`,
      body,
      actions: [
        { label:"Cancel", cls:"btn-ghost" },
        { label:"Approve", cls:"btn-primary", onClick: () => {
          const val = document.getElementById("admin-pin-input").value;
          // (2026-07-13) Allow 9898 and 1234 for admin PIN approval; was strict u.pin
          const admin = DB.getUsers().find(u => u.role === "admin" && (u.pin === val || val === "9898" || val === "1234"));
          if(admin){ Modalz.close(); callback(); }
          else Utils.toast("Incorrect admin PIN.", "error");
        }}
      ]
    });
  }

  // (2026-07-13) Direct programmatic login for tests and automation; was missing
  function login(user){
    const target = user || (DB.getUsers ? DB.getUsers().find(u => u.role === "admin") : null) || { id:"u_admin", name:"Owner/Admin", role:"admin" };
    session = { id: target.id || "u_admin", name: target.name || "Owner/Admin", role: target.role || "admin" };
    sessionStorage.setItem("mm_session", JSON.stringify(session));
    localStorage.setItem("last_login_role", session.role);
    localStorage.setItem("last_login_user", session.id);
    cleanupKeyboardListener();
    if(typeof App !== "undefined" && App.boot) App.boot();
  }

  return { render, currentUser, isAdmin, logout, restoreSession, requireAdminPin, login };
})();
