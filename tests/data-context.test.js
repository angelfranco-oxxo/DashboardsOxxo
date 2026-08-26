const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const listeners = new Map();
const documentStub = {
  readyState: 'loading',
  body: null,
  head: { appendChild() {} },
  addEventListener(name, handler) { listeners.set(name, handler); },
  removeEventListener() {},
  dispatchEvent() {},
  getElementsByTagName() { return []; },
  getElementById() { return null; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement() { return { style: {}, dataset: {}, addEventListener() {}, remove() {} }; }
};
const sandbox = {
  console,
  document: documentStub,
  location: { pathname: '/admin.html', origin: 'https://example.test', href: 'https://example.test/admin.html' },
  history: { state: null, replaceState() {} },
  sessionStorage: { getItem() { return null; }, setItem() {} },
  localStorage: { getItem() { return null; }, setItem() {} },
  navigator: {},
  CustomEvent: function CustomEvent() {},
  URL,
  Request,
  Response,
  Blob,
  setTimeout,
  clearTimeout,
  Map,
  Set,
  Date,
  Promise
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/config.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/core.js'), 'utf8'), sandbox);

const { OXXO } = sandbox;
const context = OXXO.getDataContext();
assert.equal(context.plaza, 'Plaza Oaxaca');
assert.equal(context.region, 'Oaxaca');
assert.equal(context.plazaId, 'PLAZA-OAXACA');

const completed = OXXO.applyDataContextDefaults(
  { Region: '', Plaza: '', Zona: '', 'CR TIENDA': ' 50-i34 ' },
  { columns: ['Region', 'Plaza', 'Zona', 'CR TIENDA'] }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(completed)),
  { Region: 'Oaxaca', Plaza: 'Plaza Oaxaca', Zona: '', 'CR TIENDA': '50I34' }
);

const preserved = OXXO.applyDataContextDefaults(
  { Region: 'Sur', Plaza: 'Otra plaza', CR: ' ab-123 ' },
  { columns: ['Region', 'Plaza', 'CR'] }
);
assert.equal(preserved.Region, 'Sur');
assert.equal(preserved.Plaza, 'Otra plaza');
assert.equal(preserved.CR, 'AB123');

const untouched = OXXO.applyDataContextDefaults({ Tienda: 'Centro' });
assert.deepEqual(JSON.parse(JSON.stringify(untouched)), { Tienda: 'Centro' });

// El formato historico del catalogo (solo ASESOR, TIENDA y CR TIENDA) debe
// seguir siendo valido; las columnas nuevas se completan sin pedir cambios al
// Excel que hoy usa Plaza Oaxaca.
vm.runInContext(fs.readFileSync(path.join(root, 'js/admin/column-aliases.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/admin/normalizers.js'), 'utf8'), sandbox);
const aliases = sandbox.OXXO_ADMIN_COLUMN_ALIASES;
const state = { fileName: 'catalogo.xlsx', sheetName: 'Hoja1', workbook: null, sheetMatrixCache: new Map() };
const norm = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim().replace(/\s+/g, '');
const normLoose = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const aliasesFor = (column) => [column, ...(aliases[column] || [])].map(norm);
let catalogDashboard;
const normalizers = sandbox.OXXO_ADMIN_NORMALIZERS({
  state, norm, normLoose, aliasesFor,
  dashboard: () => catalogDashboard,
  $: () => ({ value: '' })
});
catalogDashboard = {
  output: ['ASESOR', 'TIENDA', 'CR TIENDA', 'Region', 'Plaza', 'Zona', 'ACTIVA'],
  required: ['ASESOR', 'TIENDA', 'CR TIENDA'],
  derive: normalizers.deriveCatalog,
  filter: (row) => Boolean(row.ASESOR && row.TIENDA && row['CR TIENDA'])
};
const parsed = normalizers.rowsFromMatrix([
  ['ASESOR', 'TIENDA', 'CR TIENDA'],
  ['Marisela Munoz', 'OXXO Centro', ' 50-i34 ']
], catalogDashboard);
assert.equal(parsed.rows.length, 1);
assert.deepEqual(JSON.parse(JSON.stringify(parsed.rows[0])), {
  ASESOR: 'Marisela Munoz', TIENDA: 'OXXO Centro', 'CR TIENDA': '50I34',
  Region: 'Oaxaca', Plaza: 'Plaza Oaxaca', Zona: '', ACTIVA: 'SI'
});

console.log('data-context: 5 pruebas correctas');
