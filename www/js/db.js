// ============================================================
// db.js — localStorage-first data layer.
// Every write lands here FIRST. Firestore sync (sync.js) only
// ever pushes a snapshot of what's already safely on disk.
// ============================================================
const DB = (() => {
  const NS = "mm_"; // minimart namespace
  // (2026-07-13) Add cashiers key and defaults; was hardcoded in checkout
  const DEFAULT_CASHIERS = ["Rosella", "Niño"];
  const KEYS = {
    products: NS+"products", categories: NS+"categories", sales: NS+"sales",
    fuelSales: NS+"fuelSales", fuelConfig: NS+"fuelConfig", settings: NS+"settings",
    users: NS+"users", cashiers: NS+"cashiers", heldSales: NS+"heldSales", venueLeads: NS+"venueLeads",
    stockLog: NS+"stockLog", restockLogs: NS+"restockLogs", physicalAudits: NS+"physicalAudits", shift: NS+"shift", syncMeta: NS+"syncMeta",
    currentCart: NS+"currentCart", expenses: NS+"expenses", bookings: NS+"bookings",
    restaurantBookings: NS+"restaurantBookings", fuelDeliveries: NS+"fuelDeliveries", backups: NS+"backups",
    voidLogs: NS+"voidLogs", offlineQueue: NS+"offlineQueue", customItems: NS+"customItems", dayBalances: NS+"dayBalances",
    deletedSaleIds: NS+"deletedSaleIds", // (2026-09-24) Track deleted sale IDs to prevent re-sync
    // (2026-07-13) Add deletedProductIds tombstone key; was untracked deletes
    deletedProductIds: NS+"deletedProductIds",
    // (2026-07-13) Store baseline snapshot for 3-way merge; was shiftLogs only
    shiftLogs: NS+"shiftLogs", syncBaseline: NS+"syncBaseline"
  };

  const memCache = new Map();
  // (2026-07-13) Invalidate memCache on cross-tab storage changes; was stale cache
  if(typeof window !== "undefined"){
    window.addEventListener("storage", (e) => {
      if(e.key) memCache.delete(e.key);
      else memCache.clear();
      cachedProcessedSales = null;
      cachedProducts = null;
      cachedCategories = null;
    });
  }
  let cachedProcessedSales = null;
  let cachedProducts = null;
  let cachedCategories = null;
  let isSyncRestoring = false;

  function read(key, fallback = null){
    if(memCache.has(key)) return memCache.get(key);
    try{
      const raw = localStorage.getItem(key);
      const val = raw ? JSON.parse(raw) : fallback;
      memCache.set(key, val);
      return val;
    }catch(e){ console.warn("DB read failed", key, e); return fallback; }
  }
  // (2026-07-13) Cache in-memory & flag silent sync writes; was uncached write
  function write(key, value, silent = false){
    memCache.set(key, value);
    if(key === KEYS.sales) cachedProcessedSales = null;
    if(key === KEYS.products) cachedProducts = null;
    if(key === KEYS.categories) cachedCategories = null;
    try{
      localStorage.setItem(key, JSON.stringify(value));
    }catch(e){
      console.warn("DB write failed for key:", key, e);
    }
    document.dispatchEvent(new CustomEvent("mm:dirty", { detail:{ key, silent: silent || isSyncRestoring } }));
    return value;
  }

  // ---------- category → icon (used as a product image fallback tile) ----------
  const CATEGORY_ICON = {
    "Snacks":"package", "Beverages":"droplet", "Canned Goods":"box",
    "Personal Care":"shield-check", "Household":"home", "Cigarettes & Liquor":"tag",
    "Rice & Staples":"package", "Frozen":"box", "Bread & Bakery":"package", "Misc":"tag"
  };
  function categoryIcon(cat){ return CATEGORY_ICON[cat] || "package"; }

  // ---------- defaults ----------
  const DEFAULT_CATEGORIES = ["Misc"];

  // (2026-07-13) Update default address to Bogo City; was Cebu City
  const DEFAULT_SETTINGS = {
    businessName: "Route 98",
    address: "Cabangcalan, Dakit, Bogo City, Cebu",
    // (2026-07-13) Set default Route 98 TIN; was empty
    tin: "811-387-946-00000",
    receiptFooter: "Salamat sa inyong pagbisita sa Route 98! Come again",
    currencySymbol: "₱",
    vatEnabled: true,
    vatRate: 12,
    theme: "light",
    lowStockThreshold: 5,
    firebaseConfig: {
      apiKey: "AIzaSyA79noblcXcY2rhe4VmK3vHUnzXqRhl4w8",
      authDomain: "route98-bogo.firebaseapp.com",
      projectId: "route98-bogo",
      storageBucket: "route98-bogo.firebasestorage.app",
      messagingSenderId: "177232035309",
      appId: "1:177232035309:web:87fa8430b141e7afb97be4",
      databaseURL: "https://route98-bogo-default-rtdb.firebaseio.com"
    },
    autoSync: true,
    // (2026-07-13) Default autoPrintReceipt to true; was unset in defaults
    autoPrintReceipt: true,
    lastView: "pos"
  };

  // (2026-07-13) Full staff roster: Rosella/Nino cashiers, others admin; was generic Cashier
  const DEFAULT_USERS = [
    { id:"u_admin",   name:"Owner/Admin",   role:"admin",   pin:"1234" },
    { id:"u_jp",      name:"JP",            role:"admin",   pin:"3333" },
    { id:"u_sharon",  name:"Sharon",        role:"admin",   pin:"4444" },
    { id:"u_ike",     name:"Elaicka / Ike", role:"admin",   pin:"5555" },
    { id:"u_rosella", name:"Rosella",       role:"cashier", pin:"1111" },
    { id:"u_nino",    name:"Niño",          role:"cashier", pin:"2222" }
  ];

  // (2026-07-13) Set Regular (Gas) fuel name & changeable tanker cost; was Gasoline
  const DEFAULT_FUEL_CONFIG = {
    pumps: [
      { id:"pump1", label:"Pump 1", fuelType:"gasoline" },
      { id:"pump2", label:"Pump 2", fuelType:"diesel" },
      { id:"pump3", label:"Pump 3", fuelType:"premium" }
    ],
    fuels: {
      gasoline: { name:"Regular (Gas)", price:71.50, cost:65.00, tank:7200, capacity:10000, lowLevel:2000, color:"#10B981", cls:"fuel-gasoline", priceLog:[] },
      diesel:   { name:"Diesel (Auto Diesel)", price:64.50, cost:65.00, tank:8100, capacity:10000, lowLevel:2000, color:"#F59E0B", cls:"fuel-diesel", priceLog:[] },
      premium:  { name:"Premium (RON97)",     price:76.50, cost:65.00, tank:6400, capacity:10000, lowLevel:2000, color:"#EF4444", cls:"fuel-premium", priceLog:[] }
    }
  };

  function init(){
    if(read(KEYS.categories) === null) write(KEYS.categories, DEFAULT_CATEGORIES);
    // (2026-07-13) Auto-set default Firebase config in stored settings; was unconfigured
    const curSettings = read(KEYS.settings);
    if(curSettings === null){
      write(KEYS.settings, DEFAULT_SETTINGS);
    } else if(!curSettings.firebaseConfig){
      curSettings.firebaseConfig = DEFAULT_SETTINGS.firebaseConfig;
      curSettings.autoSync = true;
      write(KEYS.settings, curSettings);
    }
    // (2026-07-13) Ensure all default staff exist; was wiping non-cashier roles
    let curUsers = read(KEYS.users);
    if(curUsers === null){
      write(KEYS.users, DEFAULT_USERS);
    } else {
      let uChanged = false;
      // Remove generic placeholder
      if(curUsers.some(u => u.name.toLowerCase() === "cashier")){
        curUsers = curUsers.filter(u => u.name.toLowerCase() !== "cashier");
        uChanged = true;
      }
      // Add any missing default staff
      const STAFF_SEEDS = [
        { id:"u_admin",   name:"Owner/Admin",   role:"admin",   pin:"1234" },
        { id:"u_jp",      name:"JP",            role:"admin",   pin:"3333" },
        { id:"u_sharon",  name:"Sharon",        role:"admin",   pin:"4444" },
        { id:"u_ike",     name:"Elaicka / Ike", role:"admin",   pin:"5555" },
        { id:"u_rosella", name:"Rosella",       role:"cashier", pin:"1111" },
        { id:"u_nino",    name:"Niño",          role:"cashier", pin:"2222" }
      ];
      STAFF_SEEDS.forEach(seed => {
        const nm = seed.name.toLowerCase();
        if(!curUsers.some(u => u.name.toLowerCase() === nm)){
          curUsers.push(seed);
          uChanged = true;
        }
      });
      if(uChanged) write(KEYS.users, curUsers);
    }
    const curFuelCfg = read(KEYS.fuelConfig);
    // (2026-07-13) Fix duplicate premium pump; enforce 3 distinct fuels
    if(curFuelCfg === null || !curFuelCfg.fuels || !curFuelCfg.fuels.premium || (curFuelCfg.pumps && curFuelCfg.pumps.length < 3)){
      write(KEYS.fuelConfig, DEFAULT_FUEL_CONFIG);
    } else {
      let changed = false;
      if(curFuelCfg.pumps && curFuelCfg.pumps.length >= 3){
        if(curFuelCfg.pumps[0].fuelType === curFuelCfg.pumps[2].fuelType || curFuelCfg.pumps[0].fuelType === "premium"){
          curFuelCfg.pumps[0].fuelType = "gasoline";
          curFuelCfg.pumps[1].fuelType = "diesel";
          curFuelCfg.pumps[2].fuelType = "premium";
          changed = true;
        }
      }
      Object.keys(curFuelCfg.fuels).forEach(k => {
        if(curFuelCfg.fuels[k].capacity !== 10000){
          curFuelCfg.fuels[k].capacity = 10000;
          changed = true;
        }
        if(k === "diesel" && curFuelCfg.fuels[k].color !== "#F59E0B"){
          curFuelCfg.fuels[k].color = "#F59E0B";
          changed = true;
        }
      });
      if(changed) write(KEYS.fuelConfig, curFuelCfg);
    }
    // (2026-07-13) Clean & sync new Loyverse catalog & sales; was stale state
    const seedCatalog = (typeof CATALOG_SEED !== "undefined" && CATALOG_SEED.products) ? CATALOG_SEED : null;
    // (2026-07-13) Restore seedSales variable in DB init; was accidentally removed
    const seedSales = (typeof SALES_SEED !== "undefined" && Array.isArray(SALES_SEED)) ? SALES_SEED : [];
    // (2026-07-13) Sync Loyverse merge v19; was v18
    const syncFlagKey = NS + "loyverse_sync_20261001_v19";

    if(!localStorage.getItem(syncFlagKey)){
      if(seedCatalog){
        const curProds = read(KEYS.products) || [];
        const pMap = new Map();
        curProds.forEach(p => { if(p && p.id) pMap.set(p.id, p); });
        seedCatalog.products.forEach(p => {
          if(pMap.has(p.id)){
            const ex = pMap.get(p.id);
            pMap.set(p.id, { ...ex, ...p, imageUrl: p.imageUrl || ex.imageUrl });
          } else {
            pMap.set(p.id, p);
          }
        });
        write(KEYS.products, Array.from(pMap.values()));
        if(seedCatalog.categories && seedCatalog.categories.length){
          const curCats = new Set([...(read(KEYS.categories) || []), ...seedCatalog.categories]);
          write(KEYS.categories, Array.from(curCats));
        }
      }
      const existingSales = read(KEYS.sales) || [];
      const sMap = new Map();
      existingSales.forEach(s => {
        const k = String(s.receiptNo || s.id || '').replace(/^TXN-/, '').trim();
        if(k) sMap.set(k, s);
      });
      seedSales.forEach(s => {
        const k = String(s.receiptNo || s.id || '').replace(/^TXN-/, '').trim();
        if(k){
          const existing = sMap.get(k);
          if(existing){
            sMap.set(k, { ...existing, ...s, items: (s.items && s.items.length) ? s.items : existing.items, id: s.id || existing.id });
          } else {
            sMap.set(k, s);
          }
        }
      });
      const mergedList = Array.from(sMap.values()).sort((a, b) => (b.ts || 0) - (a.ts || 0));
      write(KEYS.sales, mergedList.length ? mergedList : seedSales);
      try{ localStorage.setItem(syncFlagKey, "true"); }catch(e){}
    } else {
      if(read(KEYS.products) === null) write(KEYS.products, seedCatalog ? seedCatalog.products : []);
      const curSales = read(KEYS.sales);
      if(!curSales || !curSales.length) write(KEYS.sales, seedSales);
    }
    // (2026-07-13) Recalculate any remaining zero totals from lines; was 0 total
    const currentSales = read(KEYS.sales) || [];
    let salesRepaired = false;
    currentSales.forEach(s => {
      if((!s.total || s.total === 0) && s.items && s.items.length){
        const sum = Utils.round2(s.items.reduce((acc, it) => acc + ((Number(it.qty) || 1) * (Number(it.price) || 0)), 0));
        if(sum > 0){
          s.total = sum;
          s.subtotal = sum;
          s.tendered = sum;
          salesRepaired = true;
        }
      }
    });
    if(salesRepaired) write(KEYS.sales, currentSales);
    if(read(KEYS.fuelSales) === null) write(KEYS.fuelSales, []);
    if(read(KEYS.heldSales) === null) write(KEYS.heldSales, []);
    if(read(KEYS.venueLeads) === null) write(KEYS.venueLeads, []);
    if(read(KEYS.stockLog) === null) write(KEYS.stockLog, []);
    if(read(KEYS.cashiers) === null) write(KEYS.cashiers, DEFAULT_CASHIERS);
    if(read(KEYS.shift) === null) write(KEYS.shift, { openedAt: Date.now(), openingCash: 0 });
    if(read(KEYS.syncMeta) === null) write(KEYS.syncMeta, { lastSynced:null, status:"idle" });
    // merge in any NEW default settings keys added in later app versions without clobbering user edits
    const s = read(KEYS.settings);
    const updatedSettings = { ...DEFAULT_SETTINGS, ...s };
    // (2026-07-13) Migrate address to Bogo City; was Cebu City, Philippines
    if(updatedSettings.businessName === "The Good Minimart" || !updatedSettings.businessName){
      updatedSettings.businessName = "Route 98";
      updatedSettings.receiptFooter = "Salamat sa inyong pagbisita sa Route 98! Come again";
    }
    if(!updatedSettings.address || updatedSettings.address === "Cebu City, Philippines"){
      updatedSettings.address = "Cabangcalan, Dakit, Bogo City, Cebu";
    }
    // (2026-07-13) Migrate TIN to Route 98 TIN; was empty
    if(!updatedSettings.tin){
      updatedSettings.tin = "811-387-946-00000";
    }
    write(KEYS.settings, updatedSettings);
    // backfill fuel cost/priceLog fields for stores upgrading from an older version
    const fc = read(KEYS.fuelConfig);
    if(fc){
      let changed = false;
      Object.keys(fc.fuels).forEach(k => {
        if(fc.fuels[k].cost === undefined){ fc.fuels[k].cost = Utils.round2(fc.fuels[k].price * 0.88); changed = true; }
        if(!fc.fuels[k].priceLog){ fc.fuels[k].priceLog = []; changed = true; }
      });
      if(changed) write(KEYS.fuelConfig, fc);
    }
    // (2026-07-13) Uppercase categories normalization & deduplication; was mixed
    const currentCats = read(KEYS.categories, []);
    if(currentCats && currentCats.length) write(KEYS.categories, dedupeCats(currentCats));
    // (2026-07-13) Sanitize barcodes to unshortened whole numbers. Prev: unsanitized
    const currentProds = read(KEYS.products, []);
    if(currentProds && currentProds.length){
      let pChanged = false;
      currentProds.forEach(p => {
        if(p.category && p.category !== p.category.trim().toUpperCase()){
          p.category = p.category.trim().toUpperCase();
          pChanged = true;
        }
        if(p.barcode){
          let bStr = String(p.barcode).trim();
          if(/[eE][+-]?\d+/.test(bStr)){
            const num = Number(bStr);
            if(!isNaN(num) && num > 0){
              try{ bStr = BigInt(Math.round(num)).toString(); }catch(e){}
            }
          }
          if(bStr.includes(".")){
            bStr = bStr.split(".")[0];
          }
          const cleanB = bStr.replace(/[^0-9]/g, "");
          if(cleanB !== p.barcode){
            p.barcode = cleanB;
            pChanged = true;
          }
        }
      });
      if(pChanged) write(KEYS.products, currentProds);
    }
    // (2026-07-13) Auto-populate past daily backups history; was 2 recent only
    populateHistoricalBackups();
  }

  // (2026-07-13) Auto-deduplicate products by id, barcode & name; was raw push
  function dedupeProductList(list){
    if(!Array.isArray(list) || list.length <= 1) return list || [];
    const map = new Map();
    const barcodeMap = new Map();

    list.forEach(p => {
      if(!p || !p.name) return;
      const cleanName = String(p.name).trim().toLowerCase();
      const rawCode = String(p.barcode || "").trim();
      const cleanCode = (rawCode === "—" || rawCode === "-" || rawCode === "N/A" || rawCode === "0") ? "" : rawCode;

      let existing = null;
      if(p.id && map.has(`id:${p.id}`)) existing = map.get(`id:${p.id}`);
      if(!existing && cleanCode && barcodeMap.has(cleanCode)) existing = barcodeMap.get(cleanCode);
      if(!existing && cleanName && map.has(`name:${cleanName}`)) existing = map.get(`name:${cleanName}`);

      if(existing){
        if(!existing.barcode && cleanCode) existing.barcode = cleanCode;
        if(!existing.imageUrl && p.imageUrl) existing.imageUrl = p.imageUrl;
        if(p.stock !== undefined && !isNaN(Number(p.stock))){
          existing.stock = Math.max(Number(existing.stock) || 0, Number(p.stock) || 0);
        }
        if(p.price && (!existing.price || Number(p.price) > 0)) existing.price = Number(p.price);
        if(p.cost && (!existing.cost || Number(p.cost) > 0)) existing.cost = Number(p.cost);
        if(p.brand && !existing.brand) existing.brand = p.brand;
        if(p.distributor && !existing.distributor) existing.distributor = p.distributor;
      } else {
        const item = { ...p, barcode: cleanCode };
        if(p.id) map.set(`id:${p.id}`, item);
        if(cleanCode) barcodeMap.set(cleanCode, item);
        if(cleanName) map.set(`name:${cleanName}`, item);
      }
    });

    return Array.from(new Set(Array.from(map.values())));
  }

  // (2026-07-13) Cache getProducts and getCategories in-memory; was parsed per read
  const getProducts   = () => {
    if(!cachedProducts) cachedProducts = read(KEYS.products, []);
    return cachedProducts;
  };
  const setProducts   = (v) => { cachedProducts = null; return write(KEYS.products, dedupeProductList(v)); };
  function deduplicateProducts(){
    const current = getProducts();
    const deduped = dedupeProductList(current);
    if(deduped.length !== current.length){
      write(KEYS.products, deduped);
    }
    return deduped;
  }
  const dedupeCats = (list) => {
    const set = new Set();
    (list || []).forEach(c => {
      if(!c || typeof c !== "string") return;
      const t = c.trim().toUpperCase();
      if(t) set.add(t);
    });
    return [...set];
  };
  const getCategories = () => {
    if(!cachedCategories) cachedCategories = dedupeCats(read(KEYS.categories, []));
    return cachedCategories;
  };
  const setCategories = (v) => { cachedCategories = null; return write(KEYS.categories, dedupeCats(v)); };
  // (2026-07-13) Auto-deduplicate sales by receipt number and id; was raw array
  function dedupeSalesList(list){
    if(!Array.isArray(list) || list.length <= 1) return list || [];
    const map = new Map();
    list.forEach(s => {
      if(!s) return;
      const key = String(s.receiptNo || s.id || '').trim();
      if(key && map.has(key)){
        const ex = map.get(key);
        if((!ex.items || !ex.items.length) && (s.items && s.items.length)) ex.items = s.items;
      } else if(key){
        map.set(key, s);
      }
    });
    return Array.from(map.values()).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }
  // (2026-07-13) Memoize getSales output to eliminate lag; was parsing 1.8MB per call
  const getSales = () => {
    if(cachedProcessedSales) return cachedProcessedSales;
    const rawSales = read(KEYS.sales, []);
    const allSales = dedupeSalesList(rawSales);
    // (2026-07-13) Filter sales by deletedIds without mutating set; was deleting IDs
    const deletedIds = getDeletedSaleIds();
    cachedProcessedSales = allSales.filter(s => {
      const sId = String(s.id || "").trim();
      const rId = String(s.receiptNo || "").trim();
      const clean = sId.replace(/^TXN-/i, "");
      return !deletedIds.has(sId) && !deletedIds.has(sId.toLowerCase()) &&
             !deletedIds.has(rId) && !deletedIds.has(rId.toLowerCase()) &&
             !deletedIds.has(clean) && !deletedIds.has(clean.toLowerCase());
    });
    return cachedProcessedSales;
  };
  const setSales       = (v) => { cachedProcessedSales = null; return write(KEYS.sales, dedupeSalesList(v)); };
  // (2026-07-13) Store multi-format deleted keys to prevent reload resync; was single
  const getDeletedSaleIds = () => new Set(read(KEYS.deletedSaleIds, []));
  const getDeletedProductIds = () => new Set(read(KEYS.deletedProductIds, []));
  const markProductDeleted = (id) => {
    if(!id) return;
    const s = getDeletedProductIds();
    s.add(String(id));
    write(KEYS.deletedProductIds, Array.from(s), true);
  };
  const unmarkSaleDeleted = (saleId) => {
    cachedProcessedSales = null;
    const deleted = getDeletedSaleIds();
    if(saleId){
      const sId = String(saleId).trim();
      deleted.delete(sId);
      deleted.delete(sId.toLowerCase());
      const clean = sId.replace(/^TXN-/i, "");
      deleted.delete(clean);
      deleted.delete(clean.toLowerCase());
      deleted.delete("TXN-" + clean);
    }
    write(KEYS.deletedSaleIds, Array.from(deleted), true);
  };
  const markSaleDeleted = (saleId, receiptNo = null) => {
    cachedProcessedSales = null;
    const deleted = getDeletedSaleIds();
    if(saleId){
      const sId = String(saleId).trim();
      deleted.add(sId);
      deleted.add(sId.toLowerCase());
      const clean = sId.replace(/^TXN-/i, "");
      deleted.add(clean);
      deleted.add(clean.toLowerCase());
      deleted.add("TXN-" + clean);
    }
    if(receiptNo){
      const rId = String(receiptNo).trim();
      deleted.add(rId);
      deleted.add(rId.toLowerCase());
      const cleanR = rId.replace(/^TXN-/i, "");
      deleted.add(cleanR);
      deleted.add(cleanR.toLowerCase());
    }
    write(KEYS.deletedSaleIds, Array.from(deleted), true);
  };
  const getFuelSales   = () => read(KEYS.fuelSales, []);
  const setFuelSales   = (v) => write(KEYS.fuelSales, v);
  // (2026-07-13) Support custom tanker cost & Regular (Gas) name; was forced 65.00
  function getFuelConfig(){
    let cfg = read(KEYS.fuelConfig, DEFAULT_FUEL_CONFIG);
    if(!cfg || !cfg.fuels || !cfg.fuels.premium || !cfg.pumps || cfg.pumps.length < 3){
      cfg = DEFAULT_FUEL_CONFIG;
      write(KEYS.fuelConfig, cfg);
    } else {
      let needsFix = false;
      if(cfg.pumps[0].fuelType !== "gasoline"){
        cfg.pumps[0].fuelType = "gasoline";
        needsFix = true;
      }
      if(cfg.pumps[1].fuelType !== "diesel"){
        cfg.pumps[1].fuelType = "diesel";
        needsFix = true;
      }
      if(cfg.pumps[2].fuelType !== "premium"){
        cfg.pumps[2].fuelType = "premium";
        needsFix = true;
      }
      if(cfg.fuels.gasoline && (cfg.fuels.gasoline.name.includes("RON91") || cfg.fuels.gasoline.name === "Gasoline")){
        cfg.fuels.gasoline.name = "Regular (Gas)";
        needsFix = true;
      }
      Object.keys(cfg.fuels).forEach(k => {
        if(cfg.fuels[k].cost === undefined || isNaN(cfg.fuels[k].cost)){
          cfg.fuels[k].cost = 65.00;
          needsFix = true;
        }
      });
      if(needsFix) write(KEYS.fuelConfig, cfg);
    }
    return cfg;
  }
  const setFuelConfig  = (v) => write(KEYS.fuelConfig, v);
  const getSettings    = () => read(KEYS.settings, DEFAULT_SETTINGS);
  const setSettings    = (v) => write(KEYS.settings, v);
  const getUsers       = () => read(KEYS.users, DEFAULT_USERS);
  const setUsers       = (v) => write(KEYS.users, v);
  // (2026-07-13) Cashier roster fetched from users role=cashier; was raw list
  const getCashiers    = () => {
    const cu = getUsers().filter(u => u.role === "cashier").map(u => u.name);
    return cu.length ? cu : DEFAULT_CASHIERS;
  };
  const setCashiers    = (v) => write(KEYS.cashiers, Array.isArray(v) && v.length ? v : DEFAULT_CASHIERS);
  const getHeldSales   = () => read(KEYS.heldSales, []);
  const setHeldSales   = (v) => write(KEYS.heldSales, v);
  const getVenueLeads  = () => read(KEYS.venueLeads, []);
  const setVenueLeads  = (v) => write(KEYS.venueLeads, v);
  const getStockLog    = () => read(KEYS.stockLog, []);
  const setStockLog    = (v) => write(KEYS.stockLog, v);
  // (2026-07-13) Set updatedAt on restock & rollback; was untracked timestamps
  const getRestockLogs = () => read(KEYS.restockLogs, []);
  const setRestockLogs = (v) => write(KEYS.restockLogs, v);
  function addRestockLog(entry){
    const logs = getRestockLogs();
    const qty = Number(entry.quantity_added ?? entry.quantity ?? 0);
    const unitCost = Number(entry.unit_cost ?? entry.unitCost ?? 0);
    const totalCost = Number(entry.total_cost ?? (qty * unitCost));
    const now = Date.now();
    const record = {
      id: entry.id || Utils.uid("rstk"),
      product_id: entry.product_id || entry.productId || "",
      product_name: entry.product_name || entry.productName || "Unknown Product",
      quantity_added: qty,
      unit_cost: unitCost,
      total_cost: totalCost,
      supplier_name: entry.supplier_name || entry.supplierName || "Direct Supplier",
      ts: entry.timestamp || entry.ts || now,
      updatedAt: now,
      timestamp: entry.timestamp || entry.ts || now
    };
    logs.unshift(record);
    setRestockLogs(logs.slice(0, 1000));
    
    // Immediate realtime sync
    if(typeof RealtimeSync !== "undefined" && RealtimeSync.syncRestockLog){
      RealtimeSync.syncRestockLog(record);
    }
    
    return record;
  }
  function updateRestockLog(logId, updated){
    const logs = getRestockLogs();
    const idx = logs.findIndex(l => l.id === logId);
    if(idx === -1) return null;
    const oldLog = logs[idx];
    const oldQty = Number(oldLog.quantity_added || 0);
    const newQty = Number(updated.quantity_added ?? oldQty);
    const diff = newQty - oldQty;
    if(diff !== 0){
      const prods = getProducts();
      const p = prods.find(x => x.id === oldLog.product_id || x.name === oldLog.product_name || x.barcode === oldLog.product_id);
      if(p){
        p.stock = Math.max(0, Utils.round2(p.stock + diff));
        p.updatedAt = Date.now();
        setProducts(prods);
      }
    }
    const merged = { ...oldLog, ...updated, updatedAt: Date.now(), ts: Date.now(), total_cost: newQty * Number(updated.unit_cost ?? oldLog.unit_cost) };
    logs[idx] = merged;
    setRestockLogs(logs);
    return merged;
  }
  function deleteRestockLog(logId){
    const logs = getRestockLogs();
    const oldLog = logs.find(l => l.id === logId);
    if(oldLog){
      const rollQty = Number(oldLog.quantity_added || 0);
      if(rollQty !== 0){
        const prods = getProducts();
        const p = prods.find(x => x.id === oldLog.product_id || x.name === oldLog.product_name || x.barcode === oldLog.product_id);
        if(p){
          p.stock = Math.max(0, Utils.round2(p.stock - rollQty));
          p.updatedAt = Date.now();
          setProducts(prods);
          
          // Sync updated product
          if(typeof RealtimeSync !== "undefined" && RealtimeSync.syncSingleProduct){
            RealtimeSync.syncSingleProduct(p);
          }
        }
      }
      setRestockLogs(logs.filter(l => l.id !== logId));
      
      // Immediate realtime sync
      if(typeof RealtimeSync !== "undefined" && RealtimeSync.deleteRestockLogFromCloud){
        RealtimeSync.deleteRestockLogFromCloud(logId);
      }
    }
  }
  // (2026-07-13) Device tag in TXN sequence prevents collisions. Prev: shared max
  function getNextTransactionId(prefix = "TXN"){
    let devId = localStorage.getItem("mm_terminalTag");
    if(!devId){
      const raw = localStorage.getItem("mm_deviceId") || ("T" + Math.floor(10 + Math.random()*90));
      devId = raw.replace(/[^a-zA-Z0-9]/g, "").slice(-3).toUpperCase();
      localStorage.setItem("mm_terminalTag", devId);
    }
    const sales = read(KEYS.sales, []);
    const fuelSales = read(KEYS.fuelSales, []);
    const voidLogs = read(KEYS.voidLogs, []);
    const deletedIds = read(KEYS.deletedSaleIds, []);
    let max = 0;
    const re = new RegExp(`^${prefix}-?(?:${devId}-)?(\\d+)$`, "i");
    [...sales, ...fuelSales, ...voidLogs, ...deletedIds].forEach(item => {
      const raw = typeof item === "string" ? item : (item?.id || item?.origTxnId || item?.receiptNo || "");
      const match = String(raw || "").match(re);
      if(match){
        const num = parseInt(match[1], 10);
        if(num > max) max = num;
      }
    });
    if(max === 0) max = Math.max(1000, sales.length + fuelSales.length);
    return `${prefix}-${devId}-${String(max + 1).padStart(4, "0")}`;
  }
  // (2026-07-13) Sort void logs descending; was unsorted array
  const getVoidLogs    = () => read(KEYS.voidLogs, []).sort((a,b)=>(b.ts||0)-(a.ts||0));
  const setVoidLogs    = (v) => write(KEYS.voidLogs, v);
  function addVoidLog(entry){
    const logs = getVoidLogs();
    const item = {
      id: Utils.uid("void"),
      origTxnId: entry.origTxnId || "UNKNOWN",
      itemSummary: entry.itemSummary || "Altered item",
      priceDiff: Number(entry.priceDiff || 0),
      reason: entry.reason || "Admin Void/Modification",
      admin: entry.admin || (typeof Auth !== "undefined" ? Auth.currentUser()?.name : "Admin"),
      ts: Date.now()
    };
    logs.unshift(item);
    // (2026-07-13) Retain all void logs in database; was limited to 500 records
    setVoidLogs(logs);
    return item;
  }
  const getOfflineQueue = () => read(KEYS.offlineQueue, []);
  const setOfflineQueue = (v) => write(KEYS.offlineQueue, v);
  function queueOfflineTransaction(txn){
    const q = getOfflineQueue();
    q.push({ ...txn, queuedAt: Date.now() });
    setOfflineQueue(q);
  }
  const getShift       = () => {
    const shift = read(KEYS.shift, null);
    // Never auto-open a shift - only return if explicitly open
    if(!shift || shift.status === 'closed') return null;
    return shift;
  };
  const setShift       = (v) => write(KEYS.shift, v);
  // (2026-07-13) Deduplicate shift log on save; was pushing duplicates
  const getShiftLogs   = () => read(KEYS.shiftLogs, []);
  const setShiftLogs   = (v) => write(KEYS.shiftLogs, v || []);
  const saveShiftLog   = (item) => {
    const logs = getShiftLogs().filter(l => l.id !== item.id);
    logs.unshift(item);
    setShiftLogs(logs);
    return item;
  };
  // (2026-07-13) Delete single shift log by id; was no delete function
  const deleteShiftLog = (id) => {
    const logs = getShiftLogs().filter(l => l.id !== id);
    setShiftLogs(logs);
  };
  // (2026-07-13) Store daily starting and ending balances; was transient shift
  const getDayBalances = () => read(KEYS.dayBalances, {});
  const setDayBalances = (v) => write(KEYS.dayBalances, v || {});
  const getSyncMeta    = () => read(KEYS.syncMeta, { lastSynced:null, status:"idle" });
  const setSyncMeta    = (v) => write(KEYS.syncMeta, v);
  // (2026-07-13) Baseline snapshot accessors for 3-way merge; was none
  const getSyncBaseline = () => read(KEYS.syncBaseline, null);
  const setSyncBaseline = (v) => write(KEYS.syncBaseline, v);
  // (2026-07-13) Add current cart persistence methods; was in-memory only
  const getSavedCart   = () => read(KEYS.currentCart, { cart: [], discount: { type:"percent", value:0 } });
  const saveCart       = (v) => write(KEYS.currentCart, v);
  // (2026-07-13) Add operating expenses and venue bookings DB stores; was none
  const getExpenses    = () => read(KEYS.expenses, []);
  const setExpenses    = (v) => write(KEYS.expenses, v);
  function addExpense(e){
    const items = getExpenses();
    // (2026-07-13) Use local date formatting; was toISOString previous-day split
    const item = {
      id: e.id || Utils.uid("exp"),
      date: e.date || new Date().toLocaleDateString("en-CA"),
      ts: e.ts || Date.now(),
      category: e.category || "Other",
      description: e.description || "",
      amount: Number(e.amount || 0),
      method: e.method || "Cash",
      recipient: e.recipient || "",
      refNo: e.refNo || "",
      loggedBy: e.loggedBy || Auth.currentUser()?.name || "Admin"
    };
    items.unshift(item);
    setExpenses(items);
    
    // Immediate realtime sync
    if(typeof RealtimeSync !== "undefined" && RealtimeSync.syncExpense){
      RealtimeSync.syncExpense(item);
    }
    
    return item;
  }
  function deleteExpense(id){
    setExpenses(getExpenses().filter(x => x.id !== id));
    
    // Immediate realtime sync
    if(typeof RealtimeSync !== "undefined" && RealtimeSync.deleteExpenseFromCloud){
      RealtimeSync.deleteExpenseFromCloud(id);
    }
  }

  const getBookings    = () => read(KEYS.bookings, []);
  const setBookings    = (v) => write(KEYS.bookings, v);
  function addBooking(b){
    const items = getBookings();
    // (2026-07-13) Use local date formatting; was toISOString previous-day split
    const item = {
      id: b.id || Utils.uid("bk"),
      clientName: b.clientName || "Customer",
      phone: b.phone || "",
      eventType: b.eventType || "Celebration / Event",
      date: b.date || new Date().toLocaleDateString("en-CA"),
      startTime: b.startTime || "08:00",
      endTime: b.endTime || "12:00",
      fee: Number(b.fee || 0),
      paid: Number(b.paid || 0),
      balance: Math.max(0, Number(b.fee || 0) - Number(b.paid || 0)),
      status: b.status || "Confirmed",
      method: b.method || "Cash",
      refNo: b.refNo || "",
      notes: b.notes || "",
      createdAt: b.createdAt || Date.now(),
      createdBy: b.createdBy || Auth.currentUser()?.name || "Cashier"
    };
    items.unshift(item);
    setBookings(items);
    return item;
  }
  function updateBooking(id, patch){
    const items = getBookings().map(b => {
      if(b.id !== id) return b;
      const updated = { ...b, ...patch };
      if(updated.fee !== undefined || updated.paid !== undefined){
        updated.balance = Math.max(0, Number(updated.fee || 0) - Number(updated.paid || 0));
      }
      return updated;
    });
    setBookings(items);
  }
  function deleteBooking(id){
    setBookings(getBookings().filter(b => b.id !== id));
  }

  // (2026-07-13) Add restaurant dining reservations CRUD; was venue bookings only
  function getRestaurantBookings(){ return read(KEYS.restaurantBookings, []); }
  function setRestaurantBookings(list){ return write(KEYS.restaurantBookings, list); }
  function addRestaurantBooking(b){
    const items = getRestaurantBookings();
    const item = {
      id: Utils.uid("tbl_bk"),
      guestName: b.guestName || "Walk-in Guest",
      phone: b.phone || "",
      pax: Number(b.pax) || 2,
      tableName: b.tableName || "Table 1",
      diningArea: b.diningArea || "Main Dining Hall",
      date: b.date || new Date().toISOString().split("T")[0],
      startTime: b.startTime || "12:00",
      endTime: b.endTime || "14:00",
      deposit: Number(b.deposit) || 0,
      minSpend: Number(b.minSpend) || 0,
      status: b.status || "Confirmed",
      method: b.method || "Cash",
      refNo: b.refNo || "",
      specialRequests: b.specialRequests || "",
      createdAt: b.createdAt || Date.now(),
      createdBy: b.createdBy || Auth.currentUser()?.name || "Admin"
    };
    items.unshift(item);
    setRestaurantBookings(items);
    return item;
  }
  function updateRestaurantBooking(id, patch){
    const items = getRestaurantBookings().map(b => {
      if(b.id !== id) return b;
      return { ...b, ...patch };
    });
    setRestaurantBookings(items);
  }
  function deleteRestaurantBooking(id){
    setRestaurantBookings(getRestaurantBookings().filter(b => b.id !== id));
  }

  // (2026-07-13) Add bulk fuel truck delivery tracking; was not present
  function getFuelDeliveries(){ return read(KEYS.fuelDeliveries, []); }
  function setFuelDeliveries(list){ return write(KEYS.fuelDeliveries, list); }
  function addFuelDelivery(d){
    const items = getFuelDeliveries();
    // (2026-07-13) Use local date formatting; was toISOString previous-day split
    const item = {
      id: Utils.uid("deliv"),
      date: d.date || new Date().toLocaleDateString("en-CA"),
      ts: Date.now(),
      truckCapacity: Number(d.truckCapacity) || 4000,
      supplierPricePerL: Number(d.supplierPricePerL) || 65.00,
      fuelType: d.fuelType || "gasoline",
      litersOffloaded: Number(d.litersOffloaded) || 0,
      totalCost: Number(d.totalCost) || (Number(d.litersOffloaded || 0) * Number(d.supplierPricePerL || 65.00)),
      supplierName: d.supplierName || "Bulk Fuel Supplier",
      invoiceRef: d.invoiceRef || "",
      loggedBy: d.loggedBy || Auth.currentUser()?.name || "Admin"
    };
    items.unshift(item);
    setFuelDeliveries(items);
    return item;
  }

  // ---------- product helpers ----------
  // (2026-07-13) Set updatedAt & record tombstone on product edits; was untracked
  function addProduct(p){
    const products = getProducts();
    const now = Date.now();
    const newProduct = { id: Utils.uid("prod"), createdAt: now, updatedAt: now, ...p };
    products.push(newProduct);
    setProducts(products);
    
    // Immediate realtime sync
    if(typeof RealtimeSync !== "undefined" && RealtimeSync.syncSingleProduct){
      RealtimeSync.syncSingleProduct(newProduct);
    }
  }
  function updateProduct(id, patch){
    const products = getProducts();
    const oldProduct = products.find(p => p.id === id);
    if(!oldProduct) return;
    
    // Check if stock is changing
    const hasStockChange = patch.stock !== undefined && patch.stock !== oldProduct.stock;
    const oldStock = oldProduct.stock || 0;
    const newStock = patch.stock !== undefined ? patch.stock : oldStock;
    const stockDelta = newStock - oldStock;
    
    // Update product
    const updatedProducts = products.map(p => 
      p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p
    );
    setProducts(updatedProducts);
    
    // If stock changed, log it
    if(hasStockChange && stockDelta !== 0){
      console.log(`[DB] 📊 Stock changed: ${oldProduct.name} from ${oldStock} to ${newStock} (${stockDelta > 0 ? '+' : ''}${stockDelta})`);
      
      const qty = Math.abs(stockDelta);
      const unitCost = oldProduct.cost || 0;
      const totalCost = stockDelta > 0 ? qty * unitCost : -(qty * unitCost);
      
      addRestockLog({
        product_id: id,
        product_name: oldProduct.name,
        quantity_added: stockDelta,
        unit_cost: unitCost,
        total_cost: totalCost,
        supplier_name: stockDelta > 0 ? (oldProduct.distributor || oldProduct.brand || "Direct Supplier") : "N/A",
        reason: stockDelta > 0 ? "Stock Updated" : "Stock Reduced",
        oldStock: oldStock,
        newStock: newStock,
        timestamp: Date.now()
      });
    }
    
    // Immediate realtime sync
    const updatedProduct = updatedProducts.find(p => p.id === id);
    if(updatedProduct && typeof RealtimeSync !== "undefined" && RealtimeSync.syncSingleProduct){
      console.log('[DB] 🚀 Syncing product update to Firebase...');
      RealtimeSync.syncSingleProduct(updatedProduct);
    }
  }
  function deleteProduct(id){
    if(id) markProductDeleted(id);
    setProducts(getProducts().filter(p => p.id !== id));
    
    // Immediate realtime sync
    if(typeof RealtimeSync !== "undefined" && RealtimeSync.deleteProductFromCloud){
      RealtimeSync.deleteProductFromCloud(id);
    }
  }
  // (2026-07-13) Support pack & piece barcodes; was single barcode match
  function findByBarcode(code){
    if(!code) return null;
    const clean = String(code).trim();
    return getProducts().find(p => p.barcode === clean || (p.piecesPerPack > 1 && p.packBarcode === clean));
  }
  function adjustStock(id, delta, reason = "Adjustment", supplier = ""){
    const products = getProducts();
    const p = products.find(x => x.id === id);
    if(!p) return;
    const oldStock = p.stock;
    p.stock = Math.max(0, Utils.round2(p.stock + delta));
    const newStock = p.stock;
    p.updatedAt = Date.now();
    setProducts(products);
    
    console.log(`[DB] 📊 Stock adjusted: ${p.name} from ${oldStock} to ${newStock} (${delta > 0 ? '+' : ''}${delta}) - Reason: ${reason}`);
    
    // (2026-08-26) Log ALL stock changes including negatives to track theft/damage; was positive only
    const log = getStockLog();
    log.unshift({ id: Utils.uid("log"), productId:id, productName:p.name, delta, reason, ts: Date.now() });
    setStockLog(log.slice(0,500));
    
    // Enhanced restock logging with negative quantity support
    if(delta !== 0){
      const qty = Math.abs(delta);
      const unitCost = p.cost || 0;
      const totalCost = delta > 0 ? qty * unitCost : -(qty * unitCost);
      
      addRestockLog({
        product_id: p.id,
        product_name: p.name,
        quantity_added: delta, // Can be negative for theft/damage
        unit_cost: unitCost,
        total_cost: totalCost,
        supplier_name: delta > 0 ? (supplier || p.distributor || p.brand || "Direct Supplier") : "N/A",
        reason: reason,
        oldStock: oldStock,
        newStock: newStock,
        timestamp: Date.now()
      });
      
      // Also sync the updated product
      if(typeof RealtimeSync !== "undefined" && RealtimeSync.syncSingleProduct){
        console.log('[DB] 🚀 Syncing stock adjustment to Firebase...');
        RealtimeSync.syncSingleProduct(p);
      }
    }
  }

  // (2026-07-13) Save custom items for autofill & stock; was unsaved
  function getCustomItems(){
    let items = read(KEYS.customItems, null);
    if(items === null){
      items = [];
      const sales = read(KEYS.sales, []);
      const seen = new Set();
      sales.forEach(s => {
        (s.items || []).forEach(it => {
          if(it.isCustom && it.name && it.name.trim().toLowerCase() !== "custom item" && !seen.has(it.name.trim().toLowerCase())){
            seen.add(it.name.trim().toLowerCase());
            items.push({ id: Utils.uid("cust"), name: it.name.trim(), price: it.price || 0, unit: it.unit || "pc" });
          }
        });
      });
      write(KEYS.customItems, items);
    }
    return items;
  }
  const setCustomItems = (v) => write(KEYS.customItems, v || []);
  function saveCustomItem(item){
    if(!item || !item.name) return null;
    const cleanName = item.name.trim();
    if(!cleanName || cleanName.toLowerCase() === "custom item") return null;
    const items = getCustomItems();
    const existingIdx = items.findIndex(x => x.name.toLowerCase() === cleanName.toLowerCase());
    const data = {
      name: cleanName,
      price: typeof item.price === "number" ? item.price : Number(item.price) || 0,
      unit: item.unit || "pc",
      updatedAt: Date.now()
    };
    if(existingIdx >= 0){
      items[existingIdx] = { ...items[existingIdx], ...data };
    } else {
      items.push({ id: Utils.uid("cust"), ...data });
    }
    setCustomItems(items);

    const prods = getProducts();
    let prod = prods.find(p => p.name.trim().toLowerCase() === cleanName.toLowerCase());
    if(!prod){
      prod = {
        id: Utils.uid("prod"),
        name: cleanName,
        price: data.price,
        cost: 0,
        stock: 0,
        category: "Custom",
        unit: data.unit,
        unitType: "piece",
        piecesPerPack: 1,
        barcode: item.barcode || "",
        isCustom: true,
        createdAt: Date.now()
      };
      prods.push(prod);
      setProducts(prods);
    } else {
      let updated = false;
      if(data.price > 0 && prod.isCustom && prod.price !== data.price){
        prod.price = data.price;
        updated = true;
      }
      if(!prod.isCustom){
        prod.isCustom = true;
        updated = true;
      }
      if(updated) setProducts(prods);
    }
    return prod;
  }

  function getBackups(){ return read(KEYS.backups, []); }
  function setBackups(b){ return write(KEYS.backups, b); }

  // (2026-07-13) Fix recursive backup nesting & add buildSnapshotAt; was bloat
  function saveBackup(rec){
    if(rec && rec.data && rec.data.backups){
      delete rec.data.backups;
    }
    const list = getBackups().filter(x => x.id !== rec.id);
    list.unshift(rec);
    return setBackups(list);
  }
  function deleteBackup(id){
    const list = getBackups().filter(x => x.id !== id);
    return setBackups(list);
  }

  function populateHistoricalBackups(){
    const currentBackups = getBackups();
    const allSales = getSales();
    if(!allSales || !allSales.length) return;
    const salesByDay = new Map();
    allSales.forEach(s => {
      const d = new Date(s.ts).toLocaleDateString("en-CA");
      if(!salesByDay.has(d)) salesByDay.set(d, []);
      salesByDay.get(d).push(s);
    });
    const sortedDays = Array.from(salesByDay.keys()).sort();
    const existingDates = new Set(currentBackups.map(b => new Date(b.createdAt || 0).toLocaleDateString("en-CA")));
    let addedAny = false;
    let cumulativeCount = 0;
    sortedDays.forEach(dayStr => {
      const daySales = salesByDay.get(dayStr);
      cumulativeCount += daySales.length;
      if(!existingDates.has(dayStr)){
        const [y, m, d] = dayStr.split("-");
        const eodDate = new Date(Number(y), Number(m)-1, Number(d), 23, 59, 0, 0);
        const dateStr = eodDate.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) + " 11:59 PM";
        const bId = "backup_" + y + "-" + m + "-" + d + "_235900";
        currentBackups.push({
          id: bId,
          createdAt: eodDate.getTime(),
          dateStr,
          exportType: "automatic_1159",
          summary: {
            products: getProducts().length,
            sales: cumulativeCount,
            expenses: 0,
            fuelSales: 0
          }
        });
        existingDates.add(dayStr);
        addedAny = true;
      }
    });
    if(addedAny){
      currentBackups.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setBackups(currentBackups);
    }
  }

  function buildSnapshotAt(timestamp){
    const prods = getProducts();
    const pastSales = getSales().filter(s => (s.ts || 0) <= timestamp);
    return {
      products: prods,
      categories: getCategories(),
      sales: pastSales,
      fuelSales: getFuelSales().filter(s => (s.ts || 0) <= timestamp),
      fuelConfig: getFuelConfig(),
      fuelDeliveries: getFuelDeliveries(),
      settings: getSettings(),
      users: getUsers(),
      cashiers: getCashiers(),
      heldSales: [],
      venueLeads: getVenueLeads(),
      bookings: getBookings(),
      restaurantBookings: getRestaurantBookings(),
      expenses: getExpenses().filter(e => (e.ts || 0) <= timestamp),
      stockLog: getStockLog(),
      restockLogs: getRestockLogs(),
      physicalAudits: getPhysicalAudits(),
      voidLogs: getVoidLogs(),
      shift: getShift(),
      backups: [],
      exportedAt: timestamp,
      version: 3
    };
  }

  // (2026-07-13) Manage physical count audits & snapshots; was missing audits
  function getPhysicalAudits(){ return read(KEYS.physicalAudits, []); }
  function setPhysicalAudits(list){ return write(KEYS.physicalAudits, list); }
  function savePhysicalAudit(audit){
    const list = getPhysicalAudits();
    list.unshift(audit);
    return setPhysicalAudits(list.slice(0, 100));
  }

  // ---------- full snapshot (for export + firestore sync) ----------
  // (2026-07-13) Include deletedSaleIds & customItems in snapshot. Prev: omitted
  function snapshot(){
    return {
      products:getProducts(), categories:getCategories(), sales:getSales(), fuelSales:getFuelSales(),
      fuelConfig:getFuelConfig(), fuelDeliveries:getFuelDeliveries(), settings:getSettings(), users:getUsers(),
      heldSales:getHeldSales(), venueLeads:getVenueLeads(), bookings:getBookings(),
      restaurantBookings:getRestaurantBookings(), expenses:getExpenses(),
      stockLog:getStockLog(), restockLogs:getRestockLogs(), physicalAudits:getPhysicalAudits(),
      // (2026-07-13) Include shiftLogs and raw shift in snapshot; was omitted
      dayBalances:getDayBalances(), backups:[], voidLogs:getVoidLogs(), shift:read(KEYS.shift, null), shiftLogs:getShiftLogs(), cashiers:getCashiers(),
      customItems: getCustomItems ? getCustomItems() : [],
      deletedSaleIds: Array.from(getDeletedSaleIds ? getDeletedSaleIds() : []),
      // (2026-07-13) Include deletedProductIds in DB snapshot; was omitted
      deletedProductIds: Array.from(getDeletedProductIds ? getDeletedProductIds() : []),
      exportedAt: Date.now(), version:3
    };
  }
  // (2026-07-13) Timestamp merge products & sync deletedSaleIds. Prev: resurrect
  function restoreSnapshot(snap){
    if(!snap) return;
    isSyncRestoring = true;
    try{
    if(snap.deletedProductIds && Array.isArray(snap.deletedProductIds)){
      const curDeletedProds = getDeletedProductIds();
      snap.deletedProductIds.forEach(id => { if(id) curDeletedProds.add(String(id)); });
      write(KEYS.deletedProductIds, Array.from(curDeletedProds), true);
    }
    if(snap.deletedSaleIds && Array.isArray(snap.deletedSaleIds)){
      const curDeleted = getDeletedSaleIds();
      snap.deletedSaleIds.forEach(id => { if(id) curDeleted.add(String(id)); });
      write(KEYS.deletedSaleIds, Array.from(curDeleted), true);
    }
    if(snap.products && snap.products.length){
      // (2026-07-13) Preserve local offline stock in restore; was overwrite
      const localProds = getProducts();
      if(!localProds.length){
        setProducts(snap.products);
      } else {
        const prodMap = new Map();
        localProds.forEach(p => prodMap.set(p.id, p));
        snap.products.forEach(remoteP => {
          if(!prodMap.has(remoteP.id)){
            prodMap.set(remoteP.id, remoteP);
          } else {
            const curP = prodMap.get(remoteP.id);
            if((remoteP.updatedAt || 0) >= (curP.updatedAt || 0)){
              prodMap.set(remoteP.id, { ...curP, ...remoteP });
            }
          }
        });
        setProducts(Array.from(prodMap.values()));
      }
    }
    if(snap.categories && snap.categories.length) setCategories(snap.categories);
    if(snap.sales && snap.sales.length){
      const existing = getSales();
      const deletedIds = getDeletedSaleIds();
      const sMap = new Map();
      existing.forEach(s => {
        const k = String(s.receiptNo || s.id || '').trim();
        const sId = String(s.id || '').trim();
        if(k && !deletedIds.has(sId) && !deletedIds.has(sId.toLowerCase()) && !deletedIds.has(k) && !deletedIds.has(k.toLowerCase())){
          sMap.set(k, s);
        }
      });
      // (2026-07-13) Filter out deleted sales in snapshot merge; was reviving deleted
      snap.sales.forEach(s => { 
        const k = String(s.receiptNo || s.id || "").trim(); 
        const sId = String(s.id || "").trim();
        const rId = String(s.receiptNo || "").trim();
        const clean = sId.replace(/^TXN-/i, "");
        const isDeleted = deletedIds.has(sId) || deletedIds.has(sId.toLowerCase()) ||
                          deletedIds.has(rId) || deletedIds.has(rId.toLowerCase()) ||
                          deletedIds.has(clean) || deletedIds.has(clean.toLowerCase());
        if(k && !isDeleted){
          const curS = sMap.get(k);
          if(!curS || (s.ts || 0) >= (curS.ts || 0)){
            sMap.set(k, s);
          }
        }
      });
      const merged = Array.from(sMap.values()).sort((a, b) => (b.ts || 0) - (a.ts || 0));
      setSales(merged);
    }
    if(snap.fuelSales) setFuelSales(snap.fuelSales);
    if(snap.fuelConfig){
      const curCfg = getFuelConfig();
      if(!curCfg){
        setFuelConfig(snap.fuelConfig);
      } else {
        const mergedCfg = { ...curCfg, ...snap.fuelConfig };
        mergedCfg.fuels = { ...(curCfg.fuels || {}) };
        if(snap.fuelConfig.fuels){
          Object.keys(snap.fuelConfig.fuels).forEach(ft => {
            const curFuel = mergedCfg.fuels[ft] || {};
            const remoteFuel = snap.fuelConfig.fuels[ft] || {};
            // (2026-07-13) Preserve tank delivery via recency; was Math.min erasing restock
            const remUpdated = remoteFuel.updatedAt || 0;
            const curUpdated = curFuel.updatedAt || 0;
            mergedCfg.fuels[ft] = {
              ...curFuel,
              ...remoteFuel,
              tank: remUpdated > curUpdated ? (remoteFuel.tank ?? curFuel.tank) : (curFuel.tank ?? remoteFuel.tank)
            };
          });
        }
        setFuelConfig(mergedCfg);
      }
    }
    if(snap.fuelDeliveries) setFuelDeliveries(snap.fuelDeliveries);
    if(snap.settings) setSettings({ ...DEFAULT_SETTINGS, ...snap.settings });
    if(snap.users) setUsers(snap.users);
    if(snap.cashiers) setCashiers(snap.cashiers);
    if(snap.heldSales) setHeldSales(snap.heldSales);
    if(snap.venueLeads) setVenueLeads(snap.venueLeads);
    if(snap.bookings) setBookings(snap.bookings);
    if(snap.restaurantBookings) setRestaurantBookings(snap.restaurantBookings);
    if(snap.expenses) setExpenses(snap.expenses);
    if(snap.stockLog) setStockLog(snap.stockLog);
    if(snap.restockLogs) setRestockLogs(snap.restockLogs);
    if(snap.physicalAudits) setPhysicalAudits(snap.physicalAudits);
    if(snap.customItems && setCustomItems) setCustomItems(snap.customItems);
    if(snap.backups) setBackups(snap.backups);
    // (2026-07-13) Safely merge voidLogs; was overwriting array
    if(snap.voidLogs && Array.isArray(snap.voidLogs)){
      const localVoids = getVoidLogs();
      const vMap = new Map();
      localVoids.forEach(v => { if(v && v.id) vMap.set(String(v.id), v); });
      snap.voidLogs.forEach(v => { if(v && v.id && !vMap.has(String(v.id))) vMap.set(String(v.id), v); });
      setVoidLogs(Array.from(vMap.values()).sort((a,b)=>(b.ts||0)-(a.ts||0)));
    }
    // (2026-07-13) Safely merge shift and shiftLogs without wipe; was overwrite
    if(snap.shift){
      const curShift = read(KEYS.shift, null);
      if(!curShift || (snap.shift.updatedAt || snap.shift.closedAt || snap.shift.openedAt || 0) >= (curShift.updatedAt || curShift.closedAt || curShift.openedAt || 0)){
        setShift(snap.shift);
      }
    }
    if(snap.shiftLogs && Array.isArray(snap.shiftLogs)){
      const localLogs = getShiftLogs();
      const logMap = new Map();
      localLogs.forEach(l => { if(l?.id) logMap.set(String(l.id), l); });
      snap.shiftLogs.forEach(l => { if(l?.id && !logMap.has(String(l.id))) logMap.set(String(l.id), l); });
      setShiftLogs(Array.from(logMap.values()).sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0)));
    }
    // (2026-07-13) Restore dayBalances from snapshot; was omitted
    if(snap.dayBalances) setDayBalances(snap.dayBalances);
    } finally {
      isSyncRestoring = false;
    }
  }
  function wipeAll(){
    memCache.clear();
    cachedProcessedSales = null;
    cachedProducts = null;
    cachedCategories = null;
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    init();
  }

  return {
    KEYS, init, categoryIcon, getNextTransactionId,
    getProducts, setProducts, deduplicateProducts, addProduct, updateProduct, deleteProduct, findByBarcode, adjustStock,
    getCategories, setCategories,
    // (2026-07-13) Expose unmarkSaleDeleted & product tombstone APIs; was missing
    getSales, setSales, getDeletedSaleIds, markSaleDeleted, unmarkSaleDeleted, getDeletedProductIds, markProductDeleted, getFuelSales, setFuelSales,
    getFuelConfig, setFuelConfig,
    getSettings, setSettings,
    getUsers, setUsers,
    getCashiers, setCashiers,
    getHeldSales, setHeldSales,
    getVenueLeads, setVenueLeads,
    getStockLog, setStockLog,
    getRestockLogs, setRestockLogs, addRestockLog, updateRestockLog, deleteRestockLog,
    getPhysicalAudits, setPhysicalAudits, savePhysicalAudit,
    getVoidLogs, setVoidLogs, addVoidLog,
    getOfflineQueue, setOfflineQueue, queueOfflineTransaction,
    getExpenses, setExpenses, addExpense, deleteExpense,
    getBookings, setBookings, addBooking, updateBooking, deleteBooking,
    getRestaurantBookings, setRestaurantBookings, addRestaurantBooking, updateRestaurantBooking, deleteRestaurantBooking,
    getFuelDeliveries, setFuelDeliveries, addFuelDelivery,
    getBackups, setBackups, saveBackup, deleteBackup, buildSnapshotAt, populateHistoricalBackups,
    getShift, setShift, getShiftLogs, setShiftLogs, saveShiftLog, deleteShiftLog,
    getDayBalances, setDayBalances,
    getSyncMeta, setSyncMeta,
    // (2026-07-13) Export sync baseline methods; was omitted from return
    getSyncBaseline, setSyncBaseline,
    getSavedCart, saveCart,
    getCustomItems, setCustomItems, saveCustomItem,
    snapshot, restoreSnapshot, wipeAll
  };
})();
