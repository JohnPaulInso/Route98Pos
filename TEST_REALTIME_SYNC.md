# How to Test Real-Time Sync

## Quick Test (5 minutes)

### Setup
1. Open your app in **2 browser windows** (or use Incognito mode for the 2nd window)
2. Login to both windows with the same account
3. Place windows side-by-side so you can see both

---

## Test 1: Product Sync ✅

**Window 1:**
1. Go to Inventory
2. Click "Add Product"
3. Enter: Name = "Test Sync Product", Price = 10, Stock = 5
4. Click Save

**Window 2:**
- **Expected:** You should see a toast "Inventory updated from another device"
- **Expected:** The product list should refresh and show "Test Sync Product"

**Window 1:**
1. Edit "Test Sync Product" → Change price to 15
2. Click Save

**Window 2:**
- **Expected:** Product price updates to 15

**Window 1:**
1. Delete "Test Sync Product"

**Window 2:**
- **Expected:** Product disappears from list

---

## Test 2: Restock Log Sync ✅

**Window 1:**
1. Go to Inventory
2. Find any product and click the "Adjust Stock" button
3. Add +10 units with reason "Test Sync"
4. Click Save

**Window 2:**
1. Go to Reports → Restock Log
- **Expected:** You should see the restock entry appear instantly
- **Expected:** Toast notification about restock logs update

**Window 1:**
1. In Reports → Restock Log
2. Delete the "Test Sync" entry

**Window 2:**
- **Expected:** Entry disappears from restock log
- **Expected:** Product stock rolls back automatically

---

## Test 3: Expense Sync ✅

**Window 1:**
1. Go to Expenses
2. Click "Record Expense"
3. Enter: Category = "Other", Amount = 100, Description = "Test Sync Expense"
4. Click Save

**Window 2:**
1. Go to Expenses (if not already there)
- **Expected:** You should see the expense appear instantly
- **Expected:** Toast notification "Expenses updated from another device"

**Window 1:**
1. Delete "Test Sync Expense"

**Window 2:**
- **Expected:** Expense disappears immediately

---

## Test 4: Shift Sync (Already Working) ✅

**Window 1:**
1. Go to Shift
2. Open a shift with Opening Cash = 500
3. Click "Open Shift"

**Window 2:**
- **Expected:** Toast "Shift opened on another device"
- **Expected:** Shift status in topbar shows "Shift Open"
- **Expected:** If on Shift page, it refreshes to show the open shift

**Window 1:**
1. Add Cash In of 100
2. Click Save

**Window 2:**
- **Expected:** Cash In value updates to 100

---

## What You Should See

### ✅ Success Indicators:
- Toast notifications appear on the other device
- Changes appear within 1-2 seconds
- UI automatically refreshes
- No need to manually refresh the page

### ❌ Problems to Watch For:
- If nothing syncs → Check Firebase is configured in Settings
- If sync is slow (>5 seconds) → Check internet connection
- If sync works once then stops → Check browser console for errors

---

## Advanced Tests

### Test Offline Mode
1. On Window 2: Open DevTools → Network tab → Set to "Offline"
2. On Window 1: Add a product
3. On Window 2: Go back online
4. **Expected:** Product should appear when connection is restored

### Test Multiple Devices
1. Open app on your phone
2. Open app on your computer
3. Make changes on phone → Should appear on computer instantly

### Test Simultaneous Changes
1. On both windows: Open the same product for editing
2. Window 1: Change price to 10
3. Window 2: Change price to 20 (slower)
4. **Expected:** Last save wins (timestamp-based conflict resolution)

---

## Console Logs to Check

Open DevTools Console (F12) and look for:

```
✅ Realtime Sync initialized
✅ Synced product [ProductName] to cloud
[RealtimeSync] Product updated from cloud: [ProductName]
✅ Synced restock log to cloud
✅ Synced expense to cloud
[RealtimeSync] Expenses updated from another device
```

If you see errors like:
```
Failed to sync product: [error]
Firebase not configured
```
Then check your Firebase settings in the app.

---

## Troubleshooting

### Sync Not Working?

1. **Check Firebase Config:**
   - Go to Settings → Firebase Configuration
   - Make sure all fields are filled

2. **Check Browser Console:**
   - Press F12
   - Look for errors in red

3. **Check Network:**
   - Make sure you have internet connection
   - Firebase Realtime Database requires internet

4. **Clear Cache:**
   - Sometimes browsers cache old JS files
   - Press Ctrl+Shift+R to hard refresh

5. **Check Multiple Tabs:**
   - Make sure you're logged in with the same account
   - Some browsers block cross-tab communication

---

## Expected Behavior Summary

| Action | Device 1 | Device 2 | Sync Time |
|--------|----------|----------|-----------|
| Add Product | Saves locally | Receives update | 1-2 seconds |
| Edit Product | Saves locally | Receives update | 1-2 seconds |
| Delete Product | Removes locally | Removes item | 1-2 seconds |
| Add Restock | Saves locally | Receives update | 1-2 seconds |
| Delete Restock | Removes locally | Removes item + rolls back stock | 1-2 seconds |
| Add Expense | Saves locally | Receives update | 1-2 seconds |
| Delete Expense | Removes locally | Removes item | 1-2 seconds |
| Open Shift | Saves locally | Receives update + toast | 1-2 seconds |
| Close Shift | Saves locally | Receives update + toast | 1-2 seconds |

---

## FAQ

**Q: Why does sync take 1-2 seconds?**  
A: Firebase Realtime Database propagation time + network latency. This is normal.

**Q: What if I make changes offline?**  
A: Changes save locally first, then sync when connection is restored.

**Q: Can two devices edit the same item simultaneously?**  
A: Yes, but last save wins. The most recent update (by timestamp) is kept.

**Q: Do I need to manually refresh?**  
A: No! The app automatically listens for changes and refreshes the UI.

**Q: What if sync fails?**  
A: Changes are still saved locally. They'll sync when connection is restored.

**Q: Is there a sync indicator?**  
A: Yes! Toast notifications appear when data is synced from other devices.

---

## Success Criteria

Your real-time sync is working correctly if:

✅ Changes appear on other devices within 1-2 seconds  
✅ Toast notifications appear when data syncs  
✅ UI automatically refreshes (no manual refresh needed)  
✅ Works across different browsers (Chrome, Edge, Firefox)  
✅ Works in incognito mode  
✅ Works on mobile devices  
✅ Works after going offline and back online  

If all tests pass, your real-time sync is working perfectly! 🎉
