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
    } else if(meta.status === "quota"){
      el.classList.add("offline");
      el.querySelector(".lbl").textContent = "Quota reached (Local)";
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

  // (2026-07-13) Guard empty local push and auto-pull cloud state. Prev: empty wipe
  async function pushSnapshot(force = false){
    const meta = DB.getSyncMeta();
    if(meta.status === "quota") return; // Prevent spamming when quota exceeded
    const snap = DB.snapshot();
    const localProducts = snap.products || [];
    const localSales = snap.sales || [];
    if(!force && localProducts.length === 0 && localSales.length === 0){
      return;
    }
    try{
      DB.setSyncMeta({ ...meta, status:"syncing" }); paintStatus();
      const { db: database, mod } = await ensureFirebase();

      // Master snapshot document write (1 atomic document write)
      await mod.setDoc(mod.doc(database, "minimart_snapshots", "store"), snap, { merge:false });

      DB.setSyncMeta({ lastSynced: Date.now(), status:"idle" });
    }catch(err){
      console.error("Firestore sync failed", err);
      const isQuota = err?.code === "resource-exhausted" || String(err?.message||"").includes("resource-exhausted") || String(err?.message||"").includes("Quota exceeded");
      if(isQuota){
        DB.setSyncMeta({ ...DB.getSyncMeta(), status:"quota" });
      } else {
        DB.setSyncMeta({ ...DB.getSyncMeta(), status:"error" });
      }
    }
    paintStatus();
  }

  // (2026-07-13) Auto-pull Firestore cloud snapshot into empty local client. Prev: skipped
  async function pullSnapshot(force = false){
    try{
      DB.setSyncMeta({ ...DB.getSyncMeta(), status:"syncing" }); paintStatus();
      const { db: database, mod } = await ensureFirebase();

      // Check master snapshot first
      const snapDoc = await mod.getDoc(mod.doc(database, "minimart_snapshots", "store"));
      if(snapDoc.exists()){
        const remoteData = snapDoc.data();
        const localMeta = DB.getSyncMeta();
        const remoteTimestamp = remoteData.exportedAt || 0;
        const localTimestamp = localMeta.lastSynced || 0;
        const localProducts = DB.getProducts();
        const localSales = DB.getSales();
        const isLocalEmpty = localProducts.length === 0 && localSales.length === 0;
        
        // Restore if forced, local is empty, or remote is newer
        if(force || isLocalEmpty || remoteTimestamp > localTimestamp){
          DB.restoreSnapshot(remoteData);
          DB.setSyncMeta({ lastSynced: Date.now(), status:"idle" });
        } else {
          DB.setSyncMeta({ ...localMeta, status:"idle" });
        }
      } else {
        // Fallback: Read individual collections (only on first-time setup)
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
        DB.setSyncMeta({ lastSynced: Date.now(), status:"idle" });
      }
    }catch(err){
      console.error("Firestore pull failed", err);
      DB.setSyncMeta({ ...DB.getSyncMeta(), status:"error" });
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

  // (2026-07-13) Sync realtime snapshot immediately to new clients. Prev: skipped 1st
  let unsubSnapshot = null;
  async function startRealtimeListener(){
    try{
      const settings = DB.getSettings();
      if(!settings.firebaseConfig || !settings.autoSync) return;
      const { db: database, mod } = await ensureFirebase();
      if(unsubSnapshot) unsubSnapshot();

      unsubSnapshot = mod.onSnapshot(mod.doc(database, "minimart_snapshots", "store"), (docSnap) => {
        if(docSnap.exists()){
          const remoteData = docSnap.data();
          const localMeta = DB.getSyncMeta();
          const remoteTimestamp = remoteData.exportedAt || 0;
          const localTimestamp = localMeta.lastSynced || 0;
          const localProducts = DB.getProducts();
          const isLocalEmpty = localProducts.length === 0 && DB.getSales().length === 0;

          // Only update if local is empty or remote is genuinely newer
          if(isLocalEmpty || remoteTimestamp > localTimestamp + 2000){
            const remoteProds = remoteData.products || [];
            if(isLocalEmpty || remoteProds.length !== localProducts.length || JSON.stringify(localProducts) !== JSON.stringify(remoteProds)){
              DB.restoreSnapshot(remoteData);
              DB.setSyncMeta({ lastSynced: Date.now(), status:"idle" });
              paintStatus();
              App.rerenderCurrentView?.();
            }
          }
        }
      }, (err) => {
        console.warn("Firestore onSnapshot error:", err);
      });
    }catch(err){
      console.warn("Could not start Firestore onSnapshot:", err);
    }
  }

  // (2026-07-13) Auto-drain offline queue when reconnecting; was disconnected
  async function syncOfflineQueue(){
    const queue = DB.getOfflineQueue ? DB.getOfflineQueue() : [];
    if(!queue || !queue.length) return;
    try {
      const { db: database, mod } = await ensureFirebase();
      for(const txn of queue){
        const docId = String(txn.id || Utils.uid("sale"));
        await mod.setDoc(mod.doc(database, "sales", docId), txn, { merge:true });
      }
      DB.setOfflineQueue([]);
    } catch(e) {
      console.warn("Could not sync offline queue:", e);
    }
  }

  function init(){
    document.addEventListener("mm:dirty", (e) => {
      if(e.detail?.key === DB.KEYS.syncMeta || e.detail?.key === DB.KEYS.backups) return;
      scheduleAutoSync();
    });
    window.addEventListener("online", () => {
      paintStatus();
      syncOfflineQueue();
      const localProducts = DB.getProducts();
      if(localProducts.length > 0 || DB.getSales().length > 0){
        pushSnapshot();
      } else {
        pullSnapshot();
      }
    });
    window.addEventListener("offline", paintStatus);
    paintStatus();
    schedule1159Timer();
    startRealtimeListener();

    // Auto-pull on launch if local DB is empty to populate from cloud
    const localProducts = DB.getProducts();
    const localSales = DB.getSales();
    if(localProducts.length === 0 && localSales.length === 0){
      setTimeout(() => pullSnapshot(), 600);
    } else {
      console.log("Local data exists, skipping auto-pull. Use manual sync to refresh.");
    }
  }

  return {
    init, pushSnapshot, pullSnapshot, paintStatus, syncOfflineQueue,
    createDailyBackup, getNext1159Target, ensureFirebase, startRealtimeListener
  };
})();
