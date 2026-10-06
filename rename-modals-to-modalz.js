#!/usr/bin/env node
/**
 * Rename all modal-related identifiers by adding "z" suffix
 * This script performs a comprehensive refactoring across the entire codebase
 */

const fs = require('fs');
const path = require('path');

// Define all the replacements needed
const replacements = [
  // CSS Classes (most specific first to avoid partial matches)
  { from: /\.modal-backdrop/g, to: '.modal-backdropz' },
  { from: /\.modal-closing/g, to: '.modal-closingz' },
  { from: /\.modal-product-form-backdrop/g, to: '.modal-product-form-backdropz' },
  { from: /\.modal-loy-dialog-backdrop/g, to: '.modal-loy-dialog-backdropz' },
  { from: /\.modal-receipt-dialog/g, to: '.modal-receipt-dialogz' },
  { from: /\.modal-product-form/g, to: '.modal-product-formz' },
  { from: /\.modal-loy-dialog/g, to: '.modal-loy-dialogz' },
  { from: /\.modal-product-history/g, to: '.modal-product-historyz' },
  { from: /\.modal-slide-left/g, to: '.modal-slide-leftz' },
  { from: /\.modal-wide/g, to: '.modal-widez' },
  { from: /\.modal-head/g, to: '.modal-headz' },
  { from: /\.modal-body/g, to: '.modal-bodyz' },
  { from: /\.modal-foot/g, to: '.modal-footz' },
  { from: /\.modal-wrap/g, to: '.modal-wrapz' },
  { from: /\.modal(?![\w-])/g, to: '.modalz' }, // .modal but not .modal-something
  
  // Class names in className assignments (JavaScript strings)
  { from: /"modal-backdrop/g, to: '"modal-backdropz' },
  { from: /'modal-backdrop/g, to: "'modal-backdropz" },
  { from: /"modal-closing/g, to: '"modal-closingz' },
  { from: /'modal-closing/g, to: "'modal-closingz" },
  { from: /"modal-wide/g, to: '"modal-widez' },
  { from: /'modal-wide/g, to: "'modal-widez" },
  { from: /"modal-head/g, to: '"modal-headz' },
  { from: /"modal-body/g, to: '"modal-bodyz' },
  { from: /"modal-foot/g, to: '"modal-footz' },
  { from: /"modal"/g, to: '"modalz"' },
  { from: /'modal'/g, to: "'modalz'" },
  
  // IDs
  { from: /#modal-x/g, to: '#modal-xz' },
  { from: /id="modal-x"/g, to: 'id="modal-xz"' },
  { from: /id='modal-x'/g, to: "id='modal-xz'" },
  { from: /#modal-root/g, to: '#modal-rootz' },
  
  // JavaScript variables and functions
  { from: /\bModal\./g, to: 'Modalz.' }, // Modal.open, Modal.close
  { from: /window\.Modal/g, to: 'window.Modalz' },
  { from: /const Modal =/g, to: 'const Modalz =' },
  { from: /\bModal\s*\(/g, to: 'Modalz(' },
  { from: /typeof Modal/g, to: 'typeof Modalz' },
  
  // Object properties
  { from: /modalOpen/g, to: 'modalOpenz' },
  { from: /modalClass/g, to: 'modalClassz' },
  { from: /modalId/g, to: 'modalIdz' },
  
  // HTML attributes and data attributes
  { from: /modal-open/g, to: 'modal-openz' },
  { from: /scroll-locked/g, to: 'scroll-lockedz' }, // Related to modal
];

// Files and directories to process
const filesToProcess = [
  // JavaScript files
  'www/js/modal.js',
  'www/js/auth.js',
  'www/js/barcode.js',
  'www/js/mobile-touch-fix.js',
  'www/js/uiselect.js',
  'www/js/shift.js',
  'www/js/reports.js',
  'www/js/inventory.js',
  'www/js/csv-importer.js',
  'www/js/inventory-importer.js',
  'www/js/pos.js',
  'www/js/app.js',
  'www/js/gasoline.js',
  'www/js/venue.js',
  'www/js/restaurant.js',
  'www/js/expenses.js',
  'www/js/dashboard.js',
  'www/js/settings.js',
  
  // CSS files
  'css/base.css',
  'css/views.css',
  'css/mobile.css',
  'css/mobile-fixes.css',
  'css/dropdown-fix.css',
  'www/css/base.css',
  'www/css/views.css',
  'www/css/mobile.css',
  'www/css/mobile-fixes.css',
  'www/css/dropdown-fix.css',
  
  // HTML files
  'www/index.html',
  'index.html',
  
  // Test files
  'test-modal.html',
];

let totalReplacements = 0;
let filesModified = 0;

filesToProcess.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipped (not found): ${filePath}`);
    return;
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let fileReplacements = 0;
    
    replacements.forEach(({ from, to }) => {
      const matches = content.match(from);
      if (matches) {
        content = content.replace(from, to);
        fileReplacements += matches.length;
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      filesModified++;
      totalReplacements += fileReplacements;
      console.log(`✅ ${filePath} - ${fileReplacements} replacements`);
    } else {
      console.log(`   ${filePath} - no changes`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
});

console.log('\n' + '='.repeat(50));
console.log(`✅ COMPLETE!`);
console.log(`Files modified: ${filesModified}`);
console.log(`Total replacements: ${totalReplacements}`);
console.log('='.repeat(50));
console.log('\nNext steps:');
console.log('1. Review changes: git diff');
console.log('2. Test in browser');
console.log('3. Build and test APK: npm run build && npx cap sync android');
