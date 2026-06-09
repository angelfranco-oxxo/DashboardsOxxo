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
  SPREADSHEET_ID: "1MORN0KOO54i_-f2TS31g1u69BZ_7OaMx",

  // Nombre de la pestaña de Configuración global
  CONFIG_SHEET: "Configuracion",

  // Nombres exactos de cada pestaña en Google Sheets
  TABS: {
    d1: "Dashboard_1_Diario",
    d2: "Dashboard_2_Diario",
    d3: "Dashboard_3_Diario",
    s4: "Dashboard_4_Semanal",
    s5: "Dashboard_5_Semanal",
    s6: "Dashboard_6_Semanal",
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
function parseCSV(text) {
  const lines = text.trim().split("\n");
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

  const headers = splitCSVRow(lines[headerIndex]).map(h => h.trim().replace(/^"|"$/g, ''));

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
async function loadSystemConfig() {
  const data = await fetchSheetData(SHEETS_CONFIG.CONFIG_SHEET);
  if (!data) return {};
  const config = {};
  data.forEach(row => {
    if (row.dashboard_id) {
      config[row.dashboard_id] = row;
    }
  });
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
function renderBarChart(canvasId, labels, values, label, color = '#FFD200') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Destruir instancia previa si existe
  if (canvas._chartInstance) canvas._chartInstance.destroy();

  const ctx = canvas.getContext('2d');
  canvas._chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label,
        data: values,
        backgroundColor: color,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1A1A2E',
          titleFont: { family: 'Barlow Condensed', weight: '700' },
          bodyFont: { family: 'Barlow', size: 13 },
          padding: 10,
          cornerRadius: 8,
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: 'Barlow', size: 11 },
            color: '#8A8A99',
            maxRotation: 35,
          }
        },
        y: {
          grid: { color: '#E0DAD0' },
          ticks: {
            font: { family: 'Barlow', size: 11 },
            color: '#8A8A99',
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
  if (canvas._chartInstance) canvas._chartInstance.destroy();

  const COLORS = ['#FFD200', '#FF6B00', '#1DB954', '#D92B2B', '#0066CC'];

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
        borderWidth: 2.5,
        pointBackgroundColor: COLORS[i % COLORS.length],
        pointRadius: 4,
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
          labels: { font: { family: 'Barlow', size: 12 }, color: '#2D2D44' }
        },
        tooltip: {
          backgroundColor: '#1A1A2E',
          titleFont: { family: 'Barlow Condensed', weight: '700' },
          bodyFont: { family: 'Barlow', size: 13 },
          padding: 10,
          cornerRadius: 8,
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'Barlow', size: 11 }, color: '#8A8A99' }
        },
        y: {
          grid: { color: '#E0DAD0' },
          ticks: { font: { family: 'Barlow', size: 11 }, color: '#8A8A99' },
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
  if (canvas._chartInstance) canvas._chartInstance.destroy();

  const ctx = canvas.getContext('2d');
  canvas._chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ['#FFD200', '#FF6B00', '#1DB954', '#D92B2B', '#0066CC', '#8A8A99'],
        borderWidth: 0,
        hoverOffset: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'Barlow', size: 12 }, color: '#2D2D44', padding: 14 }
        },
        tooltip: {
          backgroundColor: '#1A1A2E',
          titleFont: { family: 'Barlow Condensed', weight: '700' },
          bodyFont: { family: 'Barlow', size: 13 },
          padding: 10,
          cornerRadius: 8,
        }
      }
    }
  });
}

// Exportar para uso global (disponible en todos los dashboards)
window.OXXO = {
  SHEETS_CONFIG,
  fetchSheetData,
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
  updateFooterTime,
  truncate,
  maxVal,
};
