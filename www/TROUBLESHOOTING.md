# 🔧 Troubleshooting Guide - Real-Time Sync

## Quick Diagnostics

### ✅ Is Everything Working?

Run this quick check in browser console (F12):

```javascript
// Check 1: Is DB loaded?
console.log('DB loaded:', typeof DB !== 'undefined');

// Check 2: Is RealtimeSync loaded?
console.log('RealtimeSync loaded:', typeof RealtimeSync !== 'undefined');

// Check 3: Is Firebase configured?
console.log('Firebase config:', DB.getSettings().firebaseConfig ? 'Yes' : 'No');

// Check 4: Device ID
console.log('Device ID:', RealtimeSync.getDeviceId());
```

**Expected Output:**
```
DB loaded: true
RealtimeSync loaded: true
Firebase config: Yes
Device ID: device_1234567890_abc123
```

---

## Common Issues & Solutions

### Issue 1: "DB is not defined"

**Error Message:**
```
Uncaught ReferenceError: DB is not defined
```

**Causes:**
- Scripts loaded out of order
- Browser cache has old files
- db.js failed to load

**Solutions:**

✅ **Solution 1: Hard Refresh**
```
Windows: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

✅ **Solution 2: Clear Browser Cache**
```
Chrome: Settings → Privacy → Clear browsing data
Edge: Settings → Privacy → Choose what to clear
Firefox: Options → Privacy → Clear Data
```

✅ **Solution 3: Check Script Order**
```html
<!-- In index.html, verify this order: -->
<script src="js/db.js"></script>           <!-- FIRST -->
<script src="js/realtime-sync.js"></script> <!-- AFTER -->
```

✅ **Solution 4: Force Reload All Scripts**
```
Close all browser tabs
Reopen app
Hard refresh (Ctrl+Shift+R)
```

---

### Issue 2: Sync Not Working

**Symptom:** Changes don't appear on other devices

**Diagnostic Steps:**

**Step 1: Check Firebase Configuration**
```
1. Go to Settings → Firebase Configuration
2. Verify all fields are filled:
   - API Key: AIza...
   - Auth Domain: project.firebaseapp.com
   - Database URL: https://project.firebaseio.com
   - Project ID: project-id
   - Storage Bucket: project.appspot.com
   - Messaging Sender ID: 123456789
   - App ID: 1:123...
```

**Step 2: Check Console for Errors**
```
Open Console (F12)
Look for errors in red
Common errors:
  - "Firebase not configured"
  - "Failed to initialize Realtime Sync"
  - "Permission denied"
```

**Step 3: Test Internet Connection**
```
In console, run:
fetch('https://www.google.com')
  .then(() => console.log('Internet: OK'))
  .catch(() => console.log('Internet: DOWN'));
```

**Step 4: Verify Same Account**
```
Window 1: Check logged in user
Window 2: Check logged in user
Must be SAME account!
```

**Solutions:**

✅ **If Firebase not configured:**
```
1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project
3. Project Settings → General
4. Scroll to "Your apps"
5. Copy Firebase configuration
6. Paste in app Settings
```

✅ **If internet down:**
```
Wait for connection to restore
Changes will sync automatically when online
```

✅ **If different accounts:**
```
Logout from one device
Login with same account as other device
```

---

### Issue 3: Slow Sync (>5 seconds)

**Symptom:** Changes take too long to appear

**Causes:**
- Slow internet connection
- Firebase free tier throttling
- Too many browser tabs open
- Heavy network traffic

**Solutions:**

✅ **Check Network Speed**
```
Run speed test: https://fast.com
Minimum recommended: 1 Mbps
```

✅ **Close Extra Tabs**
```
Each tab maintains Firebase connection
Close unnecessary tabs
Keep only 2-3 tabs for testing
```

✅ **Check Firebase Quota**
```
Firebase Console → Usage
Check:
  - Realtime Database connections
  - Data transfer
  - Operations per second

Free tier limits:
  - 100 simultaneous connections
  - 10 GB/month data transfer
  - 200 writes/second
```

✅ **Upgrade Network**
```
If possible:
  - Switch to faster WiFi
  - Use wired connection
  - Close background downloads
