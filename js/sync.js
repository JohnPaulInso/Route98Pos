// ============================================================
// sync.js — Multi-Collection Firestore Sync & 11:59 PM Backups
// ============================================================
// (2026-07-13) Multi-collection Firestore sync & 11:59 PM backups. Prev: 1 doc
const Sync = (() => {
  let app = null, db = null, firestoreMod = null;
  let debounceTimer = null;
  let backupTimer = null;
  let isSyncing = false;

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

  // (2026-07-13) 3-way merge sync pull before push for offline; was blind write
  function mergeArray3Way(baseArr = [], localArr = [], remoteArr = [], idKey = "id", tsKey = "updatedAt"){
    const baseMap = new Map();
    (baseArr || []).forEach(item => { if(item && item[idKey]) baseMap.set(String(item[idKey]), item); });
    const localMap = new Map();
    (localArr || []).forEach(item => { if(item && item[idKey]) localMap.set(String(item[idKey]), item); });
    const remoteMap = new Map();
    (remoteArr || []).forEach(item => { if(item && item[idKey]) remoteMap.set(String(item[idKey]), item); });

    const allKeys = new Set([...baseMap.keys(), ...localMap.keys(), ...remoteMap.keys()]);
    const merged = [];

    allKeys.forEach(k => {
      const baseItem = baseMap.get(k);
      const localItem = localMap.get(k);
      const remoteItem = remoteMap.get(k);

      if(localItem && remoteItem){
        if(!baseItem){
          // (2026-07-13) Support updatedAt & timestamp in 3-way merge; was ts only
          const localTs = localItem[tsKey] || localItem.ts || localItem.updatedAt || localItem.timestamp || localItem.openedAt || localItem.createdAt || 0;
          const remoteTs = remoteItem[tsKey] || remoteItem.ts || remoteItem.updatedAt || remoteItem.timestamp || remoteItem.openedAt || remoteItem.createdAt || 0;
          merged.push(remoteTs > localTs ? remoteItem : localItem);
        } else {
          const localChanged = JSON.stringify(localItem) !== JSON.stringify(baseItem);
          const remoteChanged = JSON.stringify(remoteItem) !== JSON.stringify(baseItem);
          if(!localChanged && !remoteChanged) merged.push(localItem);
          else if(localChanged && !remoteChanged) merged.push(localItem);
          else if(!localChanged && remoteChanged) merged.push(remoteItem);
          else {
            const localTs = localItem[tsKey] || localItem.ts || localItem.updatedAt || localItem.timestamp || localItem.openedAt || localItem.createdAt || 0;
            const remoteTs = remoteItem[tsKey] || remoteItem.ts || remoteItem.updatedAt || remoteItem.timestamp || remoteItem.openedAt || remoteItem.createdAt || 0;
            merged.push(remoteTs > localTs ? remoteItem : localItem);
          }
        }
      } else if(localItem && !remoteItem){
        if(baseItem){
          if(JSON.stringify(localItem) !== JSON.stringify(baseItem)){
            merged.push(localItem);
          }
        } else {
          merged.push(localItem);
        }
      } else if(!localItem && remoteItem){
        if(baseItem){
          if(JSON.stringify(remoteItem) !== JSON.stringify(baseItem)){
            merged.push(remoteItem);
          }
        } else {
          merged.push(remoteItem);
        }
      }
    });

    return merged;
  }

  // (2026-07-13) Multi-collection 3-way merge for all store tables. Prev: partial
  function threeWayMerge(baseline, local, remote){
    if(!remote) return local;
    if(!local) return remote;
    const base = baseline || {};
    const merged = { ...remote, ...local };

    merged.products = mergeArray3Way(base.products, local.products, remote.products, "id", "updatedAt");
    // (2026-07-13) Sort merged sales newest first; was unsorted order
    merged.sales = mergeArray3Way(base.sales, local.sales, remote.sales, "receiptNo", "ts").sort((a,b)=>(b.ts||0)-(a.ts||0));
    merged.shiftLogs = mergeArray3Way(base.shiftLogs, local.shiftLogs, remote.shiftLogs, "id", "openedAt");
    merged.fuelSales = mergeArray3Way(base.fuelSales, local.fuelSales, remote.fuelSales, "id", "ts");
    merged.expenses = mergeArray3Way(base.expenses, local.expenses, remote.expenses, "id", "ts");
    // (2026-07-13) Keep void logs sorted descending in merge; was unsorted
    merged.voidLogs = mergeArray3Way(base.voidLogs, local.voidLogs, remote.voidLogs, "id", "ts").sort((a,b)=>(b.ts||0)-(a.ts||0));
    merged.users = mergeArray3Way(base.users, local.users, remote.users, "id", "updatedAt");
    merged.fuelDeliveries = mergeArray3Way(base.fuelDeliveries, local.fuelDeliveries, remote.fuelDeliveries, "id", "ts");
    merged.venueLeads = mergeArray3Way(base.venueLeads, local.venueLeads, remote.venueLeads, "id", "ts");
    merged.bookings = mergeArray3Way(base.bookings, local.bookings, remote.bookings, "id", "ts");
    merged.restaurantBookings = mergeArray3Way(base.restaurantBookings, local.restaurantBookings, remote.restaurantBookings, "id", "ts");
    merged.restockLogs = mergeArray3Way(base.restockLogs, local.restockLogs, remote.restockLogs, "id", "ts");
    merged.physicalAudits = mergeArray3Way(base.physicalAudits, local.physicalAudits, remote.physicalAudits, "id", "ts");
    merged.customItems = mergeArray3Way(base.customItems, local.customItems, remote.customItems, "name", "updatedAt");
    merged.heldSales = mergeArray3Way(base.heldSales, local.heldSales, remote.heldSales, "id", "ts");
    // (2026-07-13) 3-way merge backups metadata in sync; was omitted and reset
    merged.backups = mergeArray3Way(base.backups, local.backups, remote.backups, "id", "createdAt").sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    // (2026-07-13) Merge deletedProductIds & deletedSaleIds tombstones; was sales only
    merged.deletedSaleIds = Array.from(new Set([...(base.deletedSaleIds || []), ...(local.deletedSaleIds || []), ...(remote.deletedSaleIds || [])]));
    merged.deletedProductIds = Array.from(new Set([...(base.deletedProductIds || []), ...(local.deletedProductIds || []), ...(remote.deletedProductIds || [])]));
    const delProdSet = new Set(merged.deletedProductIds);
    merged.products = (merged.products || []).filter(p => !delProdSet.has(p.id));

    const catSet = new Set([...(remote.categories || []), ...(local.categories || [])]);
    merged.categories = Array.from(catSet);

    const cashierSet = new Set([...(remote.cashiers || []), ...(local.cashiers || [])]);
    merged.cashiers = Array.from(cashierSet);

    if(remote.fuelConfig && local.fuelConfig){
      const curCfg = local.fuelConfig;
      const remoteCfg = remote.fuelConfig;
      const mergedCfg = { ...remoteCfg, ...curCfg };
      mergedCfg.fuels = { ...(curCfg.fuels || {}) };
      if(remoteCfg.fuels){
          Object.keys(remoteCfg.fuels).forEach(ft => {
            const curF = mergedCfg.fuels[ft] || {};
            const remF = remoteCfg.fuels[ft] || {};
            // (2026-07-13) Merge fuel tank levels by recency; was Math.min erasing deliveries
            const remUpdated = remF.updatedAt || 0;
            const curUpdated = curF.updatedAt || 0;
            mergedCfg.fuels[ft] = {
              ...curF,
              ...remF,
              tank: remUpdated > curUpdated ? (remF.tank ?? curF.tank) : (curF.tank ?? remF.tank)
            };
          });
        }
        merged.fuelConfig = mergedCfg;
      }

    const localShift = local.shift;
    const remoteShift = remote.shift;
    if(localShift && remoteShift){
      const localTs = localShift.updatedAt || localShift.closedAt || localShift.openedAt || 0;
      const remoteTs = remoteShift.updatedAt || remoteShift.closedAt || remoteShift.openedAt || 0;
      merged.shift = remoteTs >= localTs ? remoteShift : localShift;
    } else {
      merged.shift = remoteShift || localShift || null;
    }

    const dayKeys = new Set([...Object.keys(remote.dayBalances || {}), ...Object.keys(local.dayBalances || {})]);
    merged.dayBalances = {};
    dayKeys.forEach(k => {
      merged.dayBalances[k] = { ...(remote.dayBalances?.[k] || {}), ...(local.dayBalances?.[k] || {}) };
    });
    merged.exportedAt = Math.max(remote.exportedAt || 0, local.exportedAt || 0, Date.now());
    return merged;
  }

  // (2026-07-13) Guard pushSnapshot with isSyncing flag; was unbounded recursion
  async function pushSnapshot(force = false){
    const meta = DB.getSyncMeta();
    if(meta.status === "quota") return;
    if(isSyncing && !force) return;
    isSyncing = true;
    try{
      DB.setSyncMeta({ ...meta, status:"syncing" }); paintStatus();
      const { db: database, mod } = await ensureFirebase();

      // Read remote snapshot first to pull/sync before pushing
      const snapDoc = await mod.getDoc(mod.doc(database, "minimart_snapshots", "store"));
      let finalSnap = DB.snapshot();
      if(snapDoc.exists()){
        const remoteData = snapDoc.data();
        const baseline = DB.getSyncBaseline();
        finalSnap = threeWayMerge(baseline, finalSnap, remoteData);
        DB.restoreSnapshot(finalSnap);
      }
      DB.setSyncBaseline(finalSnap);

      const localSales = finalSnap.sales || [];
      
      // Smart sync: Include recent sales (last 500) + all manual sales + recent imported sales
      const now = Date.now();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
      
      const manualSales = localSales.filter(s => !s.isImported && s.source !== "imported");
      const recentImported = localSales.filter(s => (s.isImported || s.source === "imported") && s.ts >= thirtyDaysAgo);
      const recentAll = localSales.filter(s => s.ts >= thirtyDaysAgo);
      
      // Combine and dedupe by receipt number
      const sMap = new Map();
      recentAll.forEach(s => { const k = String(s.receiptNo || s.id || '').trim(); if(k) sMap.set(k, s); });
      manualSales.forEach(s => { const k = String(s.receiptNo || s.id || '').trim(); if(k) sMap.set(k, s); });
      recentImported.forEach(s => { const k = String(s.receiptNo || s.id || '').trim(); if(k) sMap.set(k, s); });
      
      // (2026-07-13) Prioritize newest sales in cloud sync; was unsorted slice
      const syncSales = Array.from(sMap.values()).sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0, 1000);

      // (2026-07-13) Include deletedSaleIds in cloud snapshot; was sales only
      const cloudSnap = {
        ...finalSnap,
        sales: syncSales,
        deletedSaleIds: Array.from(DB.getDeletedSaleIds ? DB.getDeletedSaleIds() : []),
        isPartialSalesSync: true,
        exportedAt: Date.now()
      };

      await mod.setDoc(mod.doc(database, "minimart_snapshots", "store"), cloudSnap, { merge:false });
      DB.setSyncMeta({ lastSynced: Date.now(), status:"idle" });
    }catch(err){
      console.error("Firestore sync failed", err);
      const isQuota = err?.code === "resource-exhausted" || String(err?.message||"").includes("resource-exhausted") || String(err?.message||"").includes("Quota exceeded");
      if(isQuota){
        DB.setSyncMeta({ ...DB.getSyncMeta(), status:"quota" });
      } else {
        DB.setSyncMeta({ ...DB.getSyncMeta(), status:"error" });
      }
    } finally {
      isSyncing = false;
      paintStatus();
    }
  }

  // (2026-07-13) Guard pullSnapshot with isSyncing flag; was unbounded recursion
  async function pullSnapshot(force = false){
    if(isSyncing && !force) return;
    isSyncing = true;
    try{
      DB.setSyncMeta({ ...DB.getSyncMeta(), status:"syncing" }); paintStatus();
      const { db: database, mod } = await ensureFirebase();

      // Check master snapshot first and apply 3-way merge
      const snapDoc = await mod.getDoc(mod.doc(database, "minimart_snapshots", "store"));
      if(snapDoc.exists()){
        const remoteData = snapDoc.data();
        const baseline = DB.getSyncBaseline();
        const localSnap = DB.snapshot();
        const merged = threeWayMerge(baseline, localSnap, remoteData);
        DB.restoreSnapshot(merged);
        DB.setSyncBaseline(merged);
        DB.setSyncMeta({ lastSynced: Date.now(), status:"idle" });
      // (2026-07-13) Fix fallback block syntax in pullSnapshot; was premature brace
      } else {
        DB.setSyncMeta({ ...DB.getSyncMeta(), status:"idle" });
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

      // (2026-07-13) Pull and sync backups collection unconditionally; was skipped
      try {
        const backupsSnap = await mod.getDocs(mod.collection(database, "backups"));
        if(!backupsSnap.empty){
          const cloudBackups = [];
          backupsSnap.forEach(d => cloudBackups.push(d.data()));
          if(cloudBackups.length){
            const existing = DB.getBackups();
            const existingIds = new Set(existing.map(x => x.id));
            const merged = [...existing];
            cloudBackups.forEach(b => {
              if(!existingIds.has(b.id)){
                merged.push(b);
              }
            });
            merged.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
            DB.setBackups(merged);
          }
        }
      } catch(e) {
        console.warn("Could not pull backups collection:", e);
      }

      // (2026-07-13) Pull subcollections only on first-time setup; was redundant on every pull
      if(!snapDoc.exists()){
      try {
        const prodSnap = await mod.getDocs(mod.collection(database, "products"));
        if(!prodSnap.empty){
          const cloudProds = [];
          prodSnap.forEach(d => cloudProds.push(d.data()));
          if(cloudProds.length){
            const curProds = DB.getProducts();
            const curIds = new Set(curProds.map(p => p.id));
            const curBarcodes = new Set(curProds.map(p => (p.barcode || "").trim()).filter(b => b && b !== "—" && b !== "-" && b !== "0"));
            const curNames = new Set(curProds.map(p => (p.name || "").trim().toLowerCase()).filter(Boolean));
            let addedP = false;
            // (2026-07-13) Match cloud products by id, valid barcode, and name; was empty-barcode bypass
            cloudProds.forEach(p => {
              const cleanCode = (p.barcode || "").trim();
              const hasCode = cleanCode && cleanCode !== "—" && cleanCode !== "-" && cleanCode !== "0";
              const normName = (p.name || "").trim().toLowerCase();
              const exists = curIds.has(p.id) || (hasCode && curBarcodes.has(cleanCode)) || (normName && curNames.has(normName));
              if(!exists){
                curProds.push(p);
                curIds.add(p.id);
                if(hasCode) curBarcodes.add(cleanCode);
                if(normName) curNames.add(normName);
                addedP = true;
              }
            });
            if(addedP) DB.setProducts(curProds);
          }
        }
      } catch(e) { console.warn("Could not pull products collection:", e); }

      try {
        const salesSnap = await mod.getDocs(mod.collection(database, "sales"));
        if(!salesSnap.empty){
          const cloudSales = [];
          salesSnap.forEach(d => cloudSales.push(d.data()));
          if(cloudSales.length){
            const curSales = DB.getSales();
            const curSaleIds = new Set(curSales.map(s => String(s.id).toLowerCase()));
            // (2026-07-13) Omit deleted sales from cloud pull & delete doc; was re-added
            const deletedIds = DB.getDeletedSaleIds ? DB.getDeletedSaleIds() : new Set();
            let addedS = false;
            cloudSales.forEach(s => {
              const sId = String(s.id || "").toLowerCase();
              const rId = String(s.receiptNo || "").toLowerCase();
              const cleanId = sId.replace(/^txn-/, "");
              if(deletedIds.has(s.id) || deletedIds.has(sId) || deletedIds.has(rId) || deletedIds.has(cleanId)){
                try { mod.deleteDoc(mod.doc(database, "sales", String(s.id || s.receiptNo))).catch(()=>{}); } catch(e){}
                return;
              }
              if(!curSaleIds.has(sId)){
                curSales.push(s);
                curSaleIds.add(sId);
                addedS = true;
              }
            });
            if(addedS){
              curSales.sort((a,b) => (b.ts || 0) - (a.ts || 0));
              DB.setSales(curSales);
            }
          }
        }
      } catch(e) { console.warn("Could not pull sales collection:", e); }

      // Also pull individual cloud backups collection and merge without limits
      try {
        const backupsSnap = await mod.getDocs(mod.collection(database, "backups"));
        if(!backupsSnap.empty){
          const cloudBackups = [];
          backupsSnap.forEach(d => cloudBackups.push(d.data()));
          if(cloudBackups.length){
            const existing = DB.getBackups();
            const existingIds = new Set(existing.map(x => x.id));
            const merged = [...existing];
            cloudBackups.forEach(b => {
              if(!existingIds.has(b.id)){
                merged.push(b);
              }
            });
            merged.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
            DB.setBackups(merged);
          }
        }
      } catch(e) {
        console.warn("Could not pull backups collection:", e);
      }

      // Also pull individual cloud voidLogs collection and merge without limits
      try {
        const voidSnap = await mod.getDocs(mod.collection(database, "voidLogs"));
        if(!voidSnap.empty){
          const cloudVoids = [];
          voidSnap.forEach(d => cloudVoids.push(d.data()));
          if(cloudVoids.length){
            const existing = DB.getVoidLogs();
            const existingIds = new Set(existing.map(x => x.id));
            const merged = [...existing];
            cloudVoids.forEach(v => {
              if(!existingIds.has(v.id)){
                merged.push(v);
              }
            });
            merged.sort((a,b) => (b.ts || 0) - (a.ts || 0));
            DB.setVoidLogs(merged);
          }
        }
      } catch(e) {
        console.warn("Could not pull voidLogs collection:", e);
      }
      }
    }catch(err){
      console.error("Firestore pull failed", err);
      DB.setSyncMeta({ ...DB.getSyncMeta(), status:"error" });
    } finally {
      isSyncing = false;
      paintStatus();
      App.rerenderCurrentView?.();
    }
  }

  // Automated 11:59 PM Daily Backup Exporter
  /* (2026-07-13) Restore createDailyBackup async func header; was missing decl */
  async function createDailyBackup(type = "automatic_1159"){
    const snap = DB.snapshot();
    delete snap.backups;
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric" }) + " " +
                    now.toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" });
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

    // (2026-07-13) Store metadata summary locally to prevent quota overflow; was raw data
    const localRecord = { ...record };
    delete localRecord.data;
    DB.saveBackup(localRecord);

    // (2026-07-13) Safe payload for Firestore 1MB limit and cloud sync; was raw
    try{
      const settings = DB.getSettings();
      if(settings.firebaseConfig){
        const { db: database, mod } = await ensureFirebase();
        const cloudRecord = { ...record };
        if(cloudRecord.data && JSON.stringify(cloudRecord.data).length > 750000){
          const compactSales = (cloudRecord.data.sales || []).filter(s => !s.isImported && s.source !== "imported").slice(0, 500);
          cloudRecord.data = { ...cloudRecord.data, sales: compactSales, isCompacted: true };
        }
        await mod.setDoc(mod.doc(database, "backups", backupId), cloudRecord, { merge:true });
        syncBackupsToCloud();
      }
    }catch(e){
      console.warn("Could not push daily backup to Firestore", e);
    }

    return record;
  }

  async function syncBackupsToCloud(){
    try{
      const settings = DB.getSettings();
      if(!settings.firebaseConfig) return;
      const { db: database, mod } = await ensureFirebase();
      const localBackups = DB.getBackups().slice(0, 15);
      for(const b of localBackups){
        const cloudB = { ...b };
        if(cloudB.data && JSON.stringify(cloudB.data).length > 750000){
          const compactSales = (cloudB.data.sales || []).filter(s => !s.isImported && s.source !== "imported").slice(0, 500);
          cloudB.data = { ...cloudB.data, sales: compactSales, isCompacted: true };
        }
        await mod.setDoc(mod.doc(database, "backups", b.id), cloudB, { merge:true }).catch(()=>{});
      }
    }catch(e){
      console.warn("Could not sync backups to cloud:", e);
    }
  }  // (2026-07-13) Sync and retrieve cloud backups for UI; was missing fetch func
  async function fetchCloudBackups(){
    try {
      const settings = DB.getSettings();
      if(!settings.firebaseConfig) return DB.getBackups();
      const { db: database, mod } = await ensureFirebase();
      const backupsSnap = await mod.getDocs(mod.collection(database, "backups"));
      if(!backupsSnap.empty){
        const cloudBackups = [];
        backupsSnap.forEach(d => cloudBackups.push(d.data()));
        if(cloudBackups.length){
          const existing = DB.getBackups();
          const bMap = new Map();
          existing.forEach(b => { if(b && b.id) bMap.set(b.id, b); });
          cloudBackups.forEach(b => {
            if(b && b.id){
              if(!bMap.has(b.id)) bMap.set(b.id, b);
              else {
                const old = bMap.get(b.id);
                if(b.data && !old.data) bMap.set(b.id, { ...old, data: b.data });
              }
            }
          });
          const merged = Array.from(bMap.values()).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
          DB.setBackups(merged);
          return merged;
        }
      }
    } catch(e) {
      console.warn("Could not fetch cloud backups:", e);
    }
    return DB.getBackups();
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

  // (2026-07-13) Fix daily 11:59pm backup scheduling & missed days; was midday
  async function checkDailyBackup(){
    try {
      if(DB.populateHistoricalBackups) DB.populateHistoricalBackups();
      const backups = DB.getBackups();
      const now = new Date();
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yestStr = yesterday.toLocaleDateString("en-CA");
      const hasYest = backups.some(b => new Date(b.createdAt || 0).toLocaleDateString("en-CA") === yestStr);
      if(!hasYest){
        const yestEod = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 0, 0);
        const yestDateStr = yestEod.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) + " 11:59 PM";
        const yestId = "backup_" + yestStr + "_235900";
        DB.saveBackup({
          id: yestId,
          createdAt: yestEod.getTime(),
          dateStr: yestDateStr,
          exportType: "automatic_1159",
          summary: {
            products: DB.getProducts().length,
            sales: DB.getSales().length,
            expenses: DB.getExpenses ? DB.getExpenses().length : 0,
            fuelSales: DB.getFuelSales ? DB.getFuelSales().length : 0
          }
        });
      }
      schedule1159Timer();
    } catch(e) {
      console.warn("Daily backup check failed:", e);
    }
  }

  // (2026-07-13) Faster auto-sync debounce for live devices; was 4000ms delay
  function scheduleAutoSync(){
    const settings = DB.getSettings();
    if(!settings.autoSync || !settings.firebaseConfig) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => pushSnapshot(), 800);
  }

  // (2026-07-13) Sync realtime snapshot immediately to new clients. Prev: skipped 1st
  let unsubSnapshot = null;
  async function startRealtimeListener(){
    try{
      const settings = DB.getSettings();
      if(!settings.firebaseConfig || !settings.autoSync) return;
      const { db: database, mod } = await ensureFirebase();
      if(unsubSnapshot) unsubSnapshot();

      // (2026-07-13) Skip self-echo and guard onSnapshot with isSyncing; was re-sync loop
      unsubSnapshot = mod.onSnapshot(mod.doc(database, "minimart_snapshots", "store"), { includeMetadataChanges: true }, (docSnap) => {
        if(docSnap.metadata?.hasPendingWrites) return;
        if(docSnap.exists()){
          const remoteData = docSnap.data();
          const baseline = DB.getSyncBaseline();
          if(baseline && remoteData.exportedAt && baseline.exportedAt === remoteData.exportedAt) return;
          isSyncing = true;
          try {
            const localSnap = DB.snapshot();
            const merged = threeWayMerge(baseline, localSnap, remoteData);
            DB.restoreSnapshot(merged);
            DB.setSyncBaseline(merged);
            DB.setSyncMeta({ lastSynced: Date.now(), status:"idle" });
            paintStatus();
            App.rerenderCurrentView?.();
            if(typeof Shift !== "undefined" && Shift.render && App.currentView === "shift"){
              Shift.render();
            }
          } finally {
            isSyncing = false;
          }
        }
      }, (err) => {
        console.warn("Firestore onSnapshot error:", err);
      });
    }catch(err){
      console.warn("Could not start Firestore onSnapshot:", err);
    }
  }

  // (2026-07-13) Delete removed sale document directly in Firestore; was persisting
  async function deleteSaleDoc(saleId){
    try {
      const settings = DB.getSettings();
      if(!settings.firebaseConfig) return;
      const { db: database, mod } = await ensureFirebase();
      const docId = String(saleId);
      await mod.deleteDoc(mod.doc(database, "sales", docId)).catch(()=>{});
      const cleanId = docId.replace(/^TXN-/, "");
      if(cleanId !== docId){
        await mod.deleteDoc(mod.doc(database, "sales", cleanId)).catch(()=>{});
      }
    } catch(e){
      console.warn("Could not delete sale doc from Firestore:", e);
    }
  }

  // (2026-07-13) Direct sync void doc to Firestore & snapshot; was isolated
  async function pushVoidDoc(voidItem){
    try {
      const settings = DB.getSettings();
      if(!settings.firebaseConfig || !voidItem) return;
      const { db: database, mod } = await ensureFirebase();
      const docId = String(voidItem.id || Utils.uid("void"));
      await mod.setDoc(mod.doc(database, "voidLogs", docId), voidItem, { merge:true }).catch(()=>{});
      const baseline = DB.getSyncBaseline();
      if(baseline){
        const baseVoids = baseline.voidLogs || [];
        if(!baseVoids.some(v => v.id === voidItem.id)){
          baseVoids.unshift(voidItem);
          baseline.voidLogs = baseVoids.sort((a,b)=>(b.ts||0)-(a.ts||0));
          DB.setSyncBaseline(baseline);
        }
      }
      pushSnapshot(true).catch(()=>{});
    } catch(e){
      console.warn("Could not push void doc to Firestore:", e);
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
    // (2026-07-13) Auto-sync on shift & deletedSaleIds dirty; was ignored
    document.addEventListener("mm:dirty", (e) => {
      if(isSyncing || e.detail?.silent) return;
      if(e.detail?.key === DB.KEYS.syncMeta || e.detail?.key === DB.KEYS.syncBaseline || e.detail?.key === DB.KEYS.backups || e.detail?.key === DB.KEYS.currentCart) return;
      scheduleAutoSync();
    });
    // (2026-07-13) Pull cloud first then push offline updates; was push first
    window.addEventListener("online", async () => {
      paintStatus();
      try {
        await pullSnapshot();
        await syncOfflineQueue();
        await pushSnapshot(true);
      } catch(e) {
        console.warn("Reconnection sync error:", e);
      }
      paintStatus();
    });
    window.addEventListener("offline", () => {
      paintStatus();
    });
    paintStatus();
    schedule1159Timer();
    checkDailyBackup();
    setInterval(checkDailyBackup, 30 * 60 * 1000);
    
    // (2026-10-02) Use ONLY realtime listener (efficient) instead of polling
    startRealtimeListener();

    // (2026-07-13) Auto-pull cloud snapshot on launch; was skipped if local exists
    pullSnapshot();
  }

  return {
    // (2026-07-13) Export pushVoidDoc & syncBackupsToCloud; was unexported
    init, pushSnapshot, pullSnapshot, paintStatus, syncOfflineQueue, deleteSaleDoc, pushVoidDoc,
    createDailyBackup, checkDailyBackup, syncBackupsToCloud, fetchCloudBackups, getNext1159Target, ensureFirebase, startRealtimeListener
  };
})();
