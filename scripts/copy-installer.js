// Copie l'installeur final à la racine du projet.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const exe = fs.readdirSync(dist).find((f) => /Setup.*\.exe$/i.test(f) && !/uninstaller/i.test(f));
if (!exe) { console.error('Installeur introuvable dans dist/'); process.exit(1); }
fs.copyFileSync(path.join(dist, exe), path.join(root, exe));
console.log('Installeur copié à la racine :', exe);
