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

  // (2026-07-13) 11:59 PM daily backups & file export UI; was Firestore multi-doc card
  function renderDataTab(){
    const wrap = document.getElementById("view-tab-body");
    const backups = DB.getBackups();
    const target1159 = Sync.getNext1159Target();
    const targetStr = target1159.toLocaleDateString("en-PH", { month:"short", day:"numeric" }) + " at 11:59 PM";

    wrap.innerHTML = `
      <div class="card" style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
          <div>
            <h3 style="margin:0 0 2px;">${Icons.get("database",{size:16})} Daily Automated Backups (11:59 PM)</h3>
            <p class="text-sm text-faint" style="margin:0;">Automated backup triggers daily at 11:59 PM. Next scheduled: <strong>${targetStr}</strong></p>
          </div>
          <button class="btn btn-sm btn-primary" id="btn-create-backup-now">${Icons.get("plus",{size:13})} Run Backup Now</button>
        </div>
        ${backups.length ? `
          <div class="table-wrap" style="max-height:260px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm);">
            <table class="data">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Type</th>
                  <th>Summary</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${backups.slice(0, 15).map(b => `
                  <tr>
                    <td><strong>${Utils.escapeHtml(b.dateStr || new Date(b.createdAt).toLocaleString())}</strong></td>
                    <td><span class="badge ${b.exportType==="automatic_1159"?"badge-info":"badge-amber"}">${b.exportType==="automatic_1159"?"11:59 PM Auto":"Manual"}</span></td>
                    <td class="text-xs text-faint">${b.summary ? `${b.summary.products||0} Prods · ${b.summary.sales||0} Sales · ${b.summary.expenses||0} OPEX` : "Full Snapshot"}</td>
                    <td style="text-align:right;white-space:nowrap;">
                      <button class="btn btn-xs btn-ghost" data-view-backup="${b.id}">${Icons.get("eye",{size:12})} View</button>
                      <button class="btn btn-xs btn-ghost" data-download-backup="${b.id}">${Icons.get("download",{size:12})} Download</button>
                      <button class="btn btn-xs btn-outline" data-restore-backup="${b.id}">${Icons.get("upload",{size:12})} Restore</button>
                    </td>
                  </tr>`).join("")}
              </tbody>
            </table>
          </div>` : `
          <div style="padding:18px;text-align:center;background:var(--card-sub);border-radius:var(--radius-sm);color:var(--text-faint);">
            <p style="margin:0;font-size:.85rem;">No backups recorded yet. Automatic backup will trigger tonight at 11:59 PM, or click "Run Backup Now".</p>
          </div>`}
      </div>

      <div class="grid-2">
        <div class="card">
          <h3 style="margin-bottom:10px;">${Icons.get("download",{size:16})} Manual File Export</h3>
          <p class="text-sm text-faint" style="margin-bottom:12px;">Download standalone JSON backup file or CSV spreadsheets.</p>
          <button class="btn btn-block" id="btn-export-json" style="margin-bottom:8px;">Full Backup (.json)</button>
          <div class="grid-2" style="gap:8px;">
            <button class="btn btn-block" id="btn-export-csv">Inventory (.csv)</button>
            <button class="btn btn-block" id="btn-export-cats">Categories (.csv)</button>
          </div>
        </div>
        <div class="card">
          <h3 style="margin-bottom:10px;">${Icons.get("upload",{size:16})} File Import</h3>
          <p class="text-sm text-faint" style="margin-bottom:12px;">Restore a downloaded full backup file or import product catalog.</p>
          <button class="btn btn-block" id="btn-import-json" style="margin-bottom:8px;">Restore Full Backup File</button>
          <button class="btn btn-block" id="btn-import-csv">Import Products (CSV/JSON)</button>
          <input type="file" id="file-json" accept=".json" class="hidden">
          <input type="file" id="file-csv" accept=".csv,.json" class="hidden">
        </div>
      </div>

      <div class="card" style="margin-top:14px;border-color:var(--danger);">
        <h3 style="margin-bottom:10px;color:var(--danger-deep);">${Icons.get("alert-triangle",{size:16})} Danger Zone</h3>
        <p class="text-sm text-faint" style="margin-bottom:12px;">These actions cannot be undone. Download or create a backup before resetting.</p>
        <button class="btn btn-danger" id="btn-wipe">Reset All Data</button>
      </div>`;

    document.getElementById("btn-export-json").onclick = ImportExport.exportFullBackup;
    document.getElementById("btn-export-csv").onclick = ImportExport.exportInventoryCSV;
    document.getElementById("btn-export-cats").onclick = ImportExport.exportCategoriesCSV;
    document.getElementById("btn-import-json").onclick = () => document.getElementById("file-json").click();
    document.getElementById("btn-import-csv").onclick = () => document.getElementById("file-csv").click();
    document.getElementById("file-json").addEventListener("change", e => ImportExport.importFullBackupFile(e.target.files[0], () => App.rerenderCurrentView()));
    document.getElementById("file-csv").addEventListener("change", e => ImportExport.importInventoryFile(e.target.files[0], () => Utils.toast("Products imported.","success")));

    // (2026-07-13) Animated multi-step progress modal for backup export; was immediate
    document.getElementById("btn-create-backup-now").onclick = async () => {
      const modal = Modal.open({
        title: `${Icons.get("database",{size:17})} Creating System Backup`,
        body: `
          <div style="padding:16px 8px;text-align:center;">
            <div style="margin-bottom:12px;font-size:1.1rem;font-weight:700;" id="backup-status-text">Exporting Collections...</div>
            <div style="background:var(--paper-dim);border-radius:999px;height:12px;overflow:hidden;border:1px solid var(--line);margin-bottom:14px;">
              <div id="backup-prog-bar" style="background:var(--brand);height:100%;width:20%;transition:width .4s ease;"></div>
            </div>
            <div class="text-xs text-faint mono" id="backup-sub-text">Capturing products, sales, fuel records, and logs…</div>
          </div>`,
        actions: []
      });

      const bar = modal.querySelector("#backup-prog-bar");
      const statusEl = modal.querySelector("#backup-status-text");
      const subEl = modal.querySelector("#backup-sub-text");

      await new Promise(r => setTimeout(r, 450));
      if(bar) bar.style.width = "55%";
      if(statusEl) statusEl.textContent = "Compiling JSON/CSV...";
      if(subEl) subEl.textContent = "Formatting schemas and calculating collection checksums…";

      await new Promise(r => setTimeout(r, 500));
      if(bar) bar.style.width = "85%";
      if(statusEl) statusEl.textContent = "Finalizing Archive...";
      if(subEl) subEl.textContent = "Writing snapshot to persistent local and cloud storage…";

      const rec = await Sync.createDailyBackup("manual");
      await new Promise(r => setTimeout(r, 400));
      if(bar){ bar.style.width = "100%"; bar.style.background = "var(--success)"; }
      if(statusEl){ statusEl.textContent = "Backup Complete!"; statusEl.style.color = "var(--success-deep)"; }
      if(subEl) subEl.textContent = `Saved ${rec.id} successfully.`;

      setTimeout(() => {
        Modal.close();
        Utils.toast(`Backup ${rec.id} created successfully.`, "success");
        renderDataTab();
      }, 700);
    };

    // (2026-07-13) View detailed daily backup contents in modal. Prev: download only
    wrap.querySelectorAll("[data-view-backup]").forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.viewBackup;
        const item = DB.getBackups().find(x => x.id === id);
        if(!item) return;
        const snap = item.data || item;
        const body = `
          <div class="grid-2" style="gap:10px;margin-bottom:14px;">
            <div class="card" style="padding:10px 14px;background:var(--paper-dim);">
              <div class="text-xs text-faint">Backup Timestamp</div>
              <strong>${Utils.escapeHtml(item.dateStr || new Date(item.createdAt).toLocaleString())}</strong>
            </div>
            <div class="card" style="padding:10px 14px;background:var(--paper-dim);">
              <div class="text-xs text-faint">Export Mode</div>
              <strong>${item.exportType==="automatic_1159"?"Daily 11:59 PM Auto":"Manual Export"}</strong>
            </div>
          </div>
          <div class="table-wrap" style="max-height:300px;overflow-y:auto;">
            <table class="data">
              <thead><tr><th>Section</th><th>Record Count</th><th>Status</th></tr></thead>
              <tbody>
                <tr><td><strong>Products & Catalog</strong></td><td>${(snap.products||[]).length} items</td><td><span class="badge badge-success">Saved</span></td></tr>
                <tr><td><strong>Minimart Transactions</strong></td><td>${(snap.sales||[]).length} sales</td><td><span class="badge badge-success">Saved</span></td></tr>
                <tr><td><strong>Gasoline Fuel Sales</strong></td><td>${(snap.fuelSales||[]).length} pump transactions</td><td><span class="badge badge-success">Saved</span></td></tr>
                <tr><td><strong>Fuel Bulk Deliveries</strong></td><td>${(snap.fuelDeliveries||[]).length} deliveries</td><td><span class="badge badge-success">Saved</span></td></tr>
                <tr><td><strong>Expenses (OPEX)</strong></td><td>${(snap.expenses||[]).length} entries</td><td><span class="badge badge-success">Saved</span></td></tr>
                <tr><td><strong>Event Venue Leads & Bookings</strong></td><td>${(snap.venueLeads||[]).length + (snap.bookings||[]).length} bookings</td><td><span class="badge badge-success">Saved</span></td></tr>
                <tr><td><strong>Restaurant Bookings</strong></td><td>${(snap.restaurantBookings||[]).length} reservations</td><td><span class="badge badge-success">Saved</span></td></tr>
                <tr><td><strong>Stock Movement Audit Logs</strong></td><td>${(snap.stockLog||[]).length} logs</td><td><span class="badge badge-success">Saved</span></td></tr>
                <tr><td><strong>Settings & Staff Roles</strong></td><td>${(snap.users||[]).length} accounts</td><td><span class="badge badge-success">Saved</span></td></tr>
              </tbody>
            </table>
          </div>`;

        Modal.open({
          title: `${Icons.get("database",{size:17})} Backup Details (${item.id})`,
          body,
          actions: [
            { label: "Close", cls: "btn-ghost" },
            { label: "Download JSON", cls: "btn-primary", onClick: () => {
              const blob = new Blob([JSON.stringify(snap, null, 2)], { type:"application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `route98_${id}.json`;
              a.click();
            }}
          ]
        });
      };
    });

    wrap.querySelectorAll("[data-download-backup]").forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.downloadBackup;
        const item = DB.getBackups().find(x => x.id === id);
        if(!item) return;
        const blob = new Blob([JSON.stringify(item.data || item, null, 2)], { type:"application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `route98_${id}.json`;
        a.click();
      };
    });

    wrap.querySelectorAll("[data-restore-backup]").forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.restoreBackup;
        const item = DB.getBackups().find(x => x.id === id);
        if(!item) return;
        Modal.confirm({
          title: "Restore Backup?",
          message: `Restore data snapshot from ${item.dateStr}? Current live data will be replaced with this backup.`,
          danger: true,
          onConfirm: () => {
            DB.restoreSnapshot(item.data || item);
            Utils.toast("Backup restored successfully.", "success");
            App.boot();
          }
        });
      };
    });

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

  // (2026-07-13) Make settings view scrollable with bottom padding; was overflow hidden
  function render(){
    if(!Auth.isAdmin()){
      const view = document.getElementById("view-root");
      view.innerHTML = `<div class="empty">${Icons.get("lock",{size:34})}<h3>Admin access required</h3><p>Log in as Admin to change settings.</p></div>`;
      return;
    }
    const view = document.getElementById("view-root");
    view.innerHTML = `
      <div class="view-body" style="overflow-y:auto;flex:1;min-height:0;padding-bottom:5rem;-webkit-overflow-scrolling:touch;">
        <div class="view-head"><div><h2>${Icons.get("settings",{size:22})} Settings</h2><div class="view-sub">Admin configuration & system backups</div></div></div>
        <div class="category-chips">
          ${[["business","store","Business"],["staff","users","Staff"],["fuel","fuel","Fuel Pumps"],["data","database","Data & Backups"]].map(([k,ic,l])=>`<div class="chip ${tab===k?"active":""}" data-tab="${k}">${Icons.get(ic,{size:13})}${l}</div>`).join("")}
        </div>
        <div id="view-tab-body" style="margin-top:14px;"></div>
      </div>`;
    document.querySelectorAll("[data-tab]").forEach(c => c.onclick = () => { tab = c.dataset.tab; render(); });
    renderTabBody();
  }

  return { render };
})();