```

---

### Issue 4: Toast Notifications Not Showing

**Symptom:** No "...updated from another device" messages

**Causes:**
- Device ID not set correctly
- Utils.toast function broken
- Same device making changes (won't notify self)

**Diagnostic:**
```javascript
// In console:
console.log('Device ID:', RealtimeSync.getDeviceId());
console.log('Utils.toast exists:', typeof Utils.toast === 'function');

// Test toast:
Utils.toast('Test notification', 'info');
```

**Solutions:**

✅ **If Device ID same on both:**
```
Clear localStorage:
localStorage.removeItem('mm_deviceId');
Refresh page
New device ID will be generated
```

✅ **If Utils.toast broken:**
```
Check console for errors
Verify utils.js loaded
Hard refresh page
```

✅ **If testing on same device:**
```
Open 2 different browsers:
  - Chrome + Edge (not Chrome + Chrome)
Or use incognito mode
```

---

### Issue 5: Only Works Once, Then Stops

**Symptom:** First sync works, subsequent syncs fail

**Causes:**
- WebSocket connection dropped
- Firebase listener unsubscribed
- Browser throttling background tabs

**Diagnostic:**
```javascript
// Check if listeners still active:
console.log('Active listeners:', 
  typeof RealtimeSync !== 'undefined' && 
  RealtimeSync.unsubscribeAll
);

// Check Firebase connection:
// Look for WebSocket in Network tab
```

**Solutions:**

✅ **Refresh Both Windows**
```
Close both windows
Reopen both
Wait for initialization
Test again
```

✅ **Keep Windows Active**
```
Don't minimize windows
Don't switch away for long periods
Browsers throttle inactive tabs
```

✅ **Reconnect Firebase**
```
In console:
RealtimeSync.unsubscribeAll();
RealtimeSync.init().then(() => {
  RealtimeSync.subscribeToAllProducts();
  RealtimeSync.subscribeToRestockLogs();
  RealtimeSync.subscribeToExpenses();
});
```

---

### Issue 6: Changes Lost After Refresh

**Symptom:** Make change, refresh, change is gone

**Causes:**
- localStorage not saving
- Browser in private/incognito mode
- localStorage quota exceeded
- localStorage disabled

**Diagnostic:**
```javascript
// Check localStorage:
console.log('localStorage available:', 
  typeof localStorage !== 'undefined'
);

// Check quota:
console.log('localStorage size:', 
  JSON.stringify(localStorage).length
);

// Test write:
localStorage.setItem('test', 'value');
console.log('localStorage test:', 
  localStorage.getItem('test')
);
```

**Solutions:**

✅ **If in incognito mode:**
```
localStorage may be disabled in some browsers
Use normal browser mode for persistent storage
```

✅ **If quota exceeded:**
```
Clear old data:
localStorage.clear();
Refresh page
Re-login
```

✅ **If disabled:**
```
Check browser settings
Enable "Allow sites to save data"
Disable "Block third-party cookies"
```

---

### Issue 7: Duplicate Entries

**Symptom:** Same item appears multiple times

**Causes:**
- Sync running twice
- Listener not checking for duplicates
- Network retry creating duplicates

**Solutions:**

✅ **Refresh Both Devices**
```
Close all tabs
Clear browser cache
Reopen app
```

✅ **Manual Cleanup**
```
Go to Reports → Data Cleanup
Or manually delete duplicates
```

✅ **Check for Multiple Listeners**
```javascript
// In console:
RealtimeSync.unsubscribeAll();
// Wait 1 second
// Then re-subscribe:
RealtimeSync.subscribeToAllProducts();
```

---

## Advanced Debugging

### Enable Verbose Logging

Add to browser console:
```javascript
// Enable Firebase debug logging:
localStorage.setItem('debug', 'firebase:*');

// Reload page
location.reload();

