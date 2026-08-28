const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'apps-script', 'admin-upload.gs'), 'utf8');

assert.match(source, /const HOME_SHEET = '00_INICIO'/, 'Debe existir la portada 00_INICIO');
assert.match(source, /function refreshHomeSheet\(\)/, 'Debe existir una actualización manual de la portada');
assert.match(source, /function ensureHomeSheet_\(ss\)/, 'Debe existir el generador idempotente');
assert.match(source, /ss\.moveActiveSheet\(1\)/, 'La portada debe quedar como primera pestaña');
assert.match(source, /setLinkUrl\(ss\.getUrl\(\) \+ '#gid='/, 'Cada tarjeta debe navegar a su pestaña');
assert.match(source, /name\.indexOf\(BACKUP_PREFIX\) !== 0/, 'Los respaldos deben excluirse de la portada');
assert.match(source, /ensureHomeSheet_\(ss\);\s*\n\s*return jsonResponse/, 'La portada debe refrescarse tras una publicación');

console.log('sheets-home-navigation.test.js: OK');
