// ============================================================
// sync.js — Firestore snapshot sync (optional).
// Local storage is ALWAYS the source of truth first. This module
// only pushes/pulls a JSON snapshot to a single Firestore doc:
//   collection "minimart" -> doc <businessId>
// Uses the Firebase modular CDN SDK, loaded lazily only when a
// config is actually saved in Settings.
// ============================================================
const Sync = (() => {
  let app = null, db = null, firestoreMod = null;
  let debounceTimer = null;
  const DOC_PATH = { collection:"minimart_snapshots", doc:"store" };

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
      el.querySelector(".lbl").textContent = "Not synced yet";
    }
  }

  async function ensureFirebase(){
    const settings = DB.getSettings();
    if(!settings.firebaseConfig) throw new Error("No Firebase config saved in Settings.");
    if(db) return db;
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
    firestoreMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    app = initializeApp(settings.firebaseConfig);
    db = firestoreMod.getFirestore(app);
    return db;
  }

  async function pushSnapshot(){
    const meta = DB.getSyncMeta();
    try{
      DB.setSyncMeta({ ...meta, status:"syncing" }); paintStatus();
      const database = await ensureFirebase();
      const ref = firestoreMod.doc(database, DOC_PATH.collection, DOC_PATH.doc);
      await firestoreMod.setDoc(ref, DB.snapshot(), { merge:false });
      DB.setSyncMeta({ lastSynced: Date.now(), status:"idle" });
      Utils.toast("Synced to Firestore ☁️", "success");
    }catch(err){
      console.error("Sync push failed", err);
      DB.setSyncMeta({ ...DB.getSyncMeta(), status:"error" });
      Utils.toast("Sync failed — check Firebase config / connection", "error");
    }
    paintStatus();
  }

  async function pullSnapshot(){
    try{
      DB.setSyncMeta({ ...DB.getSyncMeta(), status:"syncing" }); paintStatus();
      const database = await ensureFirebase();
      const ref = firestoreMod.doc(database, DOC_PATH.collection, DOC_PATH.doc);
      const snap = await firestoreMod.getDoc(ref);
      if(snap.exists()){
        DB.restoreSnapshot(snap.data());
        Utils.toast("Pulled latest data from Firestore ☁️", "success");
        DB.setSyncMeta({ lastSynced: Date.now(), status:"idle" });
      } else {
        Utils.toast("No snapshot found in Firestore yet — push first.", "warn");
        DB.setSyncMeta({ ...DB.getSyncMeta(), status:"idle" });
      }
    }catch(err){
      console.error("Sync pull failed", err);
      DB.setSyncMeta({ ...DB.getSyncMeta(), status:"error" });
      Utils.toast("Pull failed — check Firebase config / connection", "error");
    }
    paintStatus();
    App.rerenderCurrentView?.();
  }

  function scheduleAutoSync(){
    const settings = DB.getSettings();
    if(!settings.autoSync || !settings.firebaseConfig) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => pushSnapshot(), 4000); // debounce rapid local writes
  }

  function init(){
    document.addEventListener("mm:dirty", (e) => {
      if(e.detail?.key === DB.KEYS.syncMeta) return; // avoid feedback loop
      scheduleAutoSync();
    });
    window.addEventListener("online", paintStatus);
    window.addEventListener("offline", paintStatus);
    paintStatus();
  }

  return { init, pushSnapshot, pullSnapshot, paintStatus };
})();
