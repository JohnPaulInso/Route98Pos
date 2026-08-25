// ============================================================
// sync.js — Multi-Collection Firestore Sync & 11:59 PM Backups
// ============================================================
// (2026-07-13) Multi-collection Firestore sync & 11:59 PM backups. Prev: 1 doc
const Sync = (() => {
  let app = null, db = null, firestoreMod = null;
  let debounceTimer = null;
  let backupTimer = null;

  function pill(){ return document.getElementById("sync-pill"); }

  function paintStatus(){
    const meta = DB.getSyncMeta();
    const el = pill();
    if(!el) return;
    const settings = DB.getSettings();
    const configured = !!settings.firebaseConfig;
    el.classList.remove("online","offline","error");
    if(!configured){
      el.classList.add("offline");
      el.querySelector(".lbl").textContent = "Local only";
    } else if(meta.status === "syncing"){
      el.classList.add("online");
      el.querySelector(".lbl").textContent = "Syncing…";
    } else if(meta.status === "error"){
      el.classList.add("error");
      el.querySelector(".lbl").textContent = "Sync error";
    } else if(meta.lastSynced){
      el.classList.add("online");
      const mins = Math.round((Date.now()-meta.lastSynced)/60000);
      el.querySelector(".lbl").textContent = mins < 1 ? "Synced just now" : `Synced ${mins}m ago`;
    } else {
      el.classList.add("offline");
      el.querySelector(".lbl").textContent = "Connected";
    }
  }

  // (2026-07-13) Auto anonymous auth with Firebase Auth for direct DB access. Prev: none
  async function ensureFirebase(){
    const settings = DB.getSettings();
    if(!settings.firebaseConfig) throw new Error("No Firebase config saved in Settings.");
    if(db) return { db, mod: firestoreMod };
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
    firestoreMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    app = initializeApp(settings.firebaseConfig);
    db = firestoreMod.getFirestore(app);
    try {
      const { getAuth, signInAnonymously } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
      const auth = getAuth(app);
      if(!auth.currentUser){
        await signInAnonymously(auth);
      }
    } catch(e) {
      console.warn("Anonymous auth info:", e);
    }
    return { db, mod: firestoreMod };
  }

  // Push all organized collections to Firestore
  async function pushSnapshot(){
    const meta = DB.getSyncMeta();
    try{
      DB.setSyncMeta({ ...meta, status:"syncing" }); paintStatus();
      const { db: database, mod } = await ensureFirebase();
      const snap = DB.snapshot();

      // 1. Sync Products
      for(const p of snap.products || []){
        const docId = String(p.id || p.barcode || Utils.uid("p"));
        await mod.setDoc(mod.doc(database, "products", docId), p, { merge:true });
      }

      // 2. Sync Categories
      await mod.setDoc(mod.doc(database, "categories", "categories_list"), { list: snap.categories || [] }, { merge:true });

      // (2026-07-13) Forward all localstorage collections to Firestore. Prev: sliced 300
      // 3. Sync Sales / Transactions
      for(const s of (snap.sales || [])){
        const docId = String(s.id || s.receiptNo || Utils.uid("sale"));
        await mod.setDoc(mod.doc(database, "sales", docId), s, { merge:true });
      }

      // 4. Sync Fuel Sales
      for(const fs of (snap.fuelSales || [])){
        const docId = String(fs.id || Utils.uid("fuel"));
        await mod.setDoc(mod.doc(database, "fuelSales", docId), fs, { merge:true });
      }

      // 5. Sync Fuel Deliveries & Fuel Config
      for(const fd of (snap.fuelDeliveries || [])){
        const docId = String(fd.id || Utils.uid("deliv"));
        await mod.setDoc(mod.doc(database, "fuelDeliveries", docId), fd, { merge:true });
      }
      if(snap.fuelConfig){
        await mod.setDoc(mod.doc(database, "fuelConfig", "config"), snap.fuelConfig, { merge:true });
      }

      // 6. Sync Expenses (OPEX)
      for(const e of (snap.expenses || [])){
        const docId = String(e.id || Utils.uid("exp"));
        await mod.setDoc(mod.doc(database, "expenses", docId), e, { merge:true });
      }

      // 7. Sync Venue Leads & Bookings
      for(const vl of (snap.venueLeads || [])){
        const docId = String(vl.id || Utils.uid("lead"));
        await mod.setDoc(mod.doc(database, "venueLeads", docId), vl, { merge:true });
      }
      for(const b of (snap.bookings || [])){
        const docId = String(b.id || Utils.uid("bk"));
        await mod.setDoc(mod.doc(database, "bookings", docId), b, { merge:true });
      }

      // 8. Sync Restaurant Bookings
      for(const rb of (snap.restaurantBookings || [])){
        const docId = String(rb.id || Utils.uid("rest"));
        await mod.setDoc(mod.doc(database, "restaurantBookings", docId), rb, { merge:true });
      }

      // 9. Sync Stock & Restock Logs
      if(snap.stockLog){
        await mod.setDoc(mod.doc(database, "stockLog", "latest_logs"), { logs: (snap.stockLog||[]).slice(0, 100) }, { merge:true });
      }
      if(snap.restockLogs){
        await mod.setDoc(mod.doc(database, "restockLogs", "latest_restocks"), { logs: (snap.restockLogs||[]).slice(0, 100) }, { merge:true });
      }

      // 10. Sync Settings & Users
      if(snap.settings){
        const cleanSettings = { ...snap.settings };
        delete cleanSettings.firebaseConfig; // Keep credentials local
        await mod.setDoc(mod.doc(database, "settings", "store_settings"), cleanSettings, { merge:true });
      }
      for(const u of snap.users || []){
        const docId = String(u.id || Utils.uid("usr"));
        await mod.setDoc(mod.doc(database, "users", docId), u, { merge:true });
      }

      // Master snapshot document for fast complete recovery
      await mod.setDoc(mod.doc(database, "minimart_snapshots", "store"), snap, { merge:false });

      DB.setSyncMeta({ lastSynced: Date.now(), status:"idle" });
      Utils.toast("Grouped collections synced to Firestore ☁️", "success");
    }catch(err){
      console.error("Firestore sync failed", err);
      DB.setSyncMeta({ ...DB.getSyncMeta(), status:"error" });
      Utils.toast("Sync failed — check Firebase connection / rules", "error");
    }
    paintStatus();
  }

  // Pull all organized collections from Firestore
  async function pullSnapshot(){
    try{
      DB.setSyncMeta({ ...DB.getSyncMeta(), status:"syncing" }); paintStatus();
      const { db: database, mod } = await ensureFirebase();

      // Check master snapshot first
      const snapDoc = await mod.getDoc(mod.doc(database, "minimart_snapshots", "store"));
      if(snapDoc.exists()){
        DB.restoreSnapshot(snapDoc.data());
        Utils.toast("Pulled latest data from Firestore ☁️", "success");
        DB.setSyncMeta({ lastSynced: Date.now(), status:"idle" });
      } else {
        // Fallback: Read individual collections
        const productsSnap = await mod.getDocs(mod.collection(database, "products"));
        if(!productsSnap.empty){
          const prods = [];
          productsSnap.forEach(d => prods.push(d.data()));
          if(prods.length) DB.setProducts(prods);
        }
        const salesSnap = await mod.getDocs(mod.collection(database, "sales"));
        if(!salesSnap.empty){
          const sales = [];
          salesSnap.forEach(d => sales.push(d.data()));
          if(sales.length) DB.setSales(sales);
        }
        Utils.toast("Collections pulled from Firestore ☁️", "success");
        DB.setSyncMeta({ lastSynced: Date.now(), status:"idle" });
      }
    }catch(err){
      console.error("Firestore pull failed", err);
      DB.setSyncMeta({ ...DB.getSyncMeta(), status:"error" });
      Utils.toast("Pull failed — check Firebase config / connection", "error");
    }
    paintStatus();
    App.rerenderCurrentView?.();
  }

  // Automated 11:59 PM Daily Backup Exporter
  async function createDailyBackup(type = "automatic_1159"){
    const snap = DB.snapshot();
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-PH", { year:"numeric", month:"short", day:"numeric" }) + " " +
                    now.toLocaleTimeString("en-PH", { hour:"2-digit", minute:"2-digit" });
    const backupId = "backup_" + now.getFullYear() + "-" +
                     String(now.getMonth()+1).padStart(2,"0") + "-" +
                     String(now.getDate()).padStart(2,"0") + "_" +
                     String(now.getHours()).padStart(2,"0") + String(now.getMinutes()).padStart(2,"0") + String(now.getSeconds()).padStart(2,"0");

    const record = {
      id: backupId,
      createdAt: Date.now(),
      dateStr,
      exportType: type,
      summary: {
        products: (snap.products || []).length,
        sales: (snap.sales || []).length,
        fuelSales: (snap.fuelSales || []).length,
        expenses: (snap.expenses || []).length,
        venueLeads: (snap.venueLeads || []).length,
        restaurantBookings: (snap.restaurantBookings || []).length
      },
      data: snap
    };

    // Save locally
    DB.saveBackup(record);

    // Upload to Firestore if configured
    try{
      const settings = DB.getSettings();
      if(settings.firebaseConfig){
        const { db: database, mod } = await ensureFirebase();
        await mod.setDoc(mod.doc(database, "backups", backupId), record, { merge:true });
      }
    }catch(e){
      console.warn("Could not push daily backup to Firestore", e);
    }

    return record;
  }

  function getNext1159Target(){
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0);
    if(now.getTime() >= target.getTime()){
      target.setDate(target.getDate() + 1);
    }
    return target;
  }

  function schedule1159Timer(){
    if(backupTimer) clearTimeout(backupTimer);
    const target = getNext1159Target();
    const msUntilTarget = target.getTime() - Date.now();
    backupTimer = setTimeout(async () => {
      await createDailyBackup("automatic_1159");
      schedule1159Timer();
    }, Math.max(1000, msUntilTarget));
  }

  function scheduleAutoSync(){
    const settings = DB.getSettings();
    if(!settings.autoSync || !settings.firebaseConfig) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => pushSnapshot(), 4000);
  }

  function init(){
    document.addEventListener("mm:dirty", (e) => {
      if(e.detail?.key === DB.KEYS.syncMeta || e.detail?.key === DB.KEYS.backups) return;
      scheduleAutoSync();
    });
    window.addEventListener("online", paintStatus);
    window.addEventListener("offline", paintStatus);
    paintStatus();
    schedule1159Timer();
  }

  return {
    init, pushSnapshot, pullSnapshot, paintStatus,
    createDailyBackup, getNext1159Target, ensureFirebase
  };
})();
