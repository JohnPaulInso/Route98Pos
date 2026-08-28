const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const resDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'res');
const logoSrc = path.join(rootDir, 'route98_logo.png');

if (!fs.existsSync(logoSrc)) {
  console.error('route98_logo.png not found at root');
  process.exit(1);
}

// (2026-07-13) Generate padded white-bg launcher icons; prev: raw file copy
try {
  const { execSync } = require('child_process');
  const psScript = path.join(__dirname, 'process_icons.ps1');
  execSync(`powershell -ExecutionPolicy Bypass -File "${psScript}"`, { stdio: 'inherit' });
} catch(err) {
  console.warn('Icon processing fallback:', err.message);
}
