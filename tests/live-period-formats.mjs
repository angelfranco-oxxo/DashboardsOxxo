import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const documentStub = {
  readyState: 'loading', documentElement: { dataset: {} }, body: null,
  head: { appendChild() {} }, addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
  getElementsByTagName() { return []; }, getElementById() { return null; },
  querySelector() { return null; }, querySelectorAll() { return []; },
  createElement() { return { style: {}, dataset: {}, addEventListener() {}, remove() {} }; }
};
const locationStub = {
  pathname: '/index.html', origin: 'https://humanresources-oxxo.github.io',
  href: 'https://humanresources-oxxo.github.io/DashboardsOxxo/index.html',
  search: '?scope=region&region=TABASCO'
};
const sandbox = {
  console, document: documentStub, location: locationStub,
  history: { state: null, replaceState() {} },
  sessionStorage: { getItem() { return null; }, setItem() {} },
  localStorage: { getItem() { return null; }, setItem() {} },
  navigator: {}, CustomEvent: function CustomEvent() {},
  URL, URLSearchParams, Request, Response, Blob, TextDecoder, Uint8Array,
  AbortController, fetch, setTimeout, clearTimeout, setInterval, clearInterval,
  Map, Set, Date, Promise
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/config.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/core.js'), 'utf8'), sandbox);

const OXXO = sandbox.OXXO;
const tabs = OXXO.SHEETS_CONFIG.TABS;
const results = [];

async function canonicalMonths(name, tab, aliases, keyForRow) {
  const rows = await OXXO.fetchSheetData(tab, { fresh: true, scoped: false });
  assert(Array.isArray(rows) && rows.length, `${name}: fuente vacia o sin respuesta`);
  const keys = Object.fromEntries(Object.entries(aliases).map(([id, names]) => [id, OXXO.metricsFindKey(rows[0], names)]));
  const keyed = rows.map((row) => ({ row, value: keyForRow(row, keys) }));
  const values = keyed.map((item) => item.value).filter(Boolean);
  const periods = [...new Set(values)].sort();
  const invalid = rows.length - values.length;
  results.push({ dashboard: name, rows: rows.length, periods: periods.join(', '), latest: periods.at(-1) || '', invalid });
  if (invalid) {
    const samples = keyed.filter((item) => !item.value).slice(0, 3).map((item) =>
      Object.fromEntries(Object.entries(keys).map(([id, key]) => [id, OXXO.metricsVal(item.row, key)])));
    console.warn(`${name}: ${invalid} filas sin periodo reconocible`, samples);
  }
  return periods;
}

await canonicalMonths('Dashboard 1', tabs.d1, { mes: ['Mes'], fecha: ['Fecha'] },
  (row, key) => OXXO.metricsRowMonthKeyD1(row, key.mes, key.fecha));

const d2Periods = await canonicalMonths('Dashboard 2', tabs.d2, { mes: ['Mes'], fecha: ['Fecha'] },
  (row, key) => OXXO.metricsRowMonthKeyD2(row, key.mes, key.fecha));
console.log('Periodos Dashboard 2:', d2Periods);
assert(d2Periods.includes('2026-09'), 'Dashboard 2: septiembre 2026 no aparece en la fuente publicada');

await canonicalMonths('Dashboard 12', tabs.m12, { mes: ['Mes'] },
  (row, key) => OXXO.metricsNormalizeMonthKey(OXXO.metricsVal(row, key.mes)));

await canonicalMonths('Inventarios', tabs.inventories, { mes: ['Periodo', 'Mes', 'Corte'], fecha: ['Fecha de Inventario'] },
  (row, key) => OXXO.metricsNormalizeMonthKey(OXXO.metricsVal(row, key.mes)) ||
    OXXO.metricsNormalizeMonthKey(OXXO.metricsVal(row, key.fecha)));

for (const [name, tab] of [['Dashboard 4', tabs.s4], ['Dashboard 6', tabs.s6]]) {
  await canonicalMonths(name, tab, { mes: ['Mes'], ano: ['Ano', 'Año'] }, (row, key) => {
    const month = String(OXXO.metricsVal(row, key.mes) || '').match(/^(\d{1,2})/);
    const year = String(OXXO.metricsVal(row, key.ano) || '').match(/(\d{4})/);
    return month && +month[1] >= 1 && +month[1] <= 12 && year
      ? `${year[1]}-${month[1].padStart(2, '0')}` : '';
  });
}

console.table(results);
console.log('periodos en vivo: septiembre visible en Dashboard 2 y cero filas mensuales sin interpretar');
