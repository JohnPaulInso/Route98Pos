# 🔍 Diagnostic Commands - Run These Now

## Step 1: Check Sync Status (Run on BOTH browsers)

```javascript
RealtimeSync.getSyncStatus()
```

**What to look for:**
```
✓ Initialized: ✅ YES  (or ❌ NO)
✓ Firebase Config: ✅ YES  (or ❌ NO)
✓ Realtime DB Ready: ✅ YES  (or ❌ NO)
✓ Active Listeners: 3 (or 0)
```

**If you see ❌ NO for any, that's the problem!**

---

## Step 2: Test Connection (Run on BOTH browsers)

```javascript
await RealtimeSync.testSync()
```

**Expected:**
```
✅ Write test PASSED
✅ Delete test PASSED
Toast: "Sync test PASSED! ✅"
```

**If FAILED:** Firebase not working

---

## Step 3: Check Firebase Config (Run on ONE browser)

```javascript
console.log(DB.getSettings().firebaseConfig)
```

**Expected:**
```javascript
{
  apiKey: "AIza...",
  authDomain: "project.firebaseapp.com",
  databaseURL: "https://project.firebaseio.com",  // ← MUST HAVE THIS!
  projectId: "project-id",
  storageBucket: "project.appspot.com",
  messagingSenderId: "123456",
  appId: "1:123..."
}
```

**If null or missing databaseURL:** Not configured!

---

## Step 4: Manual Sync Test

**In MAIN browser:**
```javascript
// Get a product
const products = DB.getProducts();
const product = products[0];

// Edit it
console.log('Before:', product.name, product.stock);
DB.updateProduct(product.id, { stock: product.stock + 100 });
console.log('After:', DB.getProducts().find(p => p.id === product.id).stock);

// Watch console for sync messages
```

**Expected console output:**
```
[DB] 📊 Stock changed: ProductName from X to X+100 (+100)
[DB] 🚀 Syncing product update to Firebase...
[RealtimeSync] 🚀 Starting sync for product: ProductName
[RealtimeSync] ✅ Synced product to Firebase!
```

**In INCOGNITO browser:**
Wait 5 seconds, then:
```javascript
// Check if it updated
const products = DB.getProducts();
console.log('Product stock:', products[0].stock);

// Should match main browser's new stock
```

---

## Step 5: Check Listeners (Run on INCOGNITO)

```javascript
console.log('Active listeners:', RealtimeSync.getSyncStatus().activeListeners);
```

**Expected:** Should be 3 or more

**If 0:** Listeners not subscribed!

**Fix:**
```javascript
await RealtimeSync.subscribeToAllProducts();
```

---

## Step 6: Force Re-Initialize (If nothing works)

**Run on BOTH browsers:**
```javascript
// Unsubscribe all
RealtimeSync.unsubscribeAll();

// Wait 2 seconds
await new Promise(r => setTimeout(r, 2000));

// Re-initialize
await RealtimeSync.init();
await RealtimeSync.subscribeToAllProducts();
await RealtimeSync.subscribeToRestockLogs();
await RealtimeSync.subscribeToExpenses();

// Check status
RealtimeSync.getSyncStatus();
```

---

## 🚨 Common Problems

### Problem 1: Firebase Not Configured
**Symptom:** `Firebase Config: ❌ NO`

**Fix:**
1. Go to Settings in app
2. Click "Firebase Configuration"
3. Fill ALL fields (especially databaseURL!)
4. Save
5. Refresh both browsers

---

### Problem 2: No Active Listeners
**Symptom:** `Active Listeners: 0`

**Fix:**
```javascript
await RealtimeSync.subscribeToAllProducts();
```

---

### Problem 3: Different Data in Each Browser
**Symptom:** Stock numbers different

**This means:**
- Each browser has its own localStorage
- Firebase sync NOT working
- Check Firebase config!

---

## 📊 What Should Happen

### When Working:
1. Edit on Browser A
2. Console shows: `🚀 Syncing...`
3. Console shows: `✅ Synced!`
4. Browser B console shows: `Product updated from cloud`
5. Browser B stock updates automatically

### Timeline:
- T=0s: Edit on Browser A
- T=0.5s: Synced to Firebase
- T=1s: Browser B receives update
- T=1.5s: Browser B UI refreshes

---

## 🎯 Quick Decision Tree

**Run:** `RealtimeSync.getSyncStatus()`

1. **Firebase Config: ❌ NO**
   → Go to Settings → Configure Firebase

2. **Realtime DB Ready: ❌ NO**
   → Wrong Firebase config (missing databaseURL)

3. **Active Listeners: 0**
   → Run: `await RealtimeSync.subscribeToAllProducts()`

4. **All ✅ YES but still not working**
   → Check network tab for Firebase requests
   → Firebase Database Rules might be blocking

5. **Test sync fails**
   → Internet connection issue
   → Firebase project not set up correctly

---

## 🔥 Nuclear Option (Last Resort)

**If NOTHING works:**

```javascript
// 1. Clear everything
localStorage.clear();

// 2. Refresh page
location.reload();

// 3. Login again
// 4. Go to Settings → Configure Firebase
// 5. Enter ALL Firebase details
// 6. Save
// 7. Refresh BOTH browsers
// 8. Run diagnostics again
```

---

**RUN THESE COMMANDS NOW IN BOTH BROWSERS AND TELL ME WHAT YOU SEE!**

Specifically tell me:
1. What `RealtimeSync.getSyncStatus()` shows
2. What `await RealtimeSync.testSync()` shows
3. Does Firebase config exist?