// You'll now see detailed Firebase logs
```

### Monitor Firebase Connection

```javascript
// Check connection state:
const connectedRef = firebase.database().ref('.info/connected');
connectedRef.on('value', (snap) => {
  if (snap.val() === true) {
    console.log('✅ Firebase: Connected');
  } else {
    console.log('❌ Firebase: Disconnected');
  }
});
```

### Inspect Sync Data

```javascript
// View products in Firebase:
firebase.database().ref('products').once('value')
  .then(snapshot => {
    console.log('Firebase products:', snapshot.val());
  });

// View local products:
console.log('Local products:', DB.getProducts());

// Compare:
// Local should match Firebase
```

---

## Performance Issues

### Issue: High CPU Usage

**Causes:**
- Too many listeners
- Infinite sync loops
- Large data transfers

**Solutions:**

✅ **Limit Active Listeners**
```javascript
// Only subscribe to needed data:
if (App.currentView === 'inventory') {
  RealtimeSync.subscribeToAllProducts();
} else {
  // Unsubscribe when not needed
  RealtimeSync.unsubscribeAll();
}
```

✅ **Check for Loops**
```javascript
// In console, watch for repeated logs:
// If you see:
// "Synced product..."
// "Synced product..."
// "Synced product..."
// (repeating constantly)
// Then there's a loop!

// Fix: Refresh page
```

### Issue: High Data Usage

**Check Firebase Usage:**
```
Firebase Console → Realtime Database → Usage
Monitor data downloaded/uploaded
```

**Reduce Usage:**
```javascript
// Use selective syncing:
// Instead of syncing ALL products:
RealtimeSync.syncSingleProduct(product);
// Only sync the changed item
```

---

## Browser-Specific Issues

### Chrome
```
Issue: Works on desktop, not on mobile Chrome
Solution: Check mobile data connection
Solution: Enable "Desktop site" if needed
```

### Firefox
```
Issue: Slower sync than Chrome
Solution: Normal, Firefox WebSocket handling is slower
Solution: Accept 2-3 second delay instead of 1-2
```

### Safari (iOS)
```
Issue: Sync stops when tab inactive
Solution: Safari aggressively throttles background tabs
Solution: Keep app in foreground
```

### Edge
```
Issue: "SecurityError: The operation is insecure"
Solution: Check site is HTTPS (or localhost)
Solution: Allow localStorage in settings
```

---

## Emergency Reset

### If Everything Fails:

**Full Reset Procedure:**

```javascript
// 1. Clear all local data:
localStorage.clear();
sessionStorage.clear();

// 2. Unsubscribe all listeners:
if (typeof RealtimeSync !== 'undefined') {
  RealtimeSync.unsubscribeAll();
}

// 3. Clear browser cache:
// Chrome: Ctrl+Shift+Delete → Clear all

// 4. Close ALL browser tabs

// 5. Restart browser

// 6. Open app fresh

// 7. Login again

// 8. Reconfigure Firebase in Settings

// 9. Test sync with 2 windows
```

---

## Getting Help

### Information to Provide:

When reporting issues, include:

1. **Browser & Version**
   ```
   Chrome 120.0.6099.109
   ```

2. **Console Errors**
   ```
   Copy full error messages from console (F12)
   ```

3. **Steps to Reproduce**
   ```
   1. Open app
   2. Add product
   3. Check other device
   4. Product doesn't appear
   ```

4. **Network Tab**
   ```
   Screenshot of Network tab showing Firebase requests
   ```

5. **System Info**
   ```
   OS: Windows 11
   Internet: 50 Mbps WiFi
   ```

---

## Checklist Before Asking for Help

- [ ] Hard refreshed both browsers (Ctrl+Shift+R)
- [ ] Cleared browser cache
- [ ] Verified Firebase configured
- [ ] Checked console for errors
- [ ] Tested internet connection
- [ ] Tried different browser
- [ ] Tried incognito mode
- [ ] Read this troubleshooting guide
- [ ] Attempted emergency reset

---

## Success Indicators

When everything works correctly, you should see:

✅ Console shows:
```
✅ Realtime Sync initialized
✅ Device registered
✅ Subscribed to [feature] changes
```

✅ Changes appear on other devices within 1-2 seconds

✅ Toast notifications show on other devices

✅ No red errors in console

✅ Network tab shows active WebSocket connection

**If all above are true → Sync is working perfectly!** 🎉
