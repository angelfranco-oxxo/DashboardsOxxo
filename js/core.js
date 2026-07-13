/* ==========================================================
   OXXO DASHBOARDS — MÓDULO CORE
   Conexión a Google Sheets · Utilidades compartidas
   ========================================================== */

// ─────────────────────────────────────────────────────────────
// CONFIGURACIÓN CENTRAL DEL SISTEMA
// ► EDITAR AQUÍ: Reemplaza SPREADSHEET_ID con el ID de tu
//   Google Sheets (parte de la URL entre /d/ y /edit)
// ─────────────────────────────────────────────────────────────
const SHEETS_CONFIG = {
  // ID de tu Google Sheets
  // Ejemplo: https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
  SPREADSHEET_ID: "1EbUuyy-PRXiDwPmn9L14P93cGN6VXTyLfAHx-CE8M_A",

  // Nombre de la pestaña de Configuración global
  CONFIG_SHEET: "Configuracion",
  CATALOG_SHEET: "Catalogo_Asesores",

  // URL del Web App de Apps Script para publicar desde admin.html.
  // Cuando se configure una vez, el panel admin la usara automaticamente.
  ADMIN_UPLOAD_URL: "https://script.google.com/macros/s/AKfycbz-RKBVB1CzkmWKdVVvGwSHGTzMUzc-YfFfAznzzhORJL3G9AaHH9UnFQYr2Zwk7o3C/exec",

  // Nombres exactos de cada pestaña en Google Sheets
  TABS: {
    d1: "Dashboard_1_Diario",   // Vacantes: Plaza,Asesor,Unidad org/,Descripción de Posición,Status ocupación,Fecha,Dias Vacantes
    d2: "Dashboard_2_Diario",   // Bajas: Asesor,Plaza,Temporalidad,Puesto,Mes,Semana,Rot_Temp,Comprometido,Real,Fecha
    d2otras: "Dashboard_2_Otras_Plazas", // Bajas de otras plazas para comparativo regional
    d2denom: "Denominaciones_Dashboard_2_Diario", // Denominaciones (cambios de puesto): Asesor,Denominación Medida,Denominación Motivo,Nombre del empleado,F.Crea,Denominación Posición Anterior,Denominación Posición Actual
    d3: "Dashboard_3_Diario",   // Estructura: Plaza,Asesor,Estructuras_Asignadas,Estructuras_Activas,Pct_Aprovechamiento,Semana
    d3plazas: "Dashboard_3_Otras_Plazas", // Aprovechamiento por plaza para ranking comparativo
    s4: "Dashboard_4_Semanal",  // Tiempo Extra: Plaza,Asesor,Semana,Gasto_TE_total,Horas_TE_total,Gasto_TE_doble,Gasto_TE_triple,Gasto_dia_descanso,Fecha
    s5: "Dashboard_5_Semanal",  // Vacaciones: Asesor,Plaza,Empleado,Puesto,Fecha_Inicio,Fecha_Fin,Dias,Semana
    s6: "Dashboard_6_Semanal",  // Ausentismos: Asesor,Plaza,Empleado,Puesto,Tipo_Ausentismo,Fecha,Semana,Dias
    s7: "Dashboard_7_Semanal",  // Liberacion Estructuras P2: Plaza,CR,Tienda,Asesor,Est SAP,Est Final P2,Empleados,Vacantes,Dif,Movimiento
  }
};

