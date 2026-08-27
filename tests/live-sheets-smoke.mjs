import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'js', 'config.js'), 'utf8'), context);

const config = context.window.OXXO_CONFIG;
const sheets = [...new Set([
  config.CONFIG_SHEET,
  config.CATALOG_SHEET,
  config.REASIGNACIONES_SHEET,
  ...Object.values(config.TABS),
])];

async function inspectSheet(sheet) {
  // Configuración y Promociones son pestañas públicas de lectura que no se
  // publican desde el panel admin; por diseño se consultan mediante GViz.
  if (sheet === config.CONFIG_SHEET || sheet === config.TABS.promos) {
    const url = new URL(`https://docs.google.com/spreadsheets/d/${config.SPREADSHEET_ID}/gviz/tq`);
    url.searchParams.set('tqx', 'out:csv');
    url.searchParams.set('sheet', sheet);
    const started = Date.now();
    const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const csv = await response.text();
    const lines = csv.replace(/\r/g, '').split('\n').filter(line => line.trim());
    if (!lines.length) throw new Error('CSV vacío');
    const columns = (lines[0].match(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/g) || []).length + 1;
    return { sheet, rows: Math.max(0, lines.length - 1), columns, ms: Date.now() - started, version: 'gviz' };
  }

  const url = new URL(config.ADMIN_UPLOAD_URL);
  url.searchParams.set('action', 'readSheet');
  url.searchParams.set('sheet', sheet);
  const started = Date.now();
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload.ok || !Array.isArray(payload.values)) throw new Error(payload.error || 'respuesta inválida');
  const [headers = [], ...rows] = payload.values;
  return {
    sheet,
    rows: rows.filter(row => Array.isArray(row) && row.some(value => String(value ?? '').trim())).length,
    columns: Array.isArray(headers) ? headers.filter(value => String(value ?? '').trim()).length : 0,
    ms: Date.now() - started,
    version: payload.version,
  };
}

const results = [];
const failures = [];
let cursor = 0;

async function worker() {
  while (cursor < sheets.length) {
    const sheet = sheets[cursor++];
    try {
      results.push(await inspectSheet(sheet));
    } catch (error) {
      failures.push({ sheet, error: error.message });
    }
  }
}

await Promise.all(Array.from({ length: 3 }, worker));
results.sort((a, b) => sheets.indexOf(a.sheet) - sheets.indexOf(b.sheet));

console.table(results);
if (failures.length) {
  console.error('Hojas con error:', failures);
  process.exitCode = 1;
} else {
  console.log(`conectividad en vivo: ${results.length} hojas respondieron correctamente`);
}
