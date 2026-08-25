const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const resDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'res');
const logoSrc = path.join(rootDir, 'route98_logo.png');

if (!fs.existsSync(logoSrc)) {
  console.error('route98_logo.png not found at root');
  process.exit(1);
}

const mipmapFolders = [
  'mipmap-hdpi',
  'mipmap-mdpi',
  'mipmap-xhdpi',
  'mipmap-xxhdpi',
  'mipmap-xxxhdpi'
];

mipmapFolders.forEach(folder => {
  const targetDir = path.join(resDir, folder);
  if (fs.existsSync(targetDir)) {
    fs.copyFileSync(logoSrc, path.join(targetDir, 'ic_launcher.png'));
    fs.copyFileSync(logoSrc, path.join(targetDir, 'ic_launcher_round.png'));
    fs.copyFileSync(logoSrc, path.join(targetDir, 'ic_launcher_foreground.png'));
  }
});

const drawableFolders = [
  'drawable',
  'drawable-land-hdpi',
  'drawable-land-mdpi',
  'drawable-land-xhdpi',
  'drawable-land-xxhdpi',
  'drawable-land-xxxhdpi',
  'drawable-port-hdpi',
  'drawable-port-mdpi',
  'drawable-port-xhdpi',
  'drawable-port-xxhdpi',
  'drawable-port-xxxhdpi'
];

drawableFolders.forEach(folder => {
  const targetDir = path.join(resDir, folder);
  if (fs.existsSync(targetDir)) {
    fs.copyFileSync(logoSrc, path.join(targetDir, 'splash.png'));
  }
});

console.log('Route 98 app launcher icons and splash screens successfully updated.');
