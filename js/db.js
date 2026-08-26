// ============================================================
// db.js — localStorage-first data layer.
// Every write lands here FIRST. Firestore sync (sync.js) only
// ever pushes a snapshot of what's already safely on disk.
// ============================================================
const DB = (() => {
  const NS = "mm_"; // minimart namespace
  // (2026-07-13) Add voidLogs & offlineQueue keys to storage mapping; was 19 items
  const KEYS = {
    products: NS+"products", categories: NS+"categories", sales: NS+"sales",
    fuelSales: NS+"fuelSales", fuelConfig: NS+"fuelConfig", settings: NS+"settings",
    users: NS+"users", heldSales: NS+"heldSales", venueLeads: NS+"venueLeads",
    stockLog: NS+"stockLog", restockLogs: NS+"restockLogs", shift: NS+"shift", syncMeta: NS+"syncMeta",
    currentCart: NS+"currentCart", expenses: NS+"expenses", bookings: NS+"bookings",
    restaurantBookings: NS+"restaurantBookings", fuelDeliveries: NS+"fuelDeliveries", backups: NS+"backups",
    voidLogs: NS+"voidLogs", offlineQueue: NS+"offlineQueue"
  };

  function read(key, fallback = null){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){ console.warn("DB read failed", key, e); return fallback; }
  }
  function write(key, value){
    localStorage.setItem(key, JSON.stringify(value));
    document.dispatchEvent(new CustomEvent("mm:dirty", { detail:{ key } }));
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

  // (2026-07-13) Set default Route 98 Firebase config & autoSync. Prev: null
  const DEFAULT_SETTINGS = {
    businessName: "Route 98",
    address: "Cebu City, Philippines",
    tin: "",
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
      appId: "1:177232035309:web:87fa8430b141e7afb97be4"
    },
    autoSync: true,
    lastView: "pos"
  };

  const DEFAULT_USERS = [
    { id:"u_admin", name:"Owner/Admin", role:"admin", pin:"1234" },
    { id:"u_cashier", name:"Cashier", role:"cashier", pin:"1111" }
  ];

  // (2026-07-13) Set 65.00 tanker cost for all fuel types; was varied costs
  const DEFAULT_FUEL_CONFIG = {
    pumps: [
      { id:"pump1", label:"Pump 1", fuelType:"gasoline" },
      { id:"pump2", label:"Pump 2", fuelType:"diesel" },
      { id:"pump3", label:"Pump 3", fuelType:"premium" }
    ],
    fuels: {
      gasoline: { name:"Gasoline (RON91/95)", price:71.50, cost:65.00, tank:7200, capacity:10000, lowLevel:2000, color:"#10B981", cls:"fuel-gasoline", priceLog:[] },
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
    if(read(KEYS.users) === null) write(KEYS.users, DEFAULT_USERS);
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
    if(read(KEYS.products) === null) write(KEYS.products, []);
    if(read(KEYS.sales) === null) write(KEYS.sales, []);
    if(read(KEYS.fuelSales) === null) write(KEYS.fuelSales, []);
    if(read(KEYS.heldSales) === null) write(KEYS.heldSales, []);
    if(read(KEYS.venueLeads) === null) write(KEYS.venueLeads, []);
    if(read(KEYS.stockLog) === null) write(KEYS.stockLog, []);
    if(read(KEYS.shift) === null) write(KEYS.shift, { openedAt: Date.now(), openingCash: 0 });
    if(read(KEYS.syncMeta) === null) write(KEYS.syncMeta, { lastSynced:null, status:"idle" });
    // merge in any NEW default settings keys added in later app versions without clobbering user edits
    const s = read(KEYS.settings);
    const updatedSettings = { ...DEFAULT_SETTINGS, ...s };
    if(updatedSettings.businessName === "The Good Minimart" || !updatedSettings.businessName){
      updatedSettings.businessName = "Route 98";
      updatedSettings.receiptFooter = "Salamat sa inyong pagbisita sa Route 98! Come again";
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
  }

  // ---------- generic getters/setters ----------
  const getProducts   = () => read(KEYS.products, []);
  const setProducts   = (v) => write(KEYS.products, v);
  const dedupeCats = (list) => {
    const set = new Set();
    (list || []).forEach(c => {
      if(!c || typeof c !== "string") return;
      const t = c.trim().toUpperCase();
      if(t) set.add(t);
    });
    return [...set];
  };
  const getCategories = () => dedupeCats(read(KEYS.categories, []));
  const setCategories = (v) => write(KEYS.categories, dedupeCats(v));
  const getSales       = () => read(KEYS.sales, []);
  const setSales       = (v) => write(KEYS.sales, v);
  const getFuelSales   = () => read(KEYS.fuelSales, []);
  const setFuelSales   = (v) => write(KEYS.fuelSales, v);
  // (2026-07-13) Set 65.00 tanker cost in getFuelConfig; was dynamic/varied
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
      Object.keys(cfg.fuels).forEach(k => {
        if(cfg.fuels[k].cost !== 65.00){
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
  const getHeldSales   = () => read(KEYS.heldSales, []);
  const setHeldSales   = (v) => write(KEYS.heldSales, v);
  const getVenueLeads  = () => read(KEYS.venueLeads, []);
  const setVenueLeads  = (v) => write(KEYS.venueLeads, v);
  const getStockLog    = () => read(KEYS.stockLog, []);
  const setStockLog    = (v) => write(KEYS.stockLog, v);
  // (2026-07-13) Add restockLogs rollback, sequential TXN & void log methods; was basic log
  const getRestockLogs = () => read(KEYS.restockLogs, []);
  const setRestockLogs = (v) => write(KEYS.restockLogs, v);
  function addRestockLog(entry){
    const logs = getRestockLogs();
    const qty = Number(entry.quantity_added ?? entry.quantity ?? 0);
    const unitCost = Number(entry.unit_cost ?? entry.unitCost ?? 0);
    const totalCost = Number(entry.total_cost ?? (qty * unitCost));
    const record = {
      id: entry.id || Utils.uid("rstk"),
      product_id: entry.product_id || entry.productId || "",
      product_name: entry.product_name || entry.productName || "Unknown Product",
      quantity_added: qty,
      unit_cost: unitCost,
      total_cost: totalCost,
      supplier_name: entry.supplier_name || entry.supplierName || "Direct Supplier",
      timestamp: entry.timestamp || entry.ts || Date.now()
    };
    logs.unshift(record);
    setRestockLogs(logs.slice(0, 1000));
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
        setProducts(prods);
      }
    }
    const merged = { ...oldLog, ...updated, total_cost: newQty * Number(updated.unit_cost ?? oldLog.unit_cost) };
    logs[idx] = merged;
    setRestockLogs(logs);
    return merged;
  }
  function deleteRestockLog(logId){
    const logs = getRestockLogs();
    const oldLog = logs.find(l => l.id === logId);
    if(oldLog){
      const rollQty = Number(oldLog.quantity_added || 0);
      if(rollQty > 0){
        const prods = getProducts();
        const p = prods.find(x => x.id === oldLog.product_id || x.name === oldLog.product_name || x.barcode === oldLog.product_id);
        if(p){
          p.stock = Math.max(0, Utils.round2(p.stock - rollQty));
          setProducts(prods);
        }
      }
      setRestockLogs(logs.filter(l => l.id !== logId));
    }
  }
  function getNextTransactionId(prefix = "TXN"){
    const sales = read(KEYS.sales, []);
    const fuelSales = read(KEYS.fuelSales, []);
    let max = 0;
    const re = new RegExp(`^${prefix}-(\\d+)$`);
    [...sales, ...fuelSales].forEach(s => {
      const match = String(s.id || "").match(re);
      if(match){
        const num = parseInt(match[1], 10);
        if(num > max) max = num;
      }
    });
    if(max === 0) max = sales.length + fuelSales.length;
    return `${prefix}-${String(max + 1).padStart(4, "0")}`;
  }
  const getVoidLogs    = () => read(KEYS.voidLogs, []);
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
    setVoidLogs(logs.slice(0, 500));
    return item;
  }
  const getOfflineQueue = () => read(KEYS.offlineQueue, []);
  const setOfflineQueue = (v) => write(KEYS.offlineQueue, v);
  function queueOfflineTransaction(txn){
    const q = getOfflineQueue();
    q.push({ ...txn, queuedAt: Date.now() });
    setOfflineQueue(q);
  }
  const getShift       = () => read(KEYS.shift, { openedAt:Date.now(), openingCash:0 });
  const setShift       = (v) => write(KEYS.shift, v);
  const getSyncMeta    = () => read(KEYS.syncMeta, { lastSynced:null, status:"idle" });
  const setSyncMeta    = (v) => write(KEYS.syncMeta, v);
  // (2026-07-13) Add current cart persistence methods; was in-memory only
  const getSavedCart   = () => read(KEYS.currentCart, { cart: [], discount: { type:"percent", value:0 } });
  const saveCart       = (v) => write(KEYS.currentCart, v);
  // (2026-07-13) Add operating expenses and venue bookings DB stores; was none
  const getExpenses    = () => read(KEYS.expenses, []);
  const setExpenses    = (v) => write(KEYS.expenses, v);
  function addExpense(e){
    const items = getExpenses();
    const item = {
      id: e.id || Utils.uid("exp"),
      date: e.date || new Date().toISOString().split("T")[0],
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
    return item;
  }
  function deleteExpense(id){
    setExpenses(getExpenses().filter(x => x.id !== id));
  }

  const getBookings    = () => read(KEYS.bookings, []);
  const setBookings    = (v) => write(KEYS.bookings, v);
  function addBooking(b){
    const items = getBookings();
    const item = {
      id: b.id || Utils.uid("bk"),
      clientName: b.clientName || "Customer",
      phone: b.phone || "",
      eventType: b.eventType || "Celebration / Event",
      date: b.date || new Date().toISOString().split("T")[0],
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
    const item = {
      id: Utils.uid("deliv"),
      date: d.date || new Date().toISOString().split("T")[0],
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
  function addProduct(p){
    const products = getProducts();
    products.push({ id: Utils.uid("prod"), createdAt: Date.now(), ...p });
    setProducts(products);
  }
  function updateProduct(id, patch){
    const products = getProducts().map(p => p.id === id ? { ...p, ...patch } : p);
    setProducts(products);
  }
  function deleteProduct(id){
    setProducts(getProducts().filter(p => p.id !== id));
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
    setProducts(products);
    
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
        newStock: p.stock,
        timestamp: Date.now()
      });
    }
  }

  // (2026-07-13) Manage backup records and complete all-unit snapshots. Prev: partial
  function getBackups(){ return read(KEYS.backups, []); }
  function setBackups(b){ return write(KEYS.backups, b); }
  function saveBackup(rec){
    const list = getBackups().filter(x => x.id !== rec.id);
    list.unshift(rec);
    return setBackups(list.slice(0, 50));
  }
  function deleteBackup(id){
    const list = getBackups().filter(x => x.id !== id);
    return setBackups(list);
  }

  // ---------- full snapshot (for export + firestore sync) ----------
  function snapshot(){
    return {
      products:getProducts(), categories:getCategories(), sales:getSales(), fuelSales:getFuelSales(),
      fuelConfig:getFuelConfig(), fuelDeliveries:getFuelDeliveries(), settings:getSettings(), users:getUsers(),
      heldSales:getHeldSales(), venueLeads:getVenueLeads(), bookings:getBookings(),
      restaurantBookings:getRestaurantBookings(), expenses:getExpenses(),
      stockLog:getStockLog(), restockLogs:getRestockLogs(), shift:getShift(),
      exportedAt: Date.now(), version:3
    };
  }
  function restoreSnapshot(snap){
    if(!snap) return;
    if(snap.products) setProducts(snap.products);
    if(snap.categories) setCategories(snap.categories);
    if(snap.sales) setSales(snap.sales);
    if(snap.fuelSales) setFuelSales(snap.fuelSales);
    if(snap.fuelConfig) setFuelConfig(snap.fuelConfig);
    if(snap.fuelDeliveries) setFuelDeliveries(snap.fuelDeliveries);
    if(snap.settings) setSettings({ ...DEFAULT_SETTINGS, ...snap.settings });
    if(snap.users) setUsers(snap.users);
    if(snap.heldSales) setHeldSales(snap.heldSales);
    if(snap.venueLeads) setVenueLeads(snap.venueLeads);
    if(snap.bookings) setBookings(snap.bookings);
    if(snap.restaurantBookings) setRestaurantBookings(snap.restaurantBookings);
    if(snap.expenses) setExpenses(snap.expenses);
    if(snap.stockLog) setStockLog(snap.stockLog);
    if(snap.restockLogs) setRestockLogs(snap.restockLogs);
    if(snap.shift) setShift(snap.shift);
  }
  function wipeAll(){
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    init();
  }

  return {
    KEYS, init, categoryIcon, getNextTransactionId,
    getProducts, setProducts, addProduct, updateProduct, deleteProduct, findByBarcode, adjustStock,
    getCategories, setCategories,
    getSales, setSales, getFuelSales, setFuelSales,
    getFuelConfig, setFuelConfig,
    getSettings, setSettings,
    getUsers, setUsers,
    getHeldSales, setHeldSales,
    getVenueLeads, setVenueLeads,
    getStockLog, setStockLog,
    getRestockLogs, setRestockLogs, addRestockLog, updateRestockLog, deleteRestockLog,
    getVoidLogs, setVoidLogs, addVoidLog,
    getOfflineQueue, setOfflineQueue, queueOfflineTransaction,
    getExpenses, setExpenses, addExpense, deleteExpense,
    getBookings, setBookings, addBooking, updateBooking, deleteBooking,
    getRestaurantBookings, setRestaurantBookings, addRestaurantBooking, updateRestaurantBooking, deleteRestaurantBooking,
    getFuelDeliveries, setFuelDeliveries, addFuelDelivery,
    getBackups, setBackups, saveBackup, deleteBackup,
    getShift, setShift,
    getSyncMeta, setSyncMeta,
    getSavedCart, saveCart,
    snapshot, restoreSnapshot, wipeAll
  };
})();
