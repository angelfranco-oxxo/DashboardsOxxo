import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const memory = new Map();
const documentStub = {
  readyState: 'loading',
  documentElement: { dataset: {} },
  body: null,
  head: { appendChild() {} },
  addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
  getElementsByTagName() { return []; }, getElementById() { return null; },
  querySelector() { return null; }, querySelectorAll() { return []; },
  createElement() { return { style: {}, dataset: {}, addEventListener() {}, remove() {} }; }
};
const locationStub = {
  pathname: '/admin.html',
  origin: 'https://humanresources-oxxo.github.io',
  href: 'https://humanresources-oxxo.github.io/DashboardsOxxo/admin.html',
  search: ''
};
const nativeFetch = fetch;
const auditFetch = async (input, options) => {
  const value = typeof input === 'string' ? input : input?.url || '';
  if (value === 'assets/catalogo_asesores.csv') {
    return new Response(fs.readFileSync(path.join(root, 'assets/catalogo_asesores.csv'), 'utf8'), { status: 200 });
  }
  return nativeFetch(input, options);
};
const sandbox = {
  console,
  document: documentStub,
  location: locationStub,
  history: { state: null, replaceState() {} },
  sessionStorage: {
    getItem(key) { return memory.get(`session:${key}`) ?? null; },
    setItem(key, value) { memory.set(`session:${key}`, String(value)); }
  },
  localStorage: {
    getItem(key) { return memory.get(`local:${key}`) ?? null; },
    setItem(key, value) { memory.set(`local:${key}`, String(value)); }
  },
  navigator: {},
  CustomEvent: function CustomEvent() {},
  URL, URLSearchParams, Request, Response, Blob, TextDecoder, Uint8Array,
  AbortController, fetch: auditFetch,
  setTimeout, clearTimeout, setInterval, clearInterval,
  Map, Set, Date, Promise
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/config.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/core.js'), 'utf8'), sandbox);

const plazas = ['Plaza Oaxaca', 'Costa Istmo', 'Tuxtla', 'Villahermosa', 'Chontalpa'];
const results = [];

for (const plaza of plazas) {
  locationStub.search = `?scope=plaza&region=TABASCO&plaza=${encodeURIComponent(plaza)}`;
  locationStub.href = `https://humanresources-oxxo.github.io/DashboardsOxxo/admin.html${locationStub.search}`;
  const result = await sandbox.OXXO.metricsD1Rows();
  assert(result, `${plaza}: no fue posible leer Dashboard_1_Diario`);
  assert(result.rows.length > 0, `${plaza}: el pipeline vigente no devolvio vacantes`);
  assert.equal(result.mes, '2026-08', `${plaza}: el corte vigente no es agosto 2026`);

  const sample = result.rows[0];
  const plazaKey = sandbox.OXXO.metricsFindKey(sample, ['Plaza']);
  const adviserKey = sandbox.OXXO.metricsFindKey(sample, ['Asesor']);
  const storeKey = sandbox.OXXO.metricsFindKey(sample, ['Unidad org', 'Tienda']);
  const foreign = result.rows.filter((row) => !sandbox.OXXO.matchesScopeValue(
    sandbox.OXXO.metricsVal(row, plazaKey), 'plaza', sandbox.OXXO.getActiveDataScope()
  ));
  assert.equal(foreign.length, 0, `${plaza}: se mezclaron ${foreign.length} filas de otra plaza`);

  results.push({
    plaza,
    periodo: result.mes,
    vacantes: result.rows.length,
    tiendas: new Set(result.rows.map((row) => sandbox.OXXO.metricsVal(row, storeKey)).filter(Boolean)).size,
    asesores: new Set(result.rows.map((row) => sandbox.OXXO.metricsVal(row, adviserKey)).filter(Boolean)).size,
    filas_ajenas: foreign.length
  });
}

console.table(results);
locationStub.search = '?scope=region&region=TABASCO';
locationStub.href = `https://humanresources-oxxo.github.io/DashboardsOxxo/admin.html${locationStub.search}`;
const regional = await sandbox.OXXO.metricsD1Rows();
assert(regional, 'Region TABASCO: no fue posible leer Dashboard_1_Diario');
const plazaSum = results.reduce((sum, item) => sum + item.vacantes, 0);
assert.equal(regional.rows.length, plazaSum, 'Region TABASCO: el total no coincide con la suma de sus plazas');
assert.equal(regional.mes, '2026-08', 'Region TABASCO: el corte vigente no es agosto 2026');

console.log(`Total Region TABASCO: ${regional.rows.length} vacantes (suma de plazas: ${plazaSum})`);
console.log('vacantes regionales: 5 plazas con corte vigente y sin mezcla de datos');
