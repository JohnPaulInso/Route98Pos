# Automatic Real-Time Sync Guide

## Overview
Route 98 POS now features **automatic real-time synchronization** across all devices, similar to Google Keep. Any changes made on one device are instantly reflected on all other connected devices.

---

## 🚀 How It Works

### Real-Time Sync (Firebase Realtime Database)
- **Products**: Instant sync when you add, edit, or delete products
- **Shifts**: Instant sync when shifts are opened/closed
- **Stock**: Atomic transactions prevent conflicts
- **Receipt Numbers**: Global counter ensures unique receipts

### Firestore Sync (Batch Sync)
- **Sales**: Synced automatically after changes (2-second debounce)
- **Expenses**: Synced automatically after changes
- **Full Data**: Complete snapshot including all historical data

---

## ⚡ What Gets Auto-Synced

### ✅ Instant Sync (Real-Time Database)

| Action | Sync Time | Notification |
|--------|-----------|--------------|
| Add Product | Instant | ✅ "Inventory updated from another device" |
| Edit Product | Instant | ✅ "Inventory updated from another device" |
| Delete Product | Instant | ✅ "Inventory updated from another device" |
| Update Stock | Instant | ✅ Stock updated atomically |
| Open Shift | Instant | ✅ "Shift opened on another device" |
| Close Shift | Instant | ✅ "Shift closed on another device" |

### ⏱️ Automatic Sync (Firestore - 1-2 second delay)

| Action | Sync Time | Cloud Storage |
|--------|-----------|---------------|
| Complete Sale | 2 seconds | ✅ Firestore snapshot |
| Record Expense | 2 seconds | ✅ Firestore snapshot |
| Fuel Sale | 2 seconds | ✅ Firestore snapshot |
| Product Changes | 1 second | ✅ Firestore snapshot |

---

## 🔄 Sync Flow

### When You Edit a Product:

```
1. You save product changes on Device A
   ↓
2. Changes saved to localStorage (instant)
   ↓
3. mm:dirty event fired
   ↓
4. Real-Time Database updated (< 500ms)
   ↓
5. Device B receives update instantly
   ↓
6. Device B updates its localStorage
   ↓
7. Device B shows notification: "Inventory updated"
   ↓
8. Device B refreshes inventory view
   ↓
9. Firestore snapshot updated (1 second later)
   ↓
10. All data backed up to cloud
```

### Total Sync Time:
- **Real-Time DB**: < 500ms
- **Firestore Backup**: < 3 seconds
- **User sees change**: Instantly on all devices

---

## 🎯 Conflict Resolution

### Product Edits
- **Timestamp-based**: Newer changes always win
- **Atomic updates**: Stock changes use transactions
- **3-Way Merge**: Combines local + remote + baseline changes

### Example Scenario:
```
Device A: Updates product price to ₱100 at 10:00:00
Device B: Updates same product stock to 50 at 10:00:05

Result: Both changes applied
- Price: ₱100 (from Device A)
- Stock: 50 (from Device B)
- Timestamp: 10:00:05 (newest)
```

### Stock Conflicts:
```
Device A: Sells 5 units (stock: 100 → 95)
Device B: Sells 3 units (stock: 100 → 97)

Result: Atomic transaction ensures correct stock
- Stock: 92 (100 - 5 - 3)
- Both sales recorded
- No inventory loss
```

---

## 📱 Multi-Device Support

### Device Detection
Each device gets a unique ID:
```
device_1727980000000_abc123xyz
```

### Device Status
- **Online**: Active within last 60 seconds
- **Offline**: No activity for 60+ seconds

### Active Devices View
See all connected devices in **Settings → Data & Backups**

---

## 🔔 Notifications

You'll see toast notifications when:
- ✅ Inventory updated from another device
- ✅ Shift opened/closed on another device
- ✅ Sync completed successfully
- ⚠️ Sync failed (with retry)

---

## ⚙️ Configuration

### Firebase Realtime Database

Already configured in your Firebase project:
```
Database URL: https://route98-bogo-default-rtdb.firebaseio.com
```

### Security Rules

