const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (file.endsWith('.ts') && !file.endsWith('.spec.ts')) {
        filelist.push(dirFile);
      }
    }
  });
  return filelist;
};

const files = walkSync('./src');
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes('Nama Aplikasi : tupp.ly')) {
    const filename = path.basename(file);
    const header = `/**
 * Nama Aplikasi : tupp.ly
 * Fungsi File   : File konfigurasi / logika bisnis untuk ${filename}
 * Pembuat       : Wahyu Suhandi
 * GitHub        : https://github.com/nodesapi
 */\n\n`;
    fs.writeFileSync(file, header + content);
  }
});
console.log('Headers added successfully!');
