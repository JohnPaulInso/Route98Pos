const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '..');
const outDir = path.resolve(__dirname, '..', 'www');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const copyRecursive = (src, dest) => {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(child => {
      copyRecursive(path.join(src, child), path.join(dest, child));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
};

const itemsToCopy = ['css', 'js', 'index.html', 'manifest.json', 'sw.js', 'route98_logo.png', 'icon.png', 'icon.svg', 'logo.png'];

itemsToCopy.forEach(item => {
  const itemPath = path.join(srcDir, item);
  if (fs.existsSync(itemPath)) {
    copyRecursive(itemPath, path.join(outDir, item));
  }
});

console.log('Web assets successfully compiled to www/');
// (2026-07-13) Auto-sync Route 98 icons during build; was web assets only
try { require('./copy_icons'); } catch(e) {}
