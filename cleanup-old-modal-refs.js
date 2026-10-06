#!/usr/bin/env node
/**
 * Clean up remaining old Modal references that were mixed with new ones
 */

const fs = require('fs');

const fixes = [
  // modal.js - Fix mixed selectors
  {
    file: 'www/js/modal.js',
    replacements: [
      {
        from: 'const Modal = (() => {',
        to: 'const Modalz = (() => {'
      },
      {
        from: 'window.Modal = Modal;',
        to: 'window.Modalz = Modalz;'
      },
      {
        from: '".modal-backdrop:not(.modal-closing), .modal-backdropz:not(.modal-closingz)"',
        to: '".modal-backdropz:not(.modal-closingz)"'
      },
      {
        from: '".modal-backdrop, .modal-backdropz"',
        to: '".modal-backdropz"'
      }
    ]
  },
  
  // auth.js - Fix modal check
  {
    file: 'www/js/auth.js',
    replacements: [
      {
        from: 'document.querySelector(".modal-backdrop") || document.querySelector(".modal")',
        to: 'document.querySelector(".modal-backdropz") || document.querySelector(".modalz")'
      }
    ]
  },
  
  // barcode.js - Fix modal check
  {
    file: 'www/js/barcode.js',
    replacements: [
      {
        from: '".modal-backdrop, .modal, .modal-wrap"',
        to: '".modal-backdropz, .modalz, .modal-wrapz"'
      }
    ]
  },
  
  // csv-importer.js - Fix modal selector
  {
    file: 'www/js/csv-importer.js',
    replacements: [
      {
        from: "document.querySelector('.modal-backdrop')",
        to: "document.querySelector('.modal-backdropz')"
      }
    ]
  },
  
  // inventory-importer.js - Fix modal selector
  {
    file: 'www/js/inventory-importer.js',
    replacements: [
      {
        from: "document.querySelector('.modal-backdrop')",
        to: "document.querySelector('.modal-backdropz')"
      }
    ]
  },
  
  // mobile-touch-fix.js - Fix Modal reference
  {
    file: 'www/js/mobile-touch-fix.js',
    replacements: [
      {
        from: "(typeof Modal !== 'undefined' ? Modal : (window.Modal || null))",
        to: "(typeof Modalz !== 'undefined' ? Modalz : (window.Modalz || null))"
      },
      {
        from: '.modal-backdrop {',
        to: '.modal-backdropz {'
      }
    ]
  },
  
  // uiselect.js - Fix modal checks
  {
    file: 'www/js/uiselect.js',
    replacements: [
      {
        from: '".modal-backdrop, .modal-backdropz"',
        to: '".modal-backdropz"'
      }
    ]
  }
];

let totalFixed = 0;
let filesFixed = 0;

fixes.forEach(({ file, replacements }) => {
  if (!fs.existsSync(file)) {
    console.log(`⚠️  Skipped (not found): ${file}`);
    return;
  }
  
  try {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;
    let fileFixCount = 0;
    
    replacements.forEach(({ from, to }) => {
      if (content.includes(from)) {
        content = content.replaceAll(from, to);
        fileFixCount++;
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(file, content, 'utf8');
      filesFixed++;
      totalFixed += fileFixCount;
      console.log(`✅ ${file} - ${fileFixCount} fixes applied`);
    } else {
      console.log(`   ${file} - already clean`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error.message);
  }
});

console.log('\n' + '='.repeat(50));
console.log(`✅ CLEANUP COMPLETE!`);
console.log(`Files fixed: ${filesFixed}`);
console.log(`Total fixes: ${totalFixed}`);
console.log('='.repeat(50));
