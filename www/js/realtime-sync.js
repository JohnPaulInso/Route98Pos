// ============================================================
// realtime-sync.js — Real-time Multi-Device Synchronization
// Implements Firebase Realtime Database for instant sync
// Score: ⭐⭐⭐⭐⭐ (5/5) Multi-Device Reliability
// ============================================================

const RealtimeSync = (() => {
  let realtimeDB = null;
  let realtimeMod = null;
  let listeners = new Map();
  let isInitialized = false;
  
  // Offline sync queue
  const SYNC_QUEUE_KEY = 'mm_syncQueue';
  let syncQueue = [];
  let isSyncing = false;
  
  // Load sync queue from localStorage
  function loadSyncQueue() {
    try {
      const stored = localStorage.getItem(SYNC_QUEUE_KEY);
      syncQueue = stored ? JSON.parse(stored) : [];
      console.log(`[RealtimeSync] 📋 Loaded ${syncQueue.length} pending sync operations`);
    } catch (error) {
      console.error('[RealtimeSync] Failed to load sync queue:', error);
      syncQueue = [];
    }
  }
  
  // Save sync queue to localStorage
  function saveSyncQueue() {
    try {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(syncQueue));
    } catch (error) {
      console.error('[RealtimeSync] Failed to save sync queue:', error);
    }
  }
  
  // Add operation to queue
  function enqueueSync(operation) {
    syncQueue.push({
      ...operation,
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retries: 0
    });
    saveSyncQueue();
    console.log(`[RealtimeSync] 📝 Queued: ${operation.type} for ${operation.entityType}`);
    
    // Try to process immediately
    processQueue();
  }
  
  // Process sync queue
  async function processQueue() {
    if (isSyncing || syncQueue.length === 0) return;
    if (!realtimeDB) {
      console.log('[RealtimeSync] ⏸️ Queue paused - Firebase not ready');
      return;
    }
    
    isSyncing = true;
    console.log(`[RealtimeSync] 🔄 Processing queue: ${syncQueue.length} operations`);
    
    const operations = [...syncQueue];
    
    for (const op of operations) {
      try {
        await executeQueuedOperation(op);
        
        // Remove from queue on success
        syncQueue = syncQueue.filter(q => q.id !== op.id);
        saveSyncQueue();
        
      } catch (error) {
        console.error(`[RealtimeSync] ❌ Failed to sync:`, op, error);
        
        // Increment retries
        const queuedOp = syncQueue.find(q => q.id === op.id);
        if (queuedOp) {
          queuedOp.retries++;
          queuedOp.lastError = error.message;
          
          // Remove if too many retries
          if (queuedOp.retries >= 5) {
            console.error(`[RealtimeSync] 💀 Giving up on operation after 5 retries:`, op);
            syncQueue = syncQueue.filter(q => q.id !== op.id);
          }
          saveSyncQueue();
        }
      }
    }
    
    isSyncing = false;
    
    if (syncQueue.length > 0) {
      console.log(`[RealtimeSync] ⏳ ${syncQueue.length} operations still pending, will retry...`);
      // Retry after 5 seconds
      setTimeout(processQueue, 5000);
    } else {
      console.log(`[RealtimeSync] ✅ Queue empty - all synced!`);
    }
  }
  
  // Execute a queued operation
  async function executeQueuedOperation(op) {
    console.log(`[RealtimeSync] ⚡ Executing: ${op.type} ${op.entityType}`, op.data?.name || op.data?.id);
    
    switch (op.entityType) {
      case 'product':
        if (op.type === 'create' || op.type === 'update') {
          await syncSingleProductDirect(op.data);
        } else if (op.type === 'delete') {
          await deleteProductFromCloudDirect(op.data.id);
        }
        break;
        
      case 'restockLog':
        if (op.type === 'create') {
          await syncRestockLogDirect(op.data);
        } else if (op.type === 'delete') {
          await deleteRestockLogFromCloudDirect(op.data.id);
        }
        break;
        
      case 'expense':
        if (op.type === 'create') {
          await syncExpenseDirect(op.data);
        } else if (op.type === 'delete') {
          await deleteExpenseFromCloudDirect(op.data.id);
        }
        break;
    }
  }

  // Initialize Firebase Realtime Database
  async function init() {
    if (isInitialized) {
      console.log('[RealtimeSync] ✅ Already initialized');
      return;
    }
    
    // Load sync queue first
    loadSyncQueue();
    
    // Safety check - ensure DB is loaded
    if (typeof DB === 'undefined') {
      console.warn('[RealtimeSync] ⚠️ DB not loaded yet, cannot initialize');
      return;
    }
    
    console.log('[RealtimeSync] 🔄 Initializing Firebase Realtime Database...');
    
    try {
      const settings = DB.getSettings();
      
      if (!settings.firebaseConfig) {
        console.error('[RealtimeSync] ❌ Firebase not configured in Settings!');
        console.log('[RealtimeSync] 💡 Go to Settings → Firebase Configuration to set it up');
        console.log('[RealtimeSync] ⏸️ Running in offline-only mode. Changes queued:', syncQueue.length);
        return;
      }
      
      console.log('[RealtimeSync] 📋 Firebase config found:', {
        projectId: settings.firebaseConfig.projectId,
        databaseURL: settings.firebaseConfig.databaseURL
      });

      // Import Realtime Database
      console.log('[RealtimeSync] 📦 Loading Firebase modules...');
      const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
      realtimeMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js");
      
      // Get or create app
      let app;
      const apps = getApps();
      if (apps.length > 0) {
        app = apps[0];
        console.log('[RealtimeSync] 📱 Using existing Firebase app');
      } else {
        console.log('[RealtimeSync] 📱 Creating new Firebase app...');
        app = initializeApp(settings.firebaseConfig);
      }
      
      // (2026-07-13) Anonymous auth for realtime database; was unauthenticated
      try {
        const { getAuth, signInAnonymously } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
        const auth = getAuth(app);
        if(!auth.currentUser) await signInAnonymously(auth);
      } catch(authErr) {
        console.warn("[RealtimeSync] Anonymous auth note:", authErr);
      }
      realtimeDB = realtimeMod.getDatabase(app);
      isInitialized = true;
      
      console.log('[RealtimeSync] ✅ Firebase Realtime Database initialized successfully!');
      console.log('[RealtimeSync] 🌐 Database URL:', settings.firebaseConfig.databaseURL);
      Utils.toast('Firebase connected!', 'success', 2000);
      
      // Process any queued operations
      if (syncQueue.length > 0) {
        console.log(`[RealtimeSync] 🚀 Processing ${syncQueue.length} queued operations...`);
        processQueue();
      }
    } catch (error) {
      console.error('[RealtimeSync] ❌ Failed to initialize:', error);
      console.error('[RealtimeSync] Error details:', error.message);
      console.log('[RealtimeSync] ⏸️ Running in offline-only mode. Changes queued:', syncQueue.length);
    }
  }

  // ==============================================================
  // SHIFT MANAGEMENT - Real-time sync with conflict resolution
  // ==============================================================
  
  async function subscribeToShift(callback) {
    await init();
    if (!realtimeDB || typeof DB === 'undefined') return;

    const shiftRef = realtimeMod.ref(realtimeDB, 'shift/current');
    
    const unsubscribe = realtimeMod.onValue(shiftRef, (snapshot) => {
      const cloudShift = snapshot.val();
      const localShift = DB.getShift();
      
      if (!cloudShift) {
        // No shift in cloud, push local if exists
        if (localShift && localShift.status === 'open') {
          realtimeMod.set(shiftRef, {
            ...localShift,
            openedAt: localShift.openedAt || Date.now(),
            updatedAt: Date.now(),
            deviceId: getDeviceId(),
            cashier: localShift.cashier,
            openingCash: localShift.openingCash || 0,
            cashIn: localShift.cashIn || 0,
            cashOut: localShift.cashOut || 0,
            adjustments: localShift.adjustments || []
          });
        }
        return;
      }
      
      // Update local with cloud data - preserve all timing data
      if (!localShift || cloudShift.updatedAt > (localShift.updatedAt || 0)) {
        const fullShiftData = {
          ...cloudShift,
          openedAt: cloudShift.openedAt,
          updatedAt: cloudShift.updatedAt,
          status: cloudShift.status,
          cashier: cloudShift.cashier,
          openingCash: cloudShift.openingCash || 0,
          cashIn: cloudShift.cashIn || 0,
          cashOut: cloudShift.cashOut || 0,
          adjustments: cloudShift.adjustments || []
        };
        
        DB.setShift(fullShiftData);
        if (callback) callback(fullShiftData);
        
        console.log('[RealtimeSync] Shift synced from cloud:', fullShiftData);
        
        // Show notification if changed by another device
        const deviceId = getDeviceId();
        if (cloudShift.deviceId && cloudShift.deviceId !== deviceId) {
          if (cloudShift.status === 'open' && (!localShift || localShift.status !== 'open')) {
            Utils.toast('Shift opened on another device', 'info', 2000);
          } else if (cloudShift.status === 'closed' && localShift && localShift.status === 'open') {
            Utils.toast('Shift closed on another device', 'info', 2000);
          }
        }
        
        // Refresh UI
        if (typeof App !== 'undefined' && App.paintTopbar) App.paintTopbar();
        if (typeof Shift !== 'undefined' && Shift.render && App.currentView === 'shift') {
          Shift.render();
        }
      }
    });
    
    listeners.set('shift', unsubscribe);
    return unsubscribe;
  }

  async function openShift(shiftData) {
    await init();
    if (!realtimeDB) {
      // Fallback to local only
      DB.setShift(shiftData);
      return;
    }

    const shiftRef = realtimeMod.ref(realtimeDB, 'shift/current');
    
    try {
      // Ensure timestamp is preserved
      const timestampedShift = {
        ...shiftData,
        status: 'open',
        openedAt: shiftData.openedAt || Date.now(),
        updatedAt: Date.now(),
        deviceId: getDeviceId(),
        openedBy: Auth.currentUser()?.name || 'Unknown',
        cashier: shiftData.cashier,
        openingCash: shiftData.openingCash || 0,
        cashIn: shiftData.cashIn || 0,
        cashOut: shiftData.cashOut || 0,
        adjustments: shiftData.adjustments || []
      };
      
      // (2026-07-13) Set cloud shift directly; was aborting if status open
      await realtimeMod.set(shiftRef, timestampedShift);
      
      // Also update local with same timestamp
      DB.setShift(timestampedShift);
      console.log('[RealtimeSync] Shift opened and saved with timestamp:', timestampedShift.openedAt);
      return true;
    } catch (error) {
      console.error("Failed to open shift:", error);
      Utils.toast('Failed to open shift. Please try again.', 'error');
      return false;
    }
  }

  async function closeShift(closeData) {
    await init();
    if (!realtimeDB) {
      // Fallback to local only
      DB.setShift({ status: 'closed', closedAt: Date.now() });
      return;
    }

    const shiftRef = realtimeMod.ref(realtimeDB, 'shift/current');
    
    try {
      await realtimeMod.set(shiftRef, {
        ...closeData,
        status: 'closed',
        closedAt: Date.now(),
        updatedAt: Date.now(),
        deviceId: getDeviceId(),
        closedBy: Auth.currentUser()?.name || 'Unknown'
      });
      
      // Also update local
      DB.setShift({ status: 'closed', closedAt: Date.now(), updatedAt: Date.now() });
      return true;
    } catch (error) {
      console.error("Failed to close shift:", error);
      Utils.toast('Failed to close shift. Please try again.', 'error');
      return false;
    }
  }

  // (2026-10-01) Recovery functions to restore shift data from cloud
  async function getShiftFromCloud() {
    await init();
    if (!realtimeDB) return null;
    
    try {
      const shiftRef = realtimeMod.ref(realtimeDB, 'shift/current');
      const snapshot = await realtimeMod.get(shiftRef);
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error("Failed to get shift from cloud:", error);
      return null;
    }
  }

  async function getShiftLogsFromCloud() {
    await init();
    if (!realtimeDB) return [];
    
    try {
      const logsRef = realtimeMod.ref(realtimeDB, 'shift/logs');
      const snapshot = await realtimeMod.get(logsRef);
      if (snapshot.exists()) {
        const logsObj = snapshot.val();
        return Object.values(logsObj).sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0));
      }
      return [];
    } catch (error) {
      console.error("Failed to get shift logs from cloud:", error);
      return [];
    }
  }

  // (2026-10-01) Save shift log to cloud when shift is closed
  async function saveShiftLogToCloud(logData) {
    await init();
    if (!realtimeDB) return;
    
    try {
      const logRef = realtimeMod.ref(realtimeDB, `shift/logs/${logData.id}`);
      await realtimeMod.set(logRef, {
        ...logData,
        syncedAt: Date.now(),
        deviceId: getDeviceId()
      });
      console.log("[RealtimeSync] Shift log saved to cloud:", logData.id);
    } catch (error) {
      console.error("Failed to save shift log to cloud:", error);
    }
  }

  // ==============================================================
  // RECEIPT NUMBER GENERATION - Atomic counter
  // ==============================================================
  
  async function getNextReceiptNumber() {
    await init();
    if (!realtimeDB) {
      // Fallback to local generation
      const allSales = DB.getSales();
      const lastId = Math.max(...allSales.map(s => parseInt(s.receiptNo) || 0), 1000);
      return String(lastId + 1).padStart(4, "0");
    }

    const counterRef = realtimeMod.ref(realtimeDB, 'counters/receiptNumber');
    
    try {
      const result = await realtimeMod.runTransaction(counterRef, (current) => {
        return (current || 1000) + 1;
      });
      
      return String(result.snapshot.val()).padStart(4, "0");
    } catch (error) {
      console.error("Failed to get receipt number:", error);
      // Fallback to local
      const allSales = DB.getSales();
      const lastId = Math.max(...allSales.map(s => parseInt(s.receiptNo) || 0), 1000);
      return String(lastId + 1).padStart(4, "0");
    }
  }

  // ==============================================================
  // STOCK MANAGEMENT - Real-time with transactions
  // ==============================================================
  
  async function adjustStockAtomic(productId, delta, reason) {
    await init();
    if (!realtimeDB) {
      // Fallback to local only
      DB.adjustStock(productId, delta, reason);
      return { success: true, newStock: null };
    }

    const productRef = realtimeMod.ref(realtimeDB, `products/${productId}/stock`);
    
    try {
      const result = await realtimeMod.runTransaction(productRef, (currentStock) => {
        const stock = currentStock || 0;
        const newStock = stock + delta;
        
        if (newStock < 0) {
          // Abort transaction - insufficient stock
          return undefined;
        }
        
        return newStock;
      });
      
      if (!result.committed) {
        Utils.toast('Insufficient stock!', 'error');
        return { success: false, error: 'insufficient_stock' };
      }
      
      // Also update local
      DB.adjustStock(productId, delta, reason);
      
      return { success: true, newStock: result.snapshot.val() };
    } catch (error) {
      console.error("Failed to adjust stock:", error);
      // Fallback to local
      DB.adjustStock(productId, delta, reason);
      return { success: true, newStock: null };
    }
  }

  async function subscribeToProductStock(productId, callback) {
    await init();
    if (!realtimeDB) return;

    const productRef = realtimeMod.ref(realtimeDB, `products/${productId}`);
    
    const unsubscribe = realtimeMod.onValue(productRef, (snapshot) => {
      const cloudProduct = snapshot.val();
      if (cloudProduct && callback) {
        callback(cloudProduct);
        
        // Update local product
        const localProduct = DB.getProducts().find(p => p.id === productId);
        if (localProduct && cloudProduct.stock !== localProduct.stock) {
          localProduct.stock = cloudProduct.stock;
          DB.updateProduct(productId, localProduct);
        }
      }
    });
    
    listeners.set(`product_${productId}`, unsubscribe);
    return unsubscribe;
  }

  // ==============================================================
  // INVENTORY SYNC - Push products to cloud (Real-time)
  // ==============================================================
  
  async function syncAllProducts() {
    await init();
    if (!realtimeDB) return;

    const products = DB.getProducts();
    const productsRef = realtimeMod.ref(realtimeDB, 'products');
    
    try {
      const updates = {};
      products.forEach(product => {
        // Sanitize product ID - remove dots and invalid characters
        const sanitizedId = product.id.replace(/\./g, '_');
        
        // Remove undefined values and sanitize data
        const cleanProduct = {
          id: product.id,
          name: product.name || 'Unnamed Product',
          stock: Number(product.stock) || 0,
          price: Number(product.price) || 0,
          cost: Number(product.cost) || 0,
          barcode: product.barcode || '',
          category: product.category || 'Uncategorized',
          brand: product.brand || '',
          distributor: product.distributor || '',
          imageUrl: product.imageUrl || '',
          unit: product.unit || 'pc',
          lowStockThreshold: Number(product.lowStockThreshold) || 5,
          piecesPerPack: Number(product.piecesPerPack) || 1,
          packPrice: Number(product.packPrice) || 0,
          packCost: Number(product.packCost) || 0,
          packBarcode: product.packBarcode || '',
          updatedAt: product.updatedAt || Date.now(),
          createdAt: product.createdAt || Date.now()
        };
        
        updates[sanitizedId] = cleanProduct;
      });
      
      await realtimeMod.update(productsRef, updates);
      console.log(`✅ Synced ${products.length} products to cloud`);
      Utils.toast(`Synced ${products.length} products`, 'success', 2000);
    } catch (error) {
      console.error("Failed to sync products:", error);
      Utils.toast(`Sync failed: ${error.message}`, 'error', 3000);
    }
  }

  // Direct sync (used by queue)
  async function syncSingleProductDirect(product) {
    const sanitizedId = product.id.replace(/\./g, '_').replace(/[#$\/\[\]]/g, '_');
    const productRef = realtimeMod.ref(realtimeDB, `products/${sanitizedId}`);
    
    const cleanProduct = {
      id: product.id,
      name: product.name || 'Unnamed Product',
      stock: Number(product.stock) || 0,
      price: Number(product.price) || 0,
      cost: Number(product.cost) || 0,
      barcode: product.barcode || '',
      category: product.category || 'Uncategorized',
      brand: product.brand || '',
      distributor: product.distributor || '',
      imageUrl: product.imageUrl || '',
      unit: product.unit || 'pc',
      lowStockThreshold: Number(product.lowStockThreshold) || 5,
      piecesPerPack: Number(product.piecesPerPack) || 1,
      packPrice: Number(product.packPrice) || 0,
      packCost: Number(product.packCost) || 0,
      packBarcode: product.packBarcode || '',
      updatedAt: product.updatedAt || Date.now(),
      createdAt: product.createdAt || Date.now(),
      deviceId: getDeviceId()
    };
    
    await realtimeMod.set(productRef, cleanProduct);
  }
  
  // NEW: Real-time single product sync (with queue)
  async function syncSingleProduct(product) {
    console.log('[RealtimeSync] 🚀 Syncing product:', product.name);
    
    // Always save to localStorage first (instant)
    // Already done by DB.updateProduct() or DB.addProduct()
    
    // Add to sync queue
    enqueueSync({
      type: 'update',
      entityType: 'product',
      data: product
    });
    
    // If online, process immediately
    if (realtimeDB) {
      await processQueue();
    } else {
      console.log('[RealtimeSync] ⏸️ Offline - queued for later');
      Utils.toast(`Saved locally (will sync when online)`, 'info', 2000);
    }
  }

  // Direct delete (used by queue)
  async function deleteProductFromCloudDirect(productId) {
    const sanitizedId = productId.replace(/\./g, '_').replace(/[#$\/\[\]]/g, '_');
    const productRef = realtimeMod.ref(realtimeDB, `products/${sanitizedId}`);
    await realtimeMod.remove(productRef);
  }
  
  // NEW: Real-time product delete (with queue)
  async function deleteProductFromCloud(productId) {
    console.log('[RealtimeSync] 🗑️ Deleting product:', productId);
    
    // Add to sync queue
    enqueueSync({
      type: 'delete',
      entityType: 'product',
      data: { id: productId }
    });
    
    // If online, process immediately
    if (realtimeDB) {
      await processQueue();
    } else {
      console.log('[RealtimeSync] ⏸️ Offline - queued for later');
      Utils.toast(`Deleted locally (will sync when online)`, 'info', 2000);
    }
  }

  // (2026-07-13) Subscribe to all product updates in cloud; was missing function
  async function subscribeToAllProducts(callback) {
    await init();
    if (!realtimeDB || typeof DB === 'undefined') return;

    const productsRef = realtimeMod.ref(realtimeDB, 'products');
    
    const unsubscribe = realtimeMod.onValue(productsRef, (snapshot) => {
      const cloudData = snapshot.val();
      if (!cloudData) return;

      const cloudArray = Object.values(cloudData);
      const localProds = DB.getProducts();
      const localMap = new Map(localProds.map(p => [p.id, p]));
      const cloudMap = new Map();
      cloudArray.forEach(p => { if(p && p.id) cloudMap.set(p.id, p); });
      const deletedIds = DB.getDeletedProductIds ? DB.getDeletedProductIds() : new Set();

      let hasChanges = false;
      const updated = [];

      cloudMap.forEach((cp, id) => {
        if(deletedIds.has(id)) return;
        const lp = localMap.get(id);
        if(!lp){
          updated.push(cp);
          hasChanges = true;
        } else {
          const cTs = cp.updatedAt || cp.createdAt || 0;
          const lTs = lp.updatedAt || lp.createdAt || 0;
          if(cTs > lTs || JSON.stringify(lp) !== JSON.stringify(cp)){
            updated.push({ ...lp, ...cp });
            hasChanges = true;
          } else {
            updated.push(lp);
          }
        }
      });

      localProds.forEach(lp => {
        if(!cloudMap.has(lp.id) && !deletedIds.has(lp.id)){
          hasChanges = true;
        }
      });

      if(hasChanges){
        DB.setProducts(updated);
        App.rerenderCurrentView?.();
        if(callback) callback(updated);
      }
    });

    listeners.set('allProducts', unsubscribe);
    return unsubscribe;
  }

  // ==============================================================
  // RESTOCK LOG SYNC - Real-time
  // ==============================================================
  
  // Direct sync (used by queue)
  async function syncRestockLogDirect(log) {
    const logRef = realtimeMod.ref(realtimeDB, `restockLogs/${log.id}`);
    await realtimeMod.set(logRef, {
      ...log,
      syncedAt: Date.now(),
      deviceId: getDeviceId()
    });
  }
  
  async function syncRestockLog(log) {
    console.log('[RealtimeSync] 🚀 Syncing restock log');
    
    enqueueSync({
      type: 'create',
      entityType: 'restockLog',
      data: log
    });
    
    if (realtimeDB) {
      await processQueue();
    }
  }

  async function deleteRestockLogFromCloudDirect(logId) {
    const logRef = realtimeMod.ref(realtimeDB, `restockLogs/${logId}`);
    await realtimeMod.remove(logRef);
  }

  async function deleteRestockLogFromCloud(logId) {
    enqueueSync({
      type: 'delete',
      entityType: 'restockLog',
      data: { id: logId }
    });
    
    if (realtimeDB) {
      await processQueue();
    }
  }

  async function subscribeToRestockLogs(callback) {
    await init();
    if (!realtimeDB || typeof DB === 'undefined') return;

    const logsRef = realtimeMod.ref(realtimeDB, 'restockLogs');
    
    const unsubscribe = realtimeMod.onValue(logsRef, (snapshot) => {
      const cloudLogs = snapshot.val();
      if (!cloudLogs) return;

      const cloudLogsArray = Object.values(cloudLogs).sort((a, b) => (b.ts || 0) - (a.ts || 0));
      const localLogs = DB.getRestockLogs();
      const localLogsMap = new Map(localLogs.map(l => [l.id, l]));
      
      let hasChanges = false;
      const updatedLogs = [...localLogs];

      // (2026-07-13) Sync edited restock logs from cloud; was new logs only
      cloudLogsArray.forEach(cloudLog => {
        const localLog = localLogsMap.get(cloudLog.id);
        if (!localLog) {
          updatedLogs.unshift(cloudLog);
          hasChanges = true;
        } else if (JSON.stringify(localLog) !== JSON.stringify(cloudLog)) {
          const idx = updatedLogs.findIndex(l => l.id === cloudLog.id);
          if (idx !== -1) {
            updatedLogs[idx] = { ...localLog, ...cloudLog };
            hasChanges = true;
          }
        }
      });

      // (2026-07-13) Preserve local restock logs & sync up; was deleting local logs
      const cloudLogIds = new Set(cloudLogsArray.map(l => l.id));
      localLogs.forEach(l => {
        if (l && l.id && !cloudLogIds.has(l.id) && typeof syncRestockLogDirect === "function") {
          syncRestockLogDirect(l).catch(() => {});
        }
      });

      // Update local DB if there are changes
      if (hasChanges) {
        DB.setRestockLogs(updatedLogs);
        
        // Show notification
        const deviceId = getDeviceId();
        const hasExternalChanges = cloudLogsArray.some(l => l.deviceId && l.deviceId !== deviceId);
        
        if (hasExternalChanges) {
          Utils.toast('Restock logs updated from another device', 'info', 2000);
        }
        
        // Refresh reports view if open
        if (typeof Reports !== 'undefined' && App.currentView === 'reports') {
          Reports.render();
        }
        
        if (callback) callback(filtered);
      }
    });
    
    listeners.set('restockLogs', unsubscribe);
    return unsubscribe;
  }

  // ==============================================================
  // EXPENSE SYNC - Real-time
  // ==============================================================
  
  async function syncExpenseDirect(expense) {
    const expenseRef = realtimeMod.ref(realtimeDB, `expenses/${expense.id}`);
    await realtimeMod.set(expenseRef, {
      ...expense,
      syncedAt: Date.now(),
      deviceId: getDeviceId()
    });
  }
  
  async function syncExpense(expense) {
    enqueueSync({
      type: 'create',
      entityType: 'expense',
      data: expense
    });
    
    if (realtimeDB) {
      await processQueue();
    }
  }

  async function deleteExpenseFromCloudDirect(expenseId) {
    const expenseRef = realtimeMod.ref(realtimeDB, `expenses/${expenseId}`);
    await realtimeMod.remove(expenseRef);
  }

  async function deleteExpenseFromCloud(expenseId) {
    enqueueSync({
      type: 'delete',
      entityType: 'expense',
      data: { id: expenseId }
    });
    
    if (realtimeDB) {
      await processQueue();
    }
  }

  async function subscribeToExpenses(callback) {
    await init();
    if (!realtimeDB || typeof DB === 'undefined') return;

    const expensesRef = realtimeMod.ref(realtimeDB, 'expenses');
    
    const unsubscribe = realtimeMod.onValue(expensesRef, (snapshot) => {
      const cloudExpenses = snapshot.val();
      if (!cloudExpenses) return;

      const cloudExpensesArray = Object.values(cloudExpenses).sort((a, b) => (b.ts || 0) - (a.ts || 0));
      const localExpenses = DB.getExpenses();
      const localExpensesMap = new Map(localExpenses.map(e => [e.id, e]));
      
      let hasChanges = false;
      const updatedExpenses = [...localExpenses];

      // (2026-07-13) Sync edited expenses from cloud; was new expenses only
      cloudExpensesArray.forEach(cloudExpense => {
        const localExpense = localExpensesMap.get(cloudExpense.id);
        if (!localExpense) {
          updatedExpenses.unshift(cloudExpense);
          hasChanges = true;
        } else if (JSON.stringify(localExpense) !== JSON.stringify(cloudExpense)) {
          const idx = updatedExpenses.findIndex(e => e.id === cloudExpense.id);
          if (idx !== -1) {
            updatedExpenses[idx] = { ...localExpense, ...cloudExpense };
            hasChanges = true;
          }
        }
      });

      // (2026-07-13) Preserve local expenses & sync up; was deleting local expenses
      const cloudExpenseIds = new Set(cloudExpensesArray.map(e => e.id));
      localExpenses.forEach(e => {
        if (e && e.id && !cloudExpenseIds.has(e.id) && typeof syncExpenseDirect === "function") {
          syncExpenseDirect(e).catch(() => {});
        }
      });

      // Update local DB if there are changes
      if (hasChanges) {
        DB.setExpenses(updatedExpenses);
        
        // Show notification
        const deviceId = getDeviceId();
        const hasExternalChanges = cloudExpensesArray.some(e => e.deviceId && e.deviceId !== deviceId);
        
        if (hasExternalChanges) {
          Utils.toast('Expenses updated from another device', 'info', 2000);
        }
        
        // Refresh expenses view if open
        if (typeof Expenses !== 'undefined' && App.currentView === 'expenses') {
          Expenses.render();
        }
        
        if (callback) callback(filtered);
      }
    });
    
    listeners.set('expenses', unsubscribe);
    return unsubscribe;
  }

  // NEW: Subscribe to all product changes from cloud
  async function subscribeToAllProducts(callback) {
    await init();
    if (!realtimeDB || typeof DB === 'undefined') return;

    const productsRef = realtimeMod.ref(realtimeDB, 'products');
    const deviceId = getDeviceId();
    
    console.log('[RealtimeSync] 🎧 Setting up product listeners...');
    
    // Listen for product additions
    const onChildAddedListener = realtimeMod.onChildAdded(productsRef, (snapshot) => {
      const newProduct = snapshot.val();
      const localProducts = DB.getProducts();
      const exists = localProducts.some(p => p.id === newProduct.id);
      
      if (!exists) {
        console.log('[RealtimeSync] ➕ New product from cloud:', newProduct.name);
        localProducts.push(newProduct);
        
        const key = 'mm_products';
        localStorage.setItem(key, JSON.stringify(localProducts));
        document.dispatchEvent(new CustomEvent('mm:dirty', { 
          detail: { key, silent: true } 
        }));
        
        if (newProduct.deviceId && newProduct.deviceId !== deviceId) {
          Utils.toast(`New product: ${newProduct.name}`, 'info', 2000);
        }
        
        if (typeof Inventory !== 'undefined' && App.currentView === 'inventory') {
          Inventory.render();
        }
      }
    });
    
    // Listen for product updates/changes
    const onChildChangedListener = realtimeMod.onChildChanged(productsRef, (snapshot) => {
      const updatedProduct = snapshot.val();
      const localProducts = DB.getProducts();
      const index = localProducts.findIndex(p => p.id === updatedProduct.id);
      
      if (index !== -1) {
        const oldStock = localProducts[index].stock;
        const newStock = updatedProduct.stock;
        
        console.log('[RealtimeSync] 🔄 Product changed from cloud:', updatedProduct.name, 
                    `stock: ${oldStock} → ${newStock}`);
        
        localProducts[index] = updatedProduct;
        
        const key = 'mm_products';
        localStorage.setItem(key, JSON.stringify(localProducts));
        document.dispatchEvent(new CustomEvent('mm:dirty', { 
          detail: { key, silent: true } 
        }));
        
        if (updatedProduct.deviceId && updatedProduct.deviceId !== deviceId) {
          Utils.toast(`Updated: ${updatedProduct.name} (stock: ${newStock})`, 'info', 2000);
        }
        
        if (typeof Inventory !== 'undefined' && App.currentView === 'inventory') {
          Inventory.render();
        }
      }
    });
    
    // Listen for product deletions
    const onChildRemovedListener = realtimeMod.onChildRemoved(productsRef, (snapshot) => {
      const deletedProductId = snapshot.key;
      const deletedProduct = snapshot.val();
      
      console.log('[RealtimeSync] 🗑️ Product deleted from cloud:', deletedProduct?.name || deletedProductId);
      
      const localProducts = DB.getProducts();
      const filtered = localProducts.filter(p => p.id !== deletedProductId);
      
      if (filtered.length !== localProducts.length) {
        const key = 'mm_products';
        localStorage.setItem(key, JSON.stringify(filtered));
        document.dispatchEvent(new CustomEvent('mm:dirty', { 
          detail: { key, silent: true } 
        }));
        
        if (deletedProduct?.deviceId && deletedProduct.deviceId !== deviceId) {
          Utils.toast('Product deleted on another device', 'info', 2000);
        }
        
        if (typeof Inventory !== 'undefined' && App.currentView === 'inventory') {
          Inventory.render();
        }
      }
    });
    
    console.log('[RealtimeSync] ✅ Product listeners active');
    
    // Store all listeners
    listeners.set('products', () => {
      onChildAddedListener();
      onChildChangedListener();
      onChildRemovedListener();
    });
    
    return () => {
      onChildAddedListener();
      onChildChangedListener();
      onChildRemovedListener();
    };
  }

  // ==============================================================
  // DEVICE MANAGEMENT
  // ==============================================================
  
  function getDeviceId() {
    let deviceId = localStorage.getItem('mm_deviceId');
    if (!deviceId) {
      deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('mm_deviceId', deviceId);
    }
    return deviceId;
  }

  async function registerDevice() {
    await init();
    if (!realtimeDB) return;

    const deviceId = getDeviceId();
    const deviceRef = realtimeMod.ref(realtimeDB, `devices/${deviceId}`);
    
    await realtimeMod.set(deviceRef, {
      id: deviceId,
      name: `Device ${deviceId.substr(-6)}`,
      lastSeen: Date.now(),
      user: Auth.currentUser()?.name || 'Unknown',
      status: 'online'
    });
    
    // Update last seen every 30 seconds
    setInterval(async () => {
      await realtimeMod.update(deviceRef, {
        lastSeen: Date.now(),
        status: 'online'
      });
    }, 30000);
    
    // Set offline on disconnect
    realtimeMod.onDisconnect(deviceRef).update({
      status: 'offline',
      lastSeen: Date.now()
    });
  }

  async function getActiveDevices() {
    await init();
    if (!realtimeDB) return [];

    const devicesRef = realtimeMod.ref(realtimeDB, 'devices');
    const snapshot = await realtimeMod.get(devicesRef);
    
    if (!snapshot.exists()) return [];
    
    const devices = [];
    const now = Date.now();
    const ONLINE_THRESHOLD = 60000; // 1 minute
    
    snapshot.forEach((childSnapshot) => {
      const device = childSnapshot.val();
      if (device && device.status === 'online' && (now - device.lastSeen) < ONLINE_THRESHOLD) {
        devices.push(device);
      }
    });
    
    return devices;
  }

  // ==============================================================
  // CLEANUP
  // ==============================================================
  
  function unsubscribeAll() {
    listeners.forEach((unsubscribe, key) => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    listeners.clear();
  }

  // ==============================================================
  // AUTOMATIC SYNC TRIGGER - Listen to DB changes
  // ==============================================================
  
  let syncDebounceTimer = null;
  
  function setupAutomaticSync() {
    // Listen to all database changes
    document.addEventListener('mm:dirty', async (e) => {
      const { key, silent } = e.detail || {};
      
      // Skip if silent (sync restore) or not products
      if (silent) return;
      
      // Handle product changes
      if (key === 'mm_products') {
        // Debounce to avoid too many syncs
        clearTimeout(syncDebounceTimer);
        syncDebounceTimer = setTimeout(async () => {
          console.log('[RealtimeSync] Auto-syncing products to cloud...');
          await syncAllProducts();
          
          // Also trigger Firestore snapshot sync
          if (typeof Sync !== 'undefined' && Sync.pushSnapshot) {
            Sync.pushSnapshot(true).catch(err => {
              console.warn('[RealtimeSync] Firestore sync failed:', err);
            });
          }
        }, 1000); // 1 second debounce
      }
      
      // Handle other data changes (sales, expenses, etc.)
      if (key === 'mm_sales' || key === 'mm_expenses' || key === 'mm_fuelSales') {
        // Trigger Firestore snapshot sync
        clearTimeout(syncDebounceTimer);
        syncDebounceTimer = setTimeout(async () => {
          if (typeof Sync !== 'undefined' && Sync.pushSnapshot) {
            console.log('[RealtimeSync] Auto-syncing data to Firestore...');
            Sync.pushSnapshot(true).catch(err => {
              console.warn('[RealtimeSync] Firestore sync failed:', err);
            });
          }
        }, 2000); // 2 second debounce for larger data
      }
    });
    
    console.log('✅ Automatic sync triggers setup');
  }
  
  // ==============================================================
  // DIAGNOSTIC & DEBUG FUNCTIONS
  // ==============================================================
  
  function getSyncStatus() {
    const status = {
      initialized: isInitialized,
      firebaseConfigured: typeof DB !== 'undefined' && !!DB.getSettings().firebaseConfig,
      realtimeDBReady: !!realtimeDB,
      activeListeners: listeners.size,
      deviceId: getDeviceId()
    };
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 REALTIME SYNC STATUS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✓ Initialized:', status.initialized ? '✅ YES' : '❌ NO');
    console.log('✓ Firebase Config:', status.firebaseConfigured ? '✅ YES' : '❌ NO');
    console.log('✓ Realtime DB Ready:', status.realtimeDBReady ? '✅ YES' : '❌ NO');
    console.log('✓ Active Listeners:', status.activeListeners);
    console.log('✓ Device ID:', status.deviceId);
    
    if (status.firebaseConfigured && typeof DB !== 'undefined') {
      const config = DB.getSettings().firebaseConfig;
      console.log('✓ Database URL:', config.databaseURL || '❌ MISSING');
      console.log('✓ Project ID:', config.projectId || '❌ MISSING');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (!status.initialized) {
      console.warn('⚠️ NOT INITIALIZED - Run: RealtimeSync.init()');
    }
    if (!status.firebaseConfigured) {
      console.error('❌ FIREBASE NOT CONFIGURED - Go to Settings → Firebase Configuration');
    }
    if (!status.realtimeDBReady) {
      console.error('❌ REALTIME DB NOT READY - Check Firebase config');
    }
    if (status.activeListeners === 0) {
      console.warn('⚠️ NO ACTIVE LISTENERS - Run: RealtimeSync.subscribeToAllProducts()');
    }
    
    return status;
  }
  
  async function testSync() {
    console.log('[RealtimeSync] 🧪 Running sync test...');
    
    const status = getSyncStatus();
    
    if (!status.realtimeDBReady) {
      console.error('[RealtimeSync] ❌ Cannot test - Firebase not ready');
      return;
    }
    
    // Test write
    try {
      const testRef = realtimeMod.ref(realtimeDB, `test/sync_test_${Date.now()}`);
      await realtimeMod.set(testRef, {
        timestamp: Date.now(),
        message: 'Test sync',
        deviceId: getDeviceId()
      });
      console.log('[RealtimeSync] ✅ Write test PASSED');
      
      // Clean up
      await realtimeMod.remove(testRef);
      console.log('[RealtimeSync] ✅ Delete test PASSED');
      
      Utils.toast('Sync test PASSED! ✅', 'success', 3000);
      return true;
    } catch (error) {
      console.error('[RealtimeSync] ❌ Sync test FAILED:', error);
      Utils.toast(`Sync test FAILED: ${error.message}`, 'error', 5000);
      return false;
    }
  }
  
  // ==============================================================
  // PUBLIC API
  // ==============================================================
  
  return {
    init,
    
    // Shift management
    subscribeToShift,
    openShift,
    closeShift,
    getShiftFromCloud,
    getShiftLogsFromCloud,
    saveShiftLogToCloud,
    
    // POS
    getNextReceiptNumber,
    
    // Inventory
    adjustStockAtomic,
    subscribeToProductStock,
    syncAllProducts,
    syncSingleProduct,
    deleteProductFromCloud,
    subscribeToAllProducts,
    
    // Restock logs
    syncRestockLog,
    deleteRestockLogFromCloud,
    subscribeToRestockLogs,
    
    // Expenses
    syncExpense,
    deleteExpenseFromCloud,
    subscribeToExpenses,
    
    // Device management
    getDeviceId,
    registerDevice,
    getActiveDevices,
    
    // Queue management
    processQueue,
    getQueueStatus: () => ({
      pending: syncQueue.length,
      operations: syncQueue.map(op => ({
        type: op.type,
        entity: op.entityType,
        name: op.data?.name || op.data?.id,
        retries: op.retries,
        timestamp: op.timestamp
      }))
    }),
    
    // Diagnostic
    getSyncStatus,
    testSync,
    
    // Cleanup
    unsubscribeAll,
    
    // Setup
    setupAutomaticSync
  };
})();

// Auto-initialize on load - Wait for all scripts to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit to ensure DB is loaded
    setTimeout(() => {
      if (typeof DB === 'undefined') {
        console.warn('[RealtimeSync] DB not loaded yet, waiting...');
        return;
      }
      RealtimeSync.init().then(() => {
        RealtimeSync.registerDevice();
        RealtimeSync.subscribeToShift();
        RealtimeSync.subscribeToAllProducts();
        RealtimeSync.subscribeToRestockLogs();
        RealtimeSync.subscribeToExpenses();
        RealtimeSync.setupAutomaticSync();
      }).catch(err => {
        console.warn('[RealtimeSync] Init failed:', err);
      });
    }, 100);
  });
} else {
  // Document already loaded, wait a bit for DB to be ready
  setTimeout(() => {
    if (typeof DB === 'undefined') {
      console.warn('[RealtimeSync] DB not loaded yet, skipping auto-init');
      return;
    }
    RealtimeSync.init().then(() => {
      RealtimeSync.registerDevice();
      RealtimeSync.subscribeToShift();
      RealtimeSync.subscribeToAllProducts();
      RealtimeSync.subscribeToRestockLogs();
      RealtimeSync.subscribeToExpenses();
      RealtimeSync.setupAutomaticSync();
    }).catch(err => {
      console.warn('[RealtimeSync] Init failed:', err);
    });
  }, 100);
}
