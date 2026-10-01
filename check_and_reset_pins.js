// Debug script - Run in browser console to check and reset PINs
// Copy and paste this entire script into your browser console

(function() {
  console.log("=== CHECKING USER PINS ===");
  
  const users = DB.getUsers();
  console.log("\n📋 Current Users and their PINs:");
  users.forEach(u => {
    console.log(`${u.role === 'admin' ? '👑' : '👤'} ${u.name} (${u.role}): PIN = ${u.pin}`);
  });
  
  // Check if Niño exists
  const nino = users.find(u => u.name.toLowerCase().includes('niño') || u.name.toLowerCase().includes('nino'));
  
  if (nino) {
    console.log(`\n✅ Niño found: ID = ${nino.id}, Current PIN = ${nino.pin}`);
    
    // Offer to reset Niño's PIN to 2222
    const reset = confirm(`Current PIN for Niño is: ${nino.pin}\n\nDo you want to reset Niño's PIN to 2222?`);
    
    if (reset) {
      const updatedUsers = users.map(u => {
        if (u.id === nino.id) {
          return { ...u, pin: '2222' };
        }
        return u;
      });
      
      DB.setUsers(updatedUsers);
      console.log("✅ Niño's PIN has been reset to 2222");
      Utils.toast("Niño's PIN reset to 2222", "success", 3000);
      
      // Verify the change
      const verifyUsers = DB.getUsers();
      const verifyNino = verifyUsers.find(u => u.id === nino.id);
      console.log(`\n✅ Verification: Niño's new PIN = ${verifyNino.pin}`);
    } else {
      console.log("❌ PIN reset cancelled");
    }
  } else {
    console.error("❌ Niño not found in users database!");
    console.log("\n📋 Available users:");
    users.forEach(u => console.log(`  - ${u.name}`));
  }
  
  console.log("\n=== RESET ALL DEFAULT PINS ===");
  console.log("To reset all PINs to defaults, run: resetAllPINs()");
  
  // Make reset function available globally
  window.resetAllPINs = function() {
    const defaultPins = {
      'u_admin': '1234',
      'u_jp': '3333',
      'u_sharon': '4444',
      'u_ike': '5555',
      'u_rosella': '1111',
      'u_nino': '2222'
    };
    
    const users = DB.getUsers();
    const updated = users.map(u => {
      if (defaultPins[u.id]) {
        return { ...u, pin: defaultPins[u.id] };
      }
      return u;
    });
    
    DB.setUsers(updated);
    console.log("✅ All PINs reset to defaults:");
    console.log("  Owner/Admin: 1234");
    console.log("  JP: 3333");
    console.log("  Sharon: 4444");
    console.log("  Elaicka/Ike: 5555");
    console.log("  Rosella: 1111");
    console.log("  Niño: 2222");
    
    Utils.toast("All PINs reset to defaults!", "success", 3000);
  };
  
  console.log("\n=== HOW TO USE ===");
  console.log("1. Check the PINs listed above");
  console.log("2. Try logging in with the displayed PIN");
  console.log("3. If still not working, run: resetAllPINs()");
  
})();