// ─────────────────────────────────────────────────────────────
// FUNCIÓN BASE: Construir URL de descarga CSV
// Google Sheets publica cada pestaña como CSV accesible
// ─────────────────────────────────────────────────────────────
function buildSheetURL(tabName) {
  return `https://docs.google.com/spreadsheets/d/${SHEETS_CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN: Obtener y parsear datos de una pestaña de Sheets
// Retorna un array de objetos con las columnas como claves
// ─────────────────────────────────────────────────────────────
async function fetchSheetData(tabName) {
  const url = buildSheetURL(tabName);
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const csv = await response.text();
    return parseCSV(csv);
  } catch (error) {
    console.error(`Error cargando pestaña "${tabName}":`, error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN: Parser CSV robusto
// Maneja comas dentro de comillas y caracteres especiales
// ─────────────────────────────────────────────────────────────

function downloadBlob(content, filename, mimeType = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}

function timestampForFile() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes());
}

function safeFileName(value) {
  return String(value || 'dashboard')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'dashboard';
}

async function downloadSheetTab(tabName, filename) {
  const name = filename || (safeFileName(tabName) + '-' + timestampForFile() + '.csv');
  const response = await fetch(buildSheetURL(tabName), { cache: 'no-store' });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const csv = await response.text();
  downloadBlob(csv, name.endsWith('.csv') ? name : name + '.csv');
}

function escapeCSVValue(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function rowsToCSV(rows, columns) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const headers = columns && columns.length ? columns : Array.from(safeRows.reduce((set, row) => {
    Object.keys(row || {}).forEach(key => set.add(key));
    return set;
  }, new Set()));
  const lines = [headers.map(escapeCSVValue).join(',')];
  safeRows.forEach(row => {
    lines.push(headers.map(header => escapeCSVValue(row?.[header])).join(','));
  });
  return '\uFEFF' + lines.join('\n');
}

function downloadRowsAsCSV(rows, filename, columns) {
  downloadBlob(rowsToCSV(rows, columns), filename || ('datos-' + timestampForFile() + '.csv'));
}

async function handleDownloadButton(button, task) {
  if (!button || typeof task !== 'function') return;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Descargando...';
  try {
    await task();
    button.textContent = 'Descargado';
    setTimeout(() => { button.textContent = original; button.disabled = false; }, 1100);
  } catch (error) {
    console.error('[OXXO] Error descargando base:', error);
    button.textContent = 'Error al descargar';
    setTimeout(() => { button.textContent = original; button.disabled = false; }, 1800);
  }
}
function parseCSV(text) {
  const lines = parseCSVRecords(text.trim());
  if (lines.length < 2) return [];

  // Buscar la fila de encabezados: es la primera fila que tenga
  // al menos 3 columnas con contenido (salta títulos e instrucciones)
  let headerIndex = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cols = splitCSVRow(lines[i]).map(c => c.trim().replace(/^"|"$/g, ''));
    const nonEmpty = cols.filter(c => c.length > 0 && c.length < 60);
    if (nonEmpty.length >= 3) {
      headerIndex = i;
      break;
    }
  }

  const headers = makeUniqueHeaders(splitCSVRow(lines[headerIndex]).map(h => h.trim().replace(/^"|"$/g, '')));

  const rows = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue; // saltar filas vacías
    const values = splitCSVRow(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      let val = (values[idx] || "").trim().replace(/^"|"$/g, '');
      row[h] = val;
    });
    rows.push(row);
  }
  return rows;
}

function makeUniqueHeaders(headers) {
  const seen = {};
  return headers.map((header, idx) => {
    const base = header || `col_${idx + 1}`;
    seen[base] = (seen[base] || 0) + 1;
    return seen[base] === 1 ? base : `${base}_${seen[base]}`;
  });
}

function parseCSVRecords(text) {
  const records = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && next === '"') {
      current += '""';
      i++;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      if (current.trim()) records.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim()) records.push(current);
  return records;
}

// Divide una fila CSV respetando comillas
function splitCSVRow(row) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"' && row[i + 1] === '"') { current += '"'; i++; }
    else if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN: Cargar configuración desde pestaña "Configuracion"
// Estructura esperada de la pestaña:
//   Columna A: dashboard_id (d1, d2, d3, s4, s5, s6)
//   Columna B: nombre
//   Columna C: frecuencia
//   Columna D: ultima_actualizacion
//   Columna E: responsable
//   Columna F: activo (SI/NO)
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// FUNCIÓN: Normalizar cualquier formato de fecha a texto legible
// ─────────────────────────────────────────────────────────────
function normalizarFecha(val) {
  if (!val || !val.trim()) return val;
  const v = val.trim();

  // Serial numérico de Excel/Sheets (ej. 46179)
  if (/^\d{4,5}$/.test(v)) {
    const date = new Date(Date.UTC(1899, 11, 30) + parseInt(v) * 86400000);
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // Ya tiene mes abreviado (ej. "10/jun/2026") → devolver tal cual
  if (/\d{1,2}\/[a-záéíóú]{3}\/\d{4}/i.test(v)) return v;

  // DD/MM/YYYY o D/M/YYYY
  const dmy = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const date = new Date(Date.UTC(+dmy[3], +dmy[2] - 1, +dmy[1]));
    if (!isNaN(date)) return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // ISO YYYY-MM-DD
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const date = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
    if (!isNaN(date)) return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return v;
}

async function loadSystemConfig() {
  const url = buildSheetURL(SHEETS_CONFIG.CONFIG_SHEET);
  let csv;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return {};
    csv = await res.text();
  } catch { return {}; }

  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // Partir en líneas y buscar la que tenga "dashboard_id" como celda individual
  const lines = csv.replace(/\r/g, '').split('\n').filter(l => l.trim());

  // Función que parsea una línea CSV y devuelve las celdas limpias
  const parseLine = line => splitCSVRow(line).map(c => c.trim().replace(/^"|"$/g, ''));

  // Buscar la línea donde dashboard_id sea una celda propia (no parte de texto más largo)
  let headerLineIdx = -1;
  let headers = [];
  for (let i = 0; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    // Buscar celda que sea EXACTAMENTE "dashboard_id" (puede estar en cualquier posición)
    const hasId = cells.some(c => norm(c) === 'dashboard_id');
    if (hasId) { headerLineIdx = i; headers = cells; break; }
  }

  // Si no encontró celda exacta, puede que la primera celda sea el título largo que TERMINA en dashboard_id
  // En ese caso, el header real empieza dentro de esa celda — lo extraemos manualmente
  if (headerLineIdx === -1) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes('dashboard_id')) {
        // Cortar el texto desde "dashboard_id" en adelante y re-parsear
        const raw = lines[i];
        const cutIdx = raw.toLowerCase().indexOf('dashboard_id');
        const fixedLine = raw.slice(cutIdx); // "dashboard_id","nombre",...
        headers = parseLine('"' + fixedLine); // agregar " inicial que falta
        // Si aún no funciona, intentar sin comilla
        if (!headers.some(c => norm(c) === 'dashboard_id')) {
          headers = parseLine(fixedLine);
        }
        headerLineIdx = i;
        break;
      }
    }
  }

  if (headerLineIdx === -1 || !headers.some(c => norm(c) === 'dashboard_id')) {
    console.warn('[OXXO] No se encontró header dashboard_id. Headers detectados:', headers);
    return {};
  }

  const idxId    = headers.findIndex(h => norm(h) === 'dashboard_id');
  const idxFecha = headers.findIndex(h => norm(h) === 'ultima_actualizacion');
  // Columna opcional con el link de un archivo descargable (Google Drive u otro) por dashboard.
  // Si se agrega esta columna en la pestaña Configuracion, cada dashboard muestra un botón
  // "Descargar" que apunta a ese link. Sin esta columna (o vacía), el botón no aparece.
  const idxArchivoUrl    = headers.findIndex(h => ['archivourl','linkdescarga','urlarchivo','archivo','linkarchivo'].includes(norm(h).replace(/[^a-z0-9]/g,'')));
  const idxArchivoNombre = headers.findIndex(h => ['archivonombre','nombrearchivo','etiquetaarchivo'].includes(norm(h).replace(/[^a-z0-9]/g,'')));

  const config = {};
  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    const id = (vals[idxId] || '').trim().toLowerCase();
    if (!id || norm(id) === 'instrucciones de uso') continue;
    // Solo aceptar IDs válidos (d1-d9, s1-s9)
    if (!/^[ds]\d$/.test(id)) continue;

    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });

    if (idxFecha !== -1) {
      const fechaNorm = normalizarFecha(vals[idxFecha] || '');
      row[headers[idxFecha]] = fechaNorm;
      row['ultima_actualizacion'] = fechaNorm;
    }
    if (idxArchivoUrl !== -1) row['archivo_url'] = (vals[idxArchivoUrl] || '').trim();
    if (idxArchivoNombre !== -1) row['archivo_nombre'] = (vals[idxArchivoNombre] || '').trim();
    config[id] = row;
  }

  console.log('[OXXO] Config cargada:', Object.keys(config));
  return config;
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN: Mostrar estado de carga dentro de un contenedor
// ─────────────────────────────────────────────────────────────
function showLoading(containerId, message = "Cargando datos...") {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div class="state-box">
      <div class="spinner"></div>
      <div class="state-box__title">${message}</div>
      <div class="state-box__text">Conectando con Google Sheets…</div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN: Mostrar estado de error
// ─────────────────────────────────────────────────────────────
function showError(containerId, mensaje) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div class="state-box">
      <div class="state-box__icon">⚠️</div>
      <div class="state-box__title">Error al cargar datos</div>
      <div class="state-box__text">${mensaje}</div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN: Mostrar estado vacío
// ─────────────────────────────────────────────────────────────
function showEmpty(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div class="state-box">
      <div class="state-box__icon">📭</div>
      <div class="state-box__title">Sin datos disponibles</div>
      <div class="state-box__text">La hoja está vacía o no tiene el formato esperado.</div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN: Formatear número (separador de miles)
// ─────────────────────────────────────────────────────────────
function formatNum(n, decimals = 0) {
  const num = parseFloat(n);
  if (isNaN(num)) return n;
  return num.toLocaleString('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN: Formatear porcentaje
// ─────────────────────────────────────────────────────────────
function formatPct(n, decimals = 1) {
  const num = parseFloat(n);
  if (isNaN(num)) return n;
  return num.toLocaleString('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }) + '%';
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN: Determinar clase de semáforo
// umbralVerde: valor >= umbralVerde → verde
// umbralRojo:  valor <= umbralRojo  → rojo
// intermedio:  amarillo
// invertido: true cuando valor BAJO es bueno (ej. vacantes)
// ─────────────────────────────────────────────────────────────
function getSemaforo(valor, umbralVerde, umbralRojo, invertido = false) {
  const v = parseFloat(valor);
  if (isNaN(v)) return 'gris';
  if (!invertido) {
    if (v >= umbralVerde) return 'verde';
    if (v <= umbralRojo)  return 'rojo';
    return 'amarillo';
  } else {
    if (v <= umbralVerde) return 'verde';
    if (v >= umbralRojo)  return 'rojo';
    return 'amarillo';
  }
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN: Crear HTML de semáforo
// ─────────────────────────────────────────────────────────────
function semaforoHTML(texto, color) {
  return `<span class="semaforo ${color}">
    <span class="semaforo__dot"></span>${texto}
  </span>`;
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN: Calcular máximo de un array de valores
// ─────────────────────────────────────────────────────────────
function maxVal(arr, key) {
  return Math.max(...arr.map(r => parseFloat(r[key]) || 0));
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN: Actualizar timestamp en el footer
// ─────────────────────────────────────────────────────────────
function updateFooterTime(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN: Truncar texto largo
// ─────────────────────────────────────────────────────────────
function truncate(str, maxLen = 25) {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) + '…' : str;
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN: Renderizar tabla genérica
// columnas: [{key, label, format, align, semaforo}]
// ─────────────────────────────────────────────────────────────
function renderTable(containerId, data, columnas) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!data || data.length === 0) { showEmpty(containerId); return; }

  const thead = columnas.map(c =>
    `<th style="text-align:${c.align || 'left'}">${c.label}</th>`
  ).join('');

  const tbody = data.map((row, i) => {
    const cells = columnas.map(col => {
      let val = row[col.key] ?? '';
      if (col.format === 'num') val = formatNum(val);
      if (col.format === 'pct') val = formatPct(val);
      if (col.semaforo) {
        const color = getSemaforo(row[col.key], col.semaforo.verde, col.semaforo.rojo, col.semaforo.invertido);
        val = semaforoHTML(val, color);
      }
      return `<td style="text-align:${col.align || 'left'}">${val}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  el.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr>${thead}</tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN: Renderizar ranking con barras
// ─────────────────────────────────────────────────────────────
function renderRanking(containerId, data, keyNombre, keyValor, sufijo = '', colorBar = 'var(--color-yellow)') {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!data || data.length === 0) { showEmpty(containerId); return; }

  const max = maxVal(data, keyValor) || 1;

  const items = data.slice(0, 10).map((row, i) => {
    const val = parseFloat(row[keyValor]) || 0;
    const pct = (val / max * 100).toFixed(1);
    return `
      <div class="ranking-item">
        <div class="ranking-item__pos">${i + 1}</div>
        <div class="ranking-item__bar-wrap">
          <div class="ranking-item__name">${truncate(row[keyNombre], 30)}</div>
          <div class="ranking-item__bar-bg">
            <div class="ranking-item__bar-fill" style="width:${pct}%;background:${colorBar}"></div>
          </div>
        </div>
        <div class="ranking-item__value">${formatNum(val)}${sufijo}</div>
      </div>`;
  }).join('');

  el.innerHTML = `<div class="ranking-list">${items}</div>`;

  // Animación de entrada con delay
  requestAnimationFrame(() => {
    el.querySelectorAll('.ranking-item__bar-fill').forEach((bar, idx) => {
      const target = bar.style.width;
      bar.style.width = '0';
      setTimeout(() => { bar.style.width = target; }, idx * 80);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN: Renderizar tarjeta KPI
// ─────────────────────────────────────────────────────────────
function renderKPI(id, valor, delta = null, deltaPos = null) {
  const el = document.getElementById(id);
  if (!el) return;

  const valueEl = el.querySelector('.kpi-card__value');
  const deltaEl = el.querySelector('.kpi-card__delta');

  if (valueEl) valueEl.textContent = valor;
  if (deltaEl && delta !== null) {
    deltaEl.textContent = delta;
    deltaEl.className = 'kpi-card__delta ' + (deltaPos === true ? 'pos' : deltaPos === false ? 'neg' : 'neu');
  }
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN: Renderizar gráfica de barras con Chart.js
// ─────────────────────────────────────────────────────────────
function ensureChartReady(canvas) {
  if (window.Chart) {
    canvas.style.display = '';
    const notice = canvas.parentElement?.querySelector('.chart-unavailable');
    if (notice) notice.remove();
    return true;
  }

  canvas.style.display = 'none';
  const parent = canvas.parentElement;
  if (parent && !parent.querySelector('.chart-unavailable')) {
    const notice = document.createElement('div');
    notice.className = 'chart-unavailable';
    notice.textContent = 'Gráfica no disponible: Chart.js no cargó.';
    notice.style.cssText = 'min-height:180px;display:grid;place-items:center;color:var(--text-muted);font-family:Barlow,sans-serif;font-weight:700;text-align:center;border:1px dashed var(--line);border-radius:12px;background:rgba(255,255,255,.04);';
    parent.appendChild(notice);
  }
  console.warn('Chart.js no está disponible. Revisa la conexión al CDN o usa una copia local.');
  return false;
}
function renderBarChart(canvasId, labels, values, label, color = '#FFD200') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (!ensureChartReady(canvas)) return;
  const theme = getChartThemeColors();

  if (canvas._chartInstance) canvas._chartInstance.destroy();

  const ctx = canvas.getContext('2d');
  const makeGradient = (chart) => {
    const area = chart.chartArea;
    if (!area) return color;
    const g = ctx.createLinearGradient(area.left, 0, area.right, 0);
    g.addColorStop(0, '#F6B73C');
    g.addColorStop(.52, '#F07B22');
    g.addColorStop(1, color === '#FFD200' ? '#D91F2D' : color);
    return g;
  };
  canvas._chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label,
        data: values,
        backgroundColor: (context) => makeGradient(context.chart),
        borderColor: 'rgba(255,255,255,.68)',
        borderWidth: 1,
        borderRadius: 999,
        borderSkipped: false,
        barPercentage: .76,
        categoryPercentage: .72,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#251313',
          titleColor: '#FFF8EE',
          bodyColor: '#FFF8EE',
          titleFont: { family: 'Barlow Condensed', weight: '800', size: 14 },
          bodyFont: { family: 'Barlow', size: 13, weight: '600' },
          padding: 12,
          cornerRadius: 14,
          displayColors: false,
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: 'Barlow', size: 11 },
            color: theme.muted,
            maxRotation: 35,
          }
        },
        y: {
          border: { display: false },
          grid: { color: 'rgba(128,63,38,.075)', drawTicks: false },
          ticks: {
            font: { family: 'Barlow', size: 11, weight: '800' },
            color: '#6A5148',
          },
          beginAtZero: true,
        }
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN: Renderizar gráfica de línea con Chart.js
// ─────────────────────────────────────────────────────────────
function renderLineChart(canvasId, labels, datasets) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (!ensureChartReady(canvas)) return;
  const theme = getChartThemeColors();
  if (canvas._chartInstance) canvas._chartInstance.destroy();

  const COLORS = ['#D91F2D', '#F07B22', '#F6B73C', '#B5121C', '#7B5709'];

  const ctx = canvas.getContext('2d');
  canvas._chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: datasets.map((ds, i) => ({
        label: ds.label,
        data: ds.values,
        borderColor: COLORS[i % COLORS.length],
        backgroundColor: 'transparent',
        borderWidth: 3,
        pointBackgroundColor: COLORS[i % COLORS.length],
        pointBorderColor: '#FFF8EE',
        pointBorderWidth: 2,
        pointRadius: 4.5,
        pointHoverRadius: 6,
        fill: false,
        tension: 0.35,
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: datasets.length > 1,
          position: 'top',
          labels: { font: { family: 'Barlow', size: 12 }, color: theme.text }
        },
        tooltip: {
          backgroundColor: '#251313',
          titleColor: '#FFF8EE',
          bodyColor: '#FFF8EE',
          titleFont: { family: 'Barlow Condensed', weight: '800', size: 14 },
          bodyFont: { family: 'Barlow', size: 13, weight: '600' },
          padding: 12,
          cornerRadius: 14,
          displayColors: false,
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'Barlow', size: 11 }, color: theme.muted }
        },
        y: {
          border: { display: false },
          grid: { color: 'rgba(128,63,38,.08)', drawTicks: false },
          ticks: { font: { family: 'Barlow', size: 11 }, color: theme.muted },
          beginAtZero: false,
        }
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN: Renderizar gráfica de dona con Chart.js
// ─────────────────────────────────────────────────────────────
function renderDonutChart(canvasId, labels, values) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (!ensureChartReady(canvas)) return;
  const theme = getChartThemeColors();
  if (canvas._chartInstance) canvas._chartInstance.destroy();

  const ctx = canvas.getContext('2d');
  canvas._chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ['#D91F2D', '#F07B22', '#F6B73C', '#B5121C', '#7B5709', '#8B6A5F'],
        borderColor: '#FFF8EE',
        borderWidth: 4,
        borderRadius: 10,
        spacing: 3,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, pointStyle: 'circle', font: { family: 'Barlow', size: 12, weight: '800' }, color: '#5A4037', padding: 14 }
        },
        tooltip: {
          backgroundColor: '#251313',
          titleColor: '#FFF8EE',
          bodyColor: '#FFF8EE',
          titleFont: { family: 'Barlow Condensed', weight: '800', size: 14 },
          bodyFont: { family: 'Barlow', size: 13, weight: '600' },
          padding: 12,
          cornerRadius: 14,
          displayColors: false,
        }
      }
    }
  });
}



