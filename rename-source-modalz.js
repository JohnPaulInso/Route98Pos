#!/usr/bin/env node
/**
 * Rename all modal-related identifiers in source js/ dir by adding "z" suffix.
 * Targets the src js/ directory (build copies to www/).
 */
const fs = require('fs');

// Files to process in source js/ directory
const filesToProcess = [
  'js/modal.js',
  'js/auth.js',
  'js/barcode.js',
  'js/mobile-touch-fix.js',
  'js/uiselect.js',
  'js/shift.js',
  'js/reports.js',
  'js/inventory.js',
  'js/csv-importer.js',
  'js/inventory-importer.js',
  'js/pos.js',
  'js/app.js',
  'js/gasoline.js',
  'js/venue.js',
  'js/restaurant.js',
  'js/expenses.js',
  'js/dashboard.js',
  'js/settings.js',
  'js/mobile.js',
  'js/importExport.js',
  'js/analytics.js',
];

// Ordered replacements: most-specific first to avoid cascading double-replaces
const replacements = [
  // --- JS object/variable (const Modal = / window.Modal / Modal. / typeof Modal) ---
  { from: /\bconst Modal\s*=/g,     to: 'const Modalz =' },
  { from: /window\.Modal\b/g,       to: 'window.Modalz' },
  { from: /typeof Modal\b/g,        to: 'typeof Modalz' },
  { from: /\bModal\.(open|close|confirm|handleUniversalBack)\b/g, to: 'Modalz.$1' },

  // --- CSS class selectors (most-specific first) ---
  // Already-renamed dual selectors — collapse to z-only
  { from: /\.modal-backdrop:not\(\.modal-closing\),\s*\.modal-backdropz:not\(\.modal-closingz\)/g,
    to: '.modal-backdropz:not(.modal-closingz)' },
  { from: /\.modal-backdrop,\s*\.modal-backdropz/g, to: '.modal-backdropz' },
  { from: /\.modal-backdrop\b(?!z)/g, to: '.modal-backdropz' },
  { from: /\.modal-closingz\b/g, to: '.modal-closingz' }, // already done, idempotent guard
  { from: /\.modal-closing\b(?!z)/g, to: '.modal-closingz' },
  { from: /\.modal-product-form\b(?!z)/g, to: '.modal-product-formz' },
  { from: /\.modal-loy-dialog\b(?!z)/g, to: '.modal-loy-dialogz' },
  { from: /\.modal-receipt-dialog\b(?!z)/g, to: '.modal-receipt-dialogz' },
  { from: /\.modal-product-history\b(?!z)/g, to: '.modal-product-historyz' },
  { from: /\.modal-slide-left\b(?!z)/g, to: '.modal-slide-leftz' },
  { from: /\.modal-wide\b(?!z)/g, to: '.modal-widez' },
  { from: /\.modal-head\b(?!z)/g, to: '.modal-headz' },
  { from: /\.modal-body\b(?!z)/g, to: '.modal-bodyz' },
  { from: /\.modal-foot\b(?!z)/g, to: '.modal-footz' },
  { from: /\.modal-wrap\b(?!z)/g, to: '.modal-wrapz' },
  { from: /\.modal\b(?![z\w-])/g, to: '.modalz' },

  // --- String class names in querySelector / classList (already-z dual → z-only) ---
  { from: /"\.modal-backdrop,\s*\.modal-backdropz"/g, to: '".modal-backdropz"' },
  { from: /"\.modal-backdrop"\s*\|\|\s*document\.querySelector\("\.modal"\)/g,
    to: '".modal-backdropz" || document.querySelector(".modalz")' },

  // querySelector string literals
  { from: /querySelector\('\.modal-backdrop'\)/g, to: "querySelector('.modal-backdropz')" },
  { from: /querySelector\("\.modal-backdrop"\)/g, to: 'querySelector(".modal-backdropz")' },
  { from: /querySelector\('\.modal'\)/g, to: "querySelector('.modalz')" },
  { from: /querySelector\("\.modal"\)/g, to: 'querySelector(".modalz")' },
  { from: /querySelector\("\.modal,\s*\.modalz"\)/g, to: 'querySelector(".modalz")' },
  { from: /querySelector\("\.modal-backdrop,\s*\.modal,\s*\.modal-wrap"\)/g,
    to: 'querySelector(".modal-backdropz, .modalz, .modal-wrapz")' },
  { from: /querySelector\("\.modal-foot\s+/g, to: 'querySelector(".modal-footz ' },
  { from: /querySelectorAll\('\.modal-body[^']*'\)/g, to: (m) => m.replace(/\.modal-body\b(?!z)/g, '.modal-bodyz') },

  // classList remove/add string args
  { from: /"modal-backdrop"/g, to: '"modal-backdropz"' },
  { from: /'modal-backdrop'/g, to: "'modal-backdropz'" },
  { from: /"modal-closing"/g, to: '"modal-closingz"' },
  { from: /'modal-closing'/g, to: "'modal-closingz'" },

  // template literal class attrs
  { from: /class="modal modalz/g, to: 'class="modal modalz' }, // already renamed guard
  { from: /class="modal\s/g, to: 'class="modal modalz ' },
  { from: /class="modal-head\s/g, to: 'class="modal-head modal-headz ' },
  { from: /class="modal-body\s/g, to: 'class="modal-body modal-bodyz ' },
  { from: /class="modal-foot\s/g, to: 'class="modal-foot modal-footz ' },

  // --- IDs ---
  { from: /id="modal-x"(?!z)/g, to: 'id="modal-xz"' },
  { from: /#modal-x"(?!z)/g, to: '#modal-xz"' },
  { from: /getElementById\("modal-x"\)(?!z)/g, to: 'getElementById("modal-xz")' },
  { from: /"#modal-x(?!z)"/g, to: '"#modal-xz"' },
  { from: /'#modal-x(?!z)'/g, to: "'#modal-xz'" },

  // --- modal* JS identifiers in strings/objects ---
  { from: /modalClass:\s*"modal-product-form"(?!z)/g, to: 'modalClass: "modal-product-formz"' },
  { from: /modalClass:\s*"modal-product-history"(?!z)/g, to: 'modalClass: "modal-product-historyz"' },
  { from: /modalClass:\s*"modal-slide-left"(?!z)/g, to: 'modalClass: "modal-slide-leftz"' },
  { from: /modalClass:\s*"modal-receipt-dialog(?!z)/g, to: 'modalClass: "modal-receipt-dialogz' },
  { from: /modalClass:\s*"modal-loy-dialog(?!z)/g, to: 'modalClass: "modal-loy-dialogz' },

  // --- querySelector(".modal") inside modal context (inventory.js / reports.js) ---
  { from: /\.querySelector\("\.modal"\)(?!z)/g, to: '.querySelector(".modalz")' },
  { from: /\.querySelector\("\.modal-body"\)(?!z)/g, to: '.querySelector(".modal-bodyz")' },
  { from: /\.querySelector\('\.modal'\)(?!z)/g, to: ".querySelector('.modalz')" },
  { from: /\.querySelector\('\.modal-body'\)(?!z)/g, to: ".querySelector('.modal-bodyz')" },

  // --- classList.add/remove strings for modal-loy-dialog ---
  { from: /classList\.add\("modal-loy-dialog"\)(?!z)/g, to: 'classList.add("modal-loy-dialogz")' },

  // --- modal-open body class ---
  { from: /"modal-open"(?!z)/g, to: '"modal-openz"' },
  { from: /'modal-open'(?!z)/g, to: "'modal-openz'" },

  // --- typeof Modal ---
  { from: /typeof Modal\b/g, to: 'typeof Modalz' },

  // --- Mobile touch fix: getM() returns Modal ---
  { from: /typeof Modal !== 'undefined' \? Modal : \(window\.Modal \|\| null\)/g,
    to: "typeof Modalz !== 'undefined' ? Modalz : (window.Modalz || null)" },
  { from: /\.modal-backdrop\s*\{/g, to: '.modal-backdropz {' },
  { from: /querySelector\('\.modal'\)/g, to: "querySelector('.modalz')" },

  // --- window.Modal assignment at end of modal.js ---
  { from: /window\.Modal\s*=\s*Modal;/g, to: 'window.Modalz = Modalz;' },
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
    const original = content;
    let fileReplacements = 0;

    replacements.forEach(({ from, to }) => {
      if (typeof to === 'function') {
        const matches = content.match(from);
        if (matches) {
          content = content.replace(from, to);
          fileReplacements += matches.length;
        }
      } else {
        const before = content;
        content = content.replace(from, to);
        if (content !== before) fileReplacements++;
      }
    });

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      filesModified++;
      totalReplacements += fileReplacements;
      console.log(`✅ ${filePath} — ${fileReplacements} change-passes`);
    } else {
      console.log(`   ${filePath} — no changes`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
});

console.log('\n' + '='.repeat(50));
console.log(`✅ COMPLETE! Files modified: ${filesModified}`);
console.log('='.repeat(50));