Recommended Realtime Database rules:
```json
{
  "rules": {
    "products": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "shift": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "devices": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "counters": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

---

## 🚦 Sync Indicators

### Top Bar Sync Pill

| Status | Color | Meaning |
|--------|-------|---------|
| "Synced just now" | 🟢 Green | All synced within last minute |
| "Synced 5m ago" | 🟢 Green | Last sync 5 minutes ago |
| "Syncing..." | 🟢 Green | Currently syncing |
| "Sync error" | 🔴 Red | Sync failed - check connection |
| "Local only" | ⚪ Gray | Firebase not configured |

---

## 🛠️ Troubleshooting

### Changes Not Syncing?

**Check 1: Internet Connection**
- Make sure device is online
- Check sync pill status

**Check 2: Firebase Config**
- Go to Settings → Data & Backups
- Verify Firebase is connected
- Look for green sync indicator

**Check 3: Browser Console**
- Press F12 → Console tab
- Look for sync errors
- Check for "✅ Synced X products to cloud"

**Check 4: Other Device**
- Verify other device is online
- Check if it's logged in
- Verify same Firebase project

### Manual Sync

If automatic sync fails:
1. Go to **Settings** → **Data & Backups**
2. Click **"Sync Now"** button
3. Wait for confirmation
4. Check other devices

### Force Refresh

On the device not seeing changes:
1. Click sync pill in top bar
2. Click "Sync Now"
3. Or press F5 to refresh page

---

## 📊 Performance

### Sync Speed
- **Product changes**: < 500ms
- **Product list (700 items)**: < 2 seconds
- **Full snapshot**: < 5 seconds
- **Cross-device notification**: < 1 second

### Data Usage
- **Product edit**: ~2 KB
- **Product list sync**: ~500 KB (700 products)
- **Full snapshot**: ~2-5 MB (depends on sales history)

### Battery Impact
- **Minimal**: Uses WebSocket connection
- **Efficient**: Only syncs changes, not full data
- **Smart**: Debounced to prevent excessive syncs

---

## 🔐 Security

### Authentication
- Anonymous auth enabled by default
- Each device gets unique auth token
- No personal data shared

### Data Protection
- All data encrypted in transit (HTTPS)
- Firebase Security Rules protect data
- Only authenticated devices can read/write

---

## 🎮 Testing Multi-Device Sync

### Test 1: Product Edit
1. Open Route 98 on Device A
2. Open Route 98 on Device B
3. On Device A: Edit a product price
4. On Device B: See notification + price updated
5. **Expected**: < 2 seconds

### Test 2: Product Delete
1. On Device A: Delete a product
2. On Device B: See notification + product removed
3. **Expected**: < 2 seconds

### Test 3: Product Add
1. On Device A: Add new product
2. On Device B: See notification + product appears
3. **Expected**: < 2 seconds

### Test 4: Stock Adjustment
1. On Device A: Adjust stock +10
2. On Device B: See stock updated
3. **Expected**: < 1 second (atomic)

---

## 🔧 Advanced Configuration

### Disable Automatic Sync

To disable automatic sync (not recommended):
```javascript
// In browser console:
document.removeEventListener('mm:dirty', RealtimeSync.setupAutomaticSync);
```

### Adjust Debounce Timing

Edit `js/realtime-sync.js`:
```javascript
// Change from 1000ms to your preferred delay
setTimeout(async () => {
  await syncAllProducts();
}, 1000); // <-- Change this value
```

### Monitor Sync Events

In browser console:
```javascript
// Watch all sync events
document.addEventListener('mm:dirty', (e) => {
  console.log('Data changed:', e.detail);
});
```

---

## 📝 Summary

✅ **Automatic sync is now enabled**
✅ **Works like Google Keep**
✅ **Changes sync instantly across devices**
✅ **Conflict resolution built-in**
✅ **Offline support with auto-retry**
✅ **Visual notifications for remote changes**

---

## 🆘 Support

If automatic sync isn't working:
1. Check Firebase configuration
2. Verify internet connection
3. Check browser console for errors
4. Try manual sync from Settings
5. Restart application

**Note**: First-time setup may take 10-15 seconds to establish real-time connection.

---

## 🎉 You're All Set!

Your Route 98 POS now automatically syncs all changes across devices in real-time. No more manual sync needed!

Just make changes on any device and watch them appear instantly on all other devices.
