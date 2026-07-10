/**
 * DashboardsOxxo Admin Upload
 *
 * Flujo recomendado:
 * 1. Crear un proyecto en Google Apps Script.
 * 2. Pegar este archivo.
 * 3. Deploy > Web app.
 * 4. Execute as: Me.
 * 5. Who has access: Anyone with the link.
 * 6. Copiar la URL del Web App en SHEETS_CONFIG.ADMIN_UPLOAD_URL (js/core.js).
 *
 * Despues de eso, admin.html publica directo sin pedir URL.
 */
const SPREADSHEET_ID = '1EbUuyy-PRXiDwPmn9L14P93cGN6VXTyLfAHx-CE8M_A';
const ADMIN_PASSWORD_PROPERTY = 'ADMIN_PASSWORD';
const ALLOWED_SHEETS = [
  'Dashboard_1_Diario',
  'Dashboard_2_Diario',
  'Denominaciones_Dashboard_2_Diario',
  'Dashboard_3_Diario',
  'Dashboard_4_Semanal',
  'Dashboard_5_Semanal',
  'Dashboard_6_Semanal',
  'Dashboard_7_Semanal',
  'Catalogo_Asesores'
];

function doGet() {
  return jsonResponse({ ok: true, app: 'DashboardsOxxo Admin Upload', sheets: ALLOWED_SHEETS });
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (String(payload.action || '') === 'auth') {
      assertAuthorized(payload);
      return jsonResponse({ ok: true, authenticated: true });
    }

    assertAuthorized(payload);

    const targetSheet = String(payload.targetSheet || '').trim();
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const updateMode = String(payload.updateMode || 'replaceAll').trim();
    const periodColumn = String(payload.periodColumn || '').trim();
    const periodValues = Array.isArray(payload.periodValues) ? payload.periodValues.map(normalizeCell).filter(Boolean) : [];

    if (!targetSheet) throw new Error('targetSheet requerido');
    if (ALLOWED_SHEETS.indexOf(targetSheet) === -1) throw new Error('targetSheet no permitido: ' + targetSheet);
    if (!rows.length) throw new Error('rows requerido');

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const ss = SPREADSHEET_ID
        ? SpreadsheetApp.openById(SPREADSHEET_ID)
        : SpreadsheetApp.getActiveSpreadsheet();
      let sheet = ss.getSheetByName(targetSheet);
      if (!sheet) sheet = ss.insertSheet(targetSheet);

      const newHeaders = collectHeaders(rows);
      if (!newHeaders.length) throw new Error('Sin columnas para publicar');

      const result = updateMode === 'replacePeriod' && periodColumn
        ? replacePeriod(sheet, rows, newHeaders, periodColumn, periodValues)
        : replaceAll(sheet, rows, newHeaders);

      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, Math.min(result.columns, 20));

      return jsonResponse({
        ok: true,
        targetSheet: targetSheet,
        mode: result.mode,
        periodColumn: result.periodColumn || '',
        periodValues: result.periodValues || [],
        rows: result.rows,
        keptRows: result.keptRows || 0,
        columns: result.columns
      });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error.message || error) });
  }
}

function assertAuthorized(payload) {
  const configured = PropertiesService.getScriptProperties().getProperty(ADMIN_PASSWORD_PROPERTY) || '';
  if (!configured) throw new Error('ADMIN_PASSWORD no configurado en Script Properties');
  const received = String((payload && payload.adminPassword) || '');
  if (received !== configured) throw new Error('No autorizado');
}
function replaceAll(sheet, rows, headers) {
  const values = rowsToValues(rows, headers);
  sheet.clearContents();
  sheet.getRange(1, 1, values.length, headers.length).setValues(values);
  return { mode: 'replaceAll', rows: rows.length, columns: headers.length };
}

