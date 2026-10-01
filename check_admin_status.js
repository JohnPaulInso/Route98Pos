// Debug Script - Check Admin Status and View All PINs
// Paste this in your browser console (F12)

console.log("=== CHECKING ADMIN STATUS ===\n");

// Check current user
const currentUser = Auth.currentUser();
console.log("Current User:", currentUser);

// Check if admin
const isAdmin = Auth.isAdmin();
console.log("Is Admin?:", isAdmin);

if (!currentUser) {
  console.error("❌ YOU ARE NOT LOGGED IN!");
  console.log("\n📝 Steps to fix:");
  console.log("1. Close this console");
  console.log("2. Log in with admin credentials");
  console.log("3. Come back and run this script again");
} else if (!isAdmin) {
  console.error(`❌ YOU ARE LOGGED IN AS ${currentUser.name} (${currentUser.role})`);
  console.log("\n📝 You need to log in as an ADMIN to see current PINs");
  console.log("Admin accounts: Owner/Admin, JP, Sharon, Elaicka/Ike");
  console.log("\nSteps:");
  console.log("1. Log out (or refresh page)");
  console.log("2. Log in as an admin account");
} else {
  console.log(`✅ YOU ARE LOGGED IN AS ADMIN: ${currentUser.name}`);
  console.log("\n=== ALL USER PINS ===\n");
  
  const users = DB.getUsers();
  users.forEach(u => {
    const badge = u.role === 'admin' ? '👑' : '👤';
    console.log(`${badge} ${u.name.padEnd(20)} PIN: ${u.pin}`);
  });
  
  console.log("\n=== QUICK PIN REFERENCE ===");
  console.log("Owner/Admin: 1234");
  console.log("JP: 3333");
  console.log("Sharon: 4444");
  console.log("Elaicka/Ike: 5555");
  console.log("Rosella: 1111");
  console.log("Niño: 2222");
  
  console.log("\n✅ Since you're an admin, you should see the current PIN card in the Change PIN modal");
  console.log("If you don't see it, try:");
  console.log("1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)");
  console.log("2. Clear browser cache and reload");
}

// Also show current browser info
console.log("\n=== BROWSER INFO ===");
console.log("User Agent:", navigator.userAgent);
console.log("Cache Status: Check if hard refresh needed");