function getChartThemeColors() {
  return {
    text: '#2D2D44',
    muted: '#6B6678',
    grid: 'rgba(128,63,38,.10)',
    tooltipBg: '#251313'
  };
}

function applyChartThemeDefaults() {
  if (!window.Chart) return;
  const theme = getChartThemeColors();
  Chart.defaults.color = theme.text;
  Chart.defaults.borderColor = theme.grid;
  Chart.defaults.plugins = Chart.defaults.plugins || {};
  Chart.defaults.plugins.legend = Chart.defaults.plugins.legend || {};
  Chart.defaults.plugins.legend.labels = Chart.defaults.plugins.legend.labels || {};
  Chart.defaults.plugins.legend.labels.color = theme.text;
  Chart.defaults.scale = Chart.defaults.scale || {};
  Chart.defaults.scale.ticks = Chart.defaults.scale.ticks || {};
  Chart.defaults.scale.ticks.color = theme.text;
  Chart.defaults.scale.grid = Chart.defaults.scale.grid || {};
  Chart.defaults.scale.grid.color = theme.grid;
  Object.values(Chart.instances || {}).forEach((chart) => {
    if (!chart || !chart.options) return;
    const plugins = chart.options.plugins || {};
    if (plugins.legend && plugins.legend.labels) plugins.legend.labels.color = theme.text;
    if (plugins.title) plugins.title.color = theme.text;
    if (plugins.datalabels) plugins.datalabels.color = theme.text;
    const scales = chart.options.scales || {};
    Object.values(scales).forEach((scale) => {
      if (!scale) return;
      scale.ticks = scale.ticks || {};
      scale.grid = scale.grid || {};
      scale.ticks.color = theme.text;
      scale.ticks.textStrokeColor = 'rgba(0,0,0,0.18)';
      scale.ticks.textStrokeWidth = 0;
      if (scale.grid.display !== false) scale.grid.color = theme.grid;
    });
    chart.update('none');
  });
}
// Tema fijo claro compartido
function initThemeToggle() {
  const STORAGE_KEY = 'oxxo-theme';
  const root = document.documentElement;

  function applyTheme(theme) {
    root.dataset.theme = theme;
    document.body.classList.remove('dark-mode');
    try { localStorage.setItem(STORAGE_KEY, 'light'); } catch (_) {}
    applyChartThemeDefaults();
    window.dispatchEvent(new CustomEvent('oxxo-theme-change', { detail: { theme } }));
  }

  applyTheme('light');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initThemeToggle, { once: true });
} else {
  initThemeToggle();
}

