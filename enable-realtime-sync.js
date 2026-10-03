// ============================================================
// Enable Real-Time Sync - Run this in browser console
// ============================================================

console.log('%c🔄 Enabling Real-Time Sync...', 'font-size: 16px; font-weight: bold; color: #2563EB;');

(async function enableRealtimeSync() {
  try {
    // Step 1: Check current settings
    const settings = DB.getSettings();
    console.log('Current autoSync setting:', settings.autoSync);
    console.log('Firebase configured:', !!settings.firebaseConfig);

    // Step 2: Enable auto-sync if disabled
    if (!settings.autoSync) {
      console.log('%c⚙️ Auto-sync is DISABLED. Enabling now...', 'color: #F59E0B;');
      settings.autoSync = true;
      DB.setSettings(settings);
      console.log('%c✅ Auto-sync ENABLED!', 'color: #10B981; font-weight: bold;');
    } else {
      console.log('%c✅ Auto-sync is already enabled', 'color: #10B981;');
    }

    // Step 3: Check sync meta
    const meta = DB.getSyncMeta();
    console.log('Sync meta:', meta);

    // Step 4: Force initial push to update lastSynced
    console.log('%c📤 Pushing current data to Firestore...', 'color: #2563EB; font-weight: bold;');
    await Sync.pushSnapshot(true);
    console.log('%c✅ Push complete!', 'color: #10B981; font-weight: bold;');

    // Step 5: Start realtime listener for live updates
    console.log('%c👂 Starting realtime listener for live updates...', 'color: #2563EB; font-weight: bold;');
    await Sync.startRealtimeListener();
    console.log('%c✅ Realtime listener active!', 'color: #10B981; font-weight: bold;');

    // Step 6: Update sync pill
    Sync.paintStatus();
    console.log('%c🎉 DONE! Real-time sync is now active!', 'font-size: 18px; color: #10B981; font-weight: bold;');
    console.log('%c📊 Status: Check the sync pill in sidebar (should say "Synced just now")', 'color: #6B7280;');
    console.log('%c🔄 Changes will now sync automatically across all devices!', 'color: #6B7280;');

    // Show final status
    setTimeout(() => {
      const newMeta = DB.getSyncMeta();
      console.log('%c📊 Final Sync Status:', 'font-weight: bold;');
      console.table({
        'Auto-Sync': settings.autoSync ? '✅ Enabled' : '❌ Disabled',
        'Last Synced': newMeta.lastSynced ? new Date(newMeta.lastSynced).toLocaleString() : 'Never',
        'Status': newMeta.status || 'Ready',
        'Realtime': 'Active'
      });
    }, 2000);

  } catch (error) {
    console.error('%c❌ Error enabling sync:', 'color: #DC2626; font-weight: bold;', error);
    console.log('%c💡 Try these steps:', 'color: #F59E0B; font-weight: bold;');
    console.log('1. Make sure you are logged in');
    console.log('2. Check browser console for Firebase errors');
    console.log('3. Verify Firebase rules allow read/write');
    console.log('4. Check network connection');
  }
})();
