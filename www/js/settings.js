// ============================================================
// settings.js — admin-only configuration screen
// ============================================================
const Settings = (() => {
  let tab = "business";

  function saveBusinessInfo(){
    const s = DB.getSettings();
    s.businessName = document.getElementById("s-name").value.trim() || s.businessName;
    s.address = document.getElementById("s-address").value.trim();
    s.tin = document.getElementById("s-tin").value.trim();
    s.receiptFooter = document.getElementById("s-footer").value.trim();
    s.currencySymbol = document.getElementById("s-currency").value.trim() || "₱";
    DB.setSettings(s);
    Utils.toast("Business info saved.", "success");
    App.paintTopbar();
  }

  function toggleVat(checked){
    const s = DB.getSettings(); s.vatEnabled = checked; DB.setSettings(s);
    document.getElementById("s-vat-rate-row").style.display = checked ? "flex" : "none";
  }
  function saveVatRate(){
    const s = DB.getSettings(); s.vatRate = Number(document.getElementById("s-vat-rate").value)||0; DB.setSettings(s);
    Utils.toast("VAT rate updated.", "success");
  }

  function toggleTheme(checked){
    const s = DB.getSettings(); s.theme = checked ? "dark" : "light"; DB.setSettings(s);
    document.documentElement.dataset.theme = s.theme;
  }

  function renderStaffTable(){
    const wrap = document.getElementById("staff-table");
    const users = DB.getUsers();
    wrap.innerHTML = `<div class="table-wrap"><table class="data"><thead><tr><th>Name</th><th>Role</th><th>PIN</th><th></th></tr></thead><tbody>
      ${users.map(u => `<tr>
        <td>${Utils.escapeHtml(u.name)}</td>
        <td><span class="badge ${u.role==="admin"?"badge-amber":"badge-info"}">${u.role}</span></td>
        <td class="mono">••••</td>
        <td style="text-align:right;"><button class="btn btn-sm btn-ghost" data-edit-user="${u.id}">${Icons.get("edit",{size:13})} Edit</button></td>
      </tr>`).join("")}
    </tbody></table></div>`;
    wrap.querySelectorAll("[data-edit-user]").forEach(b => b.onclick = () => editUser(b.dataset.editUser));
  }

  function editUser(id){
    const u = DB.getUsers().find(x=>x.id===id);
    const body = `
      <div class="field"><label>Name</label><input class="input" id="u-name" value="${Utils.escapeHtml(u.name)}"></div>
      <div class="field"><label>New 4-digit PIN</label><input class="input" id="u-pin" maxlength="4" placeholder="Leave blank to keep current"></div>`;
    Modal.open({
      title:`Edit ${u.role}`, body,
      actions:[{label:"Cancel",cls:"btn-ghost"},{label:"Save",cls:"btn-primary", onClick:()=>{
        const name = document.getElementById("u-name").value.trim();
        const pin = document.getElementById("u-pin").value.trim();
        const users = DB.getUsers().map(x => x.id===id ? { ...x, name: name||x.name, pin: pin.length===4 ? pin : x.pin } : x);
        DB.setUsers(users);
        Utils.toast("Staff account updated.", "success");
        Modal.close(); renderStaffTable();
      }}]
    });
  }

  function renderPumpConfig(){
    const wrap = document.getElementById("pump-config-table");
    const cfg = DB.getFuelConfig();
    wrap.innerHTML = `<div class="table-wrap"><table class="data"><thead><tr><th>Pump</th><th>Fuel Type</th><th></th></tr></thead><tbody>
      ${cfg.pumps.map(p => `<tr>
        <td>${Utils.escapeHtml(p.label)}</td>
        <td>${cfg.fuels[p.fuelType]?.name || p.fuelType}</td>
        <td style="text-align:right;"><button class="btn btn-sm btn-ghost" data-rm-pump="${p.id}">${Icons.get("trash",{size:13})}</button></td>
      </tr>`).join("")}
    </tbody></table></div>
    <div class="input-row" style="margin-top:10px;">
      <input class="input" id="new-pump-label" placeholder="e.g. Pump 4">
      <div id="new-pump-fuel-wrap" style="flex:1;"></div>
      <button class="btn btn-primary" id="add-pump">Add Pump</button>
    </div>`;
    wrap.querySelector("#new-pump-fuel-wrap").innerHTML = UISelect.render("new-pump-fuel",
      Object.entries(cfg.fuels).map(([k,f])=>({ value:k, label:f.name })), Object.keys(cfg.fuels)[0]);
    UISelect.bind("new-pump-fuel");
    wrap.querySelectorAll("[data-rm-pump]").forEach(b => b.onclick = () => {
      const cfgNow = DB.getFuelConfig();
      cfgNow.pumps = cfgNow.pumps.filter(p => p.id !== b.dataset.rmPump);
      DB.setFuelConfig(cfgNow);
      renderPumpConfig();
    });
    wrap.querySelector("#add-pump").onclick = () => {
      const label = document.getElementById("new-pump-label").value.trim();
      const fuelType = UISelect.getValue("new-pump-fuel");
      if(!label){ Utils.toast("Enter a pump label.", "warn"); return; }
      const cfgNow = DB.getFuelConfig();
      cfgNow.pumps.push({ id: Utils.uid("pump"), label, fuelType });
      DB.setFuelConfig(cfgNow);
      renderPumpConfig();
      Utils.toast("Pump added.", "success");
    };
  }

  function renderDataTab(){
    const wrap = document.getElementById("view-tab-body");
    const settings = DB.getSettings();
    wrap.innerHTML = `
      <div class="grid-2">
        <div class="card">
          <h3 style="margin-bottom:10px;">${Icons.get("download",{size:16})} Export</h3>
          <p class="text-sm text-faint" style="margin-bottom:12px;">Download full JSON backup, inventory CSV, or category list.</p>
          <button class="btn btn-block" id="btn-export-json" style="margin-bottom:8px;">Full Backup (.json)</button>
          <div class="grid-2" style="gap:8px;">
            <button class="btn btn-block" id="btn-export-csv">Inventory (.csv)</button>
            <button class="btn btn-block" id="btn-export-cats">Categories (.csv)</button>
          </div>
        </div>
        <div class="card">
          <h3 style="margin-bottom:10px;">${Icons.get("upload",{size:16})} Import / Restore</h3>
          <p class="text-sm text-faint" style="margin-bottom:12px;">Restore a full backup, or bulk-import products from CSV/JSON.</p>
          <button class="btn btn-block" id="btn-import-json" style="margin-bottom:8px;">Restore Full Backup</button>
          <button class="btn btn-block" id="btn-import-csv">Import Products (CSV/JSON)</button>
          <input type="file" id="file-json" accept=".json" class="hidden">
          <input type="file" id="file-csv" accept=".csv,.json" class="hidden">
        </div>
      </div>
      <div class="card" style="margin-top:14px;">
        <h3 style="margin-bottom:10px;">${Icons.get("cloud",{size:16})} Firestore Sync (optional)</h3>
        <p class="text-sm text-faint" style="margin-bottom:12px;">Everything already saves to this device instantly. Paste your Firebase project config below to also back up a snapshot to Firestore — great for syncing across devices.</p>
        <div class="field"><label>Firebase config (JSON)</label>
          <textarea class="input" id="firebase-config" rows="5" placeholder='{"apiKey":"...","projectId":"...","...":"..."}'>${settings.firebaseConfig ? JSON.stringify(settings.firebaseConfig,null,2) : ""}</textarea>
        </div>
        <div class="switch-row" style="margin-bottom:12px;">
          <span class="text-sm">Auto-sync after every change</span>
          <label class="switch"><input type="checkbox" id="s-autosync" ${settings.autoSync?"checked":""}><span class="track"></span></label>
        </div>
        <div class="input-row">
          <button class="btn" id="btn-save-firebase">Save Config</button>
          <button class="btn btn-primary" id="btn-sync-now">${Icons.get("cloud-check",{size:15})} Sync Now</button>
          <button class="btn btn-ghost" id="btn-pull-now">${Icons.get("download",{size:15})} Pull Latest</button>
        </div>
      </div>
      <div class="card" style="margin-top:14px;border-color:var(--danger);">
        <h3 style="margin-bottom:10px;color:var(--danger-deep);">${Icons.get("alert-triangle",{size:16})} Danger Zone</h3>
        <p class="text-sm text-faint" style="margin-bottom:12px;">These actions can't be undone. Export a backup first.</p>
        <button class="btn btn-danger" id="btn-wipe">Reset All Data</button>
      </div>`;

    // (2026-07-13) Add categories export button; was full backup and products only
    document.getElementById("btn-export-json").onclick = ImportExport.exportFullBackup;
    document.getElementById("btn-export-csv").onclick = ImportExport.exportInventoryCSV;
    document.getElementById("btn-export-cats").onclick = ImportExport.exportCategoriesCSV;
    document.getElementById("btn-import-json").onclick = () => document.getElementById("file-json").click();
    document.getElementById("btn-import-csv").onclick = () => document.getElementById("file-csv").click();
    document.getElementById("file-json").addEventListener("change", e => ImportExport.importFullBackupFile(e.target.files[0], () => App.rerenderCurrentView()));
    document.getElementById("file-csv").addEventListener("change", e => ImportExport.importInventoryFile(e.target.files[0], () => Utils.toast("Products imported.","success")));

    document.getElementById("btn-save-firebase").onclick = () => {
      const raw = document.getElementById("firebase-config").value.trim();
      const s = DB.getSettings();
      try{
        s.firebaseConfig = raw ? JSON.parse(raw) : null;
        s.autoSync = document.getElementById("s-autosync").checked;
        DB.setSettings(s);
        Utils.toast("Firebase config saved.", "success");
        Sync.paintStatus();
      }catch(e){ Utils.toast("That doesn't look like valid JSON.", "error"); }
    };
    document.getElementById("btn-sync-now").onclick = () => Sync.pushSnapshot();
    document.getElementById("btn-pull-now").onclick = () => Sync.pullSnapshot();
    document.getElementById("btn-wipe").onclick = () => Modal.confirm({
      title:"Reset ALL data?", message:"Every product, sale, and setting will be permanently erased, leaving a blank slate. This can't be undone.", danger:true,
      onConfirm: () => { DB.wipeAll(); Utils.toast("All data reset.", "success"); App.boot(); }
    });
  }

  function renderTabBody(){
    const wrap = document.getElementById("view-tab-body");
    const s = DB.getSettings();
    if(tab === "business"){
      wrap.innerHTML = `
        <div class="card">
          <div class="field"><label>Business name</label><input class="input" id="s-name" value="${Utils.escapeHtml(s.businessName)}"></div>
          <div class="field"><label>Address</label><input class="input" id="s-address" value="${Utils.escapeHtml(s.address)}"></div>
          <div class="input-row">
            <div class="field"><label>TIN (optional)</label><input class="input" id="s-tin" value="${Utils.escapeHtml(s.tin)}"></div>
            <div class="field"><label>Currency symbol</label><input class="input" id="s-currency" value="${Utils.escapeHtml(s.currencySymbol)}"></div>
          </div>
          <div class="field"><label>Receipt footer message</label><input class="input" id="s-footer" value="${Utils.escapeHtml(s.receiptFooter)}"></div>
          <button class="btn btn-primary" id="btn-save-business">Save Business Info</button>
        </div>
        <div class="card" style="margin-top:14px;">
          <div class="switch-row" style="margin-bottom:12px;">
            <div><strong>VAT</strong><p class="text-sm text-faint">Turn Philippine VAT on or off for all sales.</p></div>
            <label class="switch"><input type="checkbox" id="s-vat" ${s.vatEnabled?"checked":""}><span class="track"></span></label>
          </div>
          <div class="switch-row" id="s-vat-rate-row" style="display:${s.vatEnabled?"flex":"none"};">
            <span class="text-sm">VAT rate (%)</span>
            <input class="input" id="s-vat-rate" type="number" step="0.1" value="${s.vatRate}" style="max-width:100px;">
          </div>
          <div class="switch-row" style="margin-top:12px;">
            <div><strong>Dark mode</strong><p class="text-sm text-faint">Easier on the eyes for night shifts.</p></div>
            <label class="switch"><input type="checkbox" id="s-theme" ${s.theme==="dark"?"checked":""}><span class="track"></span></label>
          </div>
        </div>`;
      document.getElementById("btn-save-business").onclick = saveBusinessInfo;
      document.getElementById("s-vat").onchange = (e)=>toggleVat(e.target.checked);
      document.getElementById("s-vat-rate")?.addEventListener("change", saveVatRate);
      document.getElementById("s-theme").onchange = (e)=>toggleTheme(e.target.checked);
    }
    else if(tab === "staff"){
      wrap.innerHTML = `<div class="card"><h3 style="margin-bottom:12px;">${Icons.get("users",{size:16})} Staff Accounts</h3><div id="staff-table"></div></div>`;
      renderStaffTable();
    }
    else if(tab === "fuel"){
      wrap.innerHTML = `<div class="card"><h3 style="margin-bottom:12px;">${Icons.get("fuel",{size:16})} Pump Configuration</h3><div id="pump-config-table"></div></div>`;
      renderPumpConfig();
    }
    else if(tab === "data"){
      renderDataTab();
    }
  }

  function render(){
    if(!Auth.isAdmin()){
      const view = document.getElementById("view-root");
      view.innerHTML = `<div class="empty">${Icons.get("lock",{size:34})}<h3>Admin access required</h3><p>Log in as Admin to change settings.</p></div>`;
      return;
    }
    const view = document.getElementById("view-root");
    view.innerHTML = `
      <div class="view-head"><div><h2>${Icons.get("settings",{size:22})} Settings</h2><div class="view-sub">Admin only</div></div></div>
      <div class="category-chips">
        ${[["business","store","Business"],["staff","users","Staff"],["fuel","fuel","Fuel Pumps"],["data","cloud","Data & Sync"]].map(([k,ic,l])=>`<div class="chip ${tab===k?"active":""}" data-tab="${k}">${Icons.get(ic,{size:13})}${l}</div>`).join("")}
      </div>
      <div id="view-tab-body" style="margin-top:14px;"></div>`;
    document.querySelectorAll("[data-tab]").forEach(c => c.onclick = () => { tab = c.dataset.tab; render(); });
    renderTabBody();
  }

  return { render };
})();