// Catalogo compartido para corregir Asesor por CR/Tienda
let asesorCatalogPromise = null;
function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function normalizeCatalogCr(value) {
  return stripAccents(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}
function normalizeCatalogTienda(value) {
  return stripAccents(value)
    .toUpperCase()
    .replace(/^OXXO\s+/, '')
    .replace(/^TIENDA\s+/, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
function validCatalogRow(asesor, tienda, cr) {
  const crKey = normalizeCatalogCr(cr);
  const asesorKey = normalizeCatalogTienda(asesor);
  const tiendaKey = normalizeCatalogTienda(tienda);
  return asesorKey && tiendaKey && /^[A-Z0-9]{4,8}$/.test(crKey)
    && !asesorKey.startsWith('ASESORES')
    && asesorKey !== 'ASESOR'
    && tiendaKey !== 'TIENDA';
}
function parseAsesorCatalogCSV(csv) {
  const records = parseCSVRecords(String(csv || '').trim());
  const rows = [];
  records.forEach(record => {
    const cells = splitCSVRow(record).map(c => String(c || '').trim().replace(/^"|"$/g, ''));
    if (cells.length < 3) return;
    const [asesor, tienda, cr] = cells;
    if (!validCatalogRow(asesor, tienda, cr)) return;
    rows.push({ asesor, tienda, cr });
  });
  return rows;
}
function buildAsesorCatalog(rows) {
  const byCr = new Map();
  const byTienda = new Map();
  const validTiendas = new Set();
  rows.forEach(row => {
    const item = { asesor: String(row.asesor || '').trim(), tienda: String(row.tienda || '').trim(), cr: String(row.cr || '').trim() };
    const crKey = normalizeCatalogCr(item.cr);
    const tiendaKey = normalizeCatalogTienda(item.tienda);
    if (crKey) byCr.set(crKey, item);
    if (tiendaKey) { byTienda.set(tiendaKey, item); validTiendas.add(tiendaKey); }
  });
  return { loaded: true, rows, byCr, byTienda, validTiendas };
}
function isTiendaValid(catalog, tienda, cr='') {
  if (!catalog || !catalog.loaded || !catalog.validTiendas || !catalog.validTiendas.size) return true;
  // CR es la clave confiable (única, sin truncamientos ni variaciones de nombre). Se usa
  // como primer criterio; el nombre de tienda es solo respaldo si no hay CR disponible.
  const crKey = normalizeCatalogCr(cr);
  if (crKey) return catalog.byCr.has(crKey);
  return catalog.validTiendas.has(normalizeCatalogTienda(tienda));
}
function filterValidTiendas(rows, catalog, tiendaKey, crKey) {
  if (!Array.isArray(rows) || !tiendaKey) return rows;
  return rows.filter(row => isTiendaValid(catalog, row[tiendaKey], crKey ? row[crKey] : ''));
}
async function loadAsesorCatalog() {
  if (asesorCatalogPromise) return asesorCatalogPromise;
  asesorCatalogPromise = (async () => {
    try {
      const url = buildSheetURL(SHEETS_CONFIG.CATALOG_SHEET || 'Catalogo_Asesores') + '&range=A2%3AC';
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rows = parseAsesorCatalogCSV(await response.text());
      const catalog = buildAsesorCatalog(rows);
      if (!rows.length) console.warn('[OXXO] Catalogo_Asesores no devolvio filas validas.');
      return catalog;
    } catch (error) {
      console.warn('[OXXO] No se pudo cargar Catalogo_Asesores:', error);
      return { loaded: false, rows: [], byCr: new Map(), byTienda: new Map() };
    }
  })();
  return asesorCatalogPromise;
}
function resolveAsesor(catalog, { cr='', tienda='', asesor='' } = {}) {
  const fallback = String(asesor || '').trim();
  if (!catalog || !catalog.byCr || !catalog.byTienda) return fallback;
  const crKey = normalizeCatalogCr(cr);
  const tiendaKey = normalizeCatalogTienda(tienda);
  const hit = (crKey && catalog.byCr.get(crKey)) || (tiendaKey && catalog.byTienda.get(tiendaKey));
  return hit?.asesor || fallback;
}
function applyAsesorCatalog(row, catalog, { asesorKey, tiendaKey, crKey } = {}) {
  if (!row || !asesorKey) return row;
  const corrected = resolveAsesor(catalog, { cr: crKey ? row[crKey] : '', tienda: tiendaKey ? row[tiendaKey] : '', asesor: row[asesorKey] });
  if (corrected) row[asesorKey] = corrected;
  return row;
}

function escapeAttr(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN: Botón de descarga de archivo por dashboard
// Lee la columna 'archivo_url' (y opcionalmente 'archivo_nombre') de la fila
// correspondiente en la pestaña Configuracion. Si el admin sube un archivo (p.ej.
// a Google Drive con acceso "cualquiera con el link") y pega ese link en el Sheet,
// el botón aparece automáticamente — sin tocar código. Si no hay link, no se muestra nada.
async function renderDownloadButton(elId, dashboardId, badgeClass = 'hero-badge') {
  const el = document.getElementById(elId);
  if (!el) return;
  try {
    const config = await loadSystemConfig();
    const data = config[dashboardId];
    const url = data && data.archivo_url;
    if (!url) return;
    const label = data.archivo_nombre ? data.archivo_nombre : 'Descargar archivo';
    el.innerHTML = `<a class="${escapeAttr(badgeClass)} hero-download-link" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">⬇ ${escapeAttr(label)}</a>`;
    el.style.display = '';
  } catch (e) {
    // Silencioso: si falla la carga de configuración, simplemente no se muestra el botón.
  }
}

// Exportar para uso global (disponible en todos los dashboards)
window.OXXO = {
  SHEETS_CONFIG,
  fetchSheetData,
  renderDownloadButton,
  buildSheetURL,
  downloadBlob,
  downloadSheetTab,
  rowsToCSV,
  downloadRowsAsCSV,
  handleDownloadButton,
  loadAsesorCatalog,
  resolveAsesor,
  applyAsesorCatalog,
  isTiendaValid,
  filterValidTiendas,
  normalizeCatalogCr,
  normalizeCatalogTienda,
  loadSystemConfig,
  showLoading,
  showError,
  showEmpty,
  formatNum,
  formatPct,
  getSemaforo,
  semaforoHTML,
  renderTable,
  renderRanking,
  renderKPI,
  renderBarChart,
  renderLineChart,
  renderDonutChart,
  getChartThemeColors,
  applyChartThemeDefaults,
  ensureChartReady,
  updateFooterTime,
  initThemeToggle,
  truncate,
  maxVal,
};
