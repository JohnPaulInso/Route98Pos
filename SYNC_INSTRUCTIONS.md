# 🔄 Cross-Device Sync Instructions

## Why Data Doesn't Appear Across Devices

Each browser context has **isolated localStorage**:
- 🌐 **Normal browser** = separate storage
- 🕵️ **Incognito mode** = temporary storage (deleted when closed)
- 📱 **APK (Capacitor)** = native device storage

**Your Firebase sync IS configured**, but each device needs to pull data manually the first time.

## ✅ How to Sync Data Across Devices

### Step 1: Push from Main Device (Normal Browser)

1. Open the app in your **normal browser** (where you added items)
2. Make sure you're logged in
3. The app should auto-sync within 4 seconds of any change
4. Check the sync indicator in the bottom-left sidebar:
   - ✅ **"Synced just now"** (green) = Data uploaded to cloud
   - ⏳ **"Syncing…"** = Currently uploading
   - ❌ **"Local only"** = Not syncing (check settings)

### Step 2: Pull on Other Devices

#### For Incognito Mode:
1. Open app in incognito: `http://127.0.0.1:5514`
2. **Log in** (important! sync requires login)
3. Open browser **Console** (F12)
4. Type: `Sync.pullSnapshot()` and press Enter
5. Wait 2-3 seconds, then **refresh the page** (Ctrl+R)
6. All data should now appear!

#### For APK (Mobile):
1. Install and open the APK
2. **Log in** (sync won't work if not logged in)
3. The app should auto-pull on login
4. If data still missing:
   - Connect device to PC via USB
   - Open Chrome: `chrome://inspect`
   - Find your device and click "Inspect"
   - In console, type: `Sync.pullSnapshot()` then refresh

### Step 3: Verify Sync Status

Check the **sync pill** in bottom-left corner of sidebar:
- 🟢 **"Synced just now"** = Working perfectly
- 🟢 **"Synced 2m ago"** = Last sync was 2 minutes ago
- 🔵 **"Connected"** = Firebase connected but no data synced yet
- ⚪ **"Local only"** = Sync disabled or not configured
- 🔴 **"Sync error"** = Check console for errors

## 🔧 Manual Sync Commands

### In Browser Console (F12 → Console):

```javascript
// Pull latest data from cloud
await Sync.pullSnapshot();

// Push current data to cloud
await Sync.pushSnapshot(true);

// Check sync status
DB.getSyncMeta();

// Force sync both ways
await Sync.pullSnapshot();
await Sync.pushSnapshot(true);
console.log('Sync complete! Refresh the page.');
```

## 🚨 Common Issues & Fixes

### Issue 1: "Local only" Status
**Cause**: Auto-sync is disabled or Firebase not configured

**Fix**:
1. Go to **Settings** (admin only)
2. Scroll to **Cloud Sync & Backup**
3. Make sure **"Enable automatic cloud sync"** is checked
4. Check that Firebase config is present

### Issue 2: Data Not Appearing After Sync
**Cause**: Page not refreshed after pulling data

**Fix**:
1. Run `Sync.pullSnapshot()` in console
2. **Wait 2-3 seconds**
3. **Refresh the page** (Ctrl+R or F5)
4. Data should now appear

### Issue 3: Incognito Data Disappears
**Cause**: Incognito clears localStorage when closed

**Fix**: This is expected behavior. Incognito is for testing only. Use:
- Normal browser for permanent storage
- APK for mobile production use
- Never rely on incognito for permanent data

### Issue 4: APK Not Syncing
**Cause**: Network permissions or not logged in

**Fix**:
1. Make sure device has internet connection
2. **Log in to the app** (sync requires authentication)
3. Check Android manifest has `INTERNET` permission (already added)
4. Check console for errors: `chrome://inspect`

## 📊 Understanding Sync Behavior

### Auto-Sync Triggers
The app automatically syncs when:
- ✅ Any sale is completed
- ✅ Product added/edited in inventory
- ✅ Shift opened/closed
- ✅ Expense added
- ✅ Settings changed
- ✅ On login (pulls cloud data)
- ✅ Every 4 seconds after any change (debounced)

### What Gets Synced
Everything:
- ✅ Products & Inventory
- ✅ Sales & Transactions
- ✅ Gasoline pump readings
- ✅ Expenses (OPEX)
- ✅ User accounts & PINs
- ✅ Settings
- ✅ Shift data
- ✅ Categories

### What Doesn't Sync
- ❌ Current cart (in-progress sales) - local only until completed
- ❌ Held transactions - local only until resumed

## 🎯 Best Practices

1. **Use One Primary Device**: Keep your main browser as the "master" source
2. **Always Log In**: Sync only works when logged in
3. **Wait for Green**: Check sync pill shows "Synced just now" before switching devices
4. **Refresh After Pull**: Always refresh page after running `Sync.pullSnapshot()`
5. **Check Console**: Use F12 console to verify sync operations
6. **Backup Daily**: The app auto-backs up at 11:59 PM daily

## 🔄 Full Reset & Re-Sync (Last Resort)

If sync is completely broken:

1. **On main device** (normal browser):
   ```javascript
   // Push everything to cloud
   await Sync.pushSnapshot(true);
   ```

2. **On other device** (incognito/APK):
   ```javascript
   // Clear local data
   const keys = Object.keys(localStorage);
   keys.forEach(k => { if(k.startsWith('mm_')) localStorage.removeItem(k); });
   
   // Pull from cloud
   location.reload();
   // After login, run:
   await Sync.pullSnapshot();
   location.reload();
   ```

## 📱 Quick Test for Cross-Device Sync

1. **Device A (Browser)**: Add a test product
2. Wait 5 seconds, check sync pill shows "Synced just now"
3. **Device B (Incognito)**: 
   - Open console (F12)
   - Run: `Sync.pullSnapshot()`
   - Wait 3 seconds
   - Refresh page (F5)
   - Check if test product appears

---

**Remember**: Firebase sync is working! Each device just needs to **pull** data manually the first time, then auto-sync takes over.