function replacePeriod(sheet, rows, newHeaders, periodColumn, periodValues) {
  if (!periodValues.length) throw new Error('No se detectaron valores para ' + periodColumn);

  const currentValues = sheet.getDataRange().getValues();
  const existingHeaders = currentValues.length ? currentValues[0].map(String) : [];
  const periodKey = normalizeHeader(periodColumn);
  const periodSet = new Set(periodValues.map(function(value) {
    return normalizePeriodValue(value, periodColumn);
  }).filter(Boolean));
  const keptRows = [];

  rows.forEach(function(row) {
    row[periodColumn] = normalizePeriodValue(row[periodColumn], periodColumn);
  });

  for (let i = 1; i < currentValues.length; i++) {
    const projected = projectRowToHeaders(existingHeaders, currentValues[i], newHeaders);
    const periodHeader = findHeaderByKey(newHeaders, periodKey) || periodColumn;
    const currentPeriod = normalizePeriodValue(projected[periodHeader], periodColumn);
    if (currentPeriod && !periodSet.has(currentPeriod)) {
      projected[periodHeader] = currentPeriod;
      keptRows.push(projected);
    }
  }

  const finalRows = keptRows.concat(rows);
  const values = rowsToValues(finalRows, newHeaders);
  sheet.clearContents();
  sheet.getRange(1, 1, values.length, newHeaders.length).setValues(values);
  return {
    mode: 'replacePeriod',
    periodColumn: periodColumn,
    periodValues: periodValues,
    rows: rows.length,
    keptRows: keptRows.length,
    columns: newHeaders.length
  };
}

function collectHeaders(rows) {
  return Object.keys(rows.reduce(function(acc, row) {
    Object.keys(row || {}).forEach(function(key) { acc[key] = true; });
    return acc;
  }, {}));
}

function mergeHeaders(existingHeaders, newHeaders) {
  const seen = {};
  const out = [];
  existingHeaders.concat(newHeaders).forEach(function(header) {
    const name = String(header || '').trim();
    if (!name || seen[name]) return;
    seen[name] = true;
    out.push(name);
  });
  return out;
}

function findHeaderIndex(headers, headerName) {
  const target = normalizeHeader(headerName);
  for (let i = 0; i < headers.length; i++) {
    if (normalizeHeader(headers[i]) === target) return i;
  }
  return -1;
}

function rowArrayToObject(headers, values) {
  const row = {};
  headers.forEach(function(header, index) {
    row[String(header || '').trim()] = values[index] == null ? '' : values[index];
  });
  return row;
}

function projectRowToHeaders(existingHeaders, values, targetHeaders) {
  const source = rowArrayToObject(existingHeaders, values);
  const byKey = {};
  Object.keys(source).forEach(function(header) {
    byKey[normalizeHeader(header)] = source[header];
  });
  const row = {};
  targetHeaders.forEach(function(header) {
    const key = normalizeHeader(header);
    row[header] = byKey[key] == null ? '' : byKey[key];
  });
  return row;
}

function findHeaderByKey(headers, key) {
  for (let i = 0; i < headers.length; i++) {
    if (normalizeHeader(headers[i]) === key) return headers[i];
  }
  return '';
}

function rowsToValues(rows, headers) {
  return [headers].concat(rows.map(function(row) {
    return headers.map(function(header) {
      return row[header] == null ? '' : row[header];
    });
  }));
}

function normalizeHeader(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, '')
    .trim();
}

function normalizeCell(value) {
  return String(value == null ? '' : value).trim();
}

function normalizePeriodValue(value, periodColumn) {
  const raw = normalizeCell(value);
  if (normalizeHeader(periodColumn) !== 'mes' || !raw) return raw;

  const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return monthNames[value.getMonth()] + '-' + String(value.getFullYear()).slice(-2);
  }

  const compact = raw.toLowerCase().replace(/[.\/]/g, '-').replace(/\s+/g, '-');
  const named = compact.match(/^(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)-?(\d{2}|\d{4})$/);
  if (named) return named[1] + '-' + named[2].slice(-2);

  const numeric = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2}|\d{4})$/);
  if (numeric) {
    const month = Number(numeric[2]);
    if (month >= 1 && month <= 12) return monthNames[month - 1] + '-' + numeric[3].slice(-2);
  }

  const parsed = new Date(raw);
  if (!isNaN(parsed)) return monthNames[parsed.getMonth()] + '-' + String(parsed.getFullYear()).slice(-2);
  return raw;
}
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
