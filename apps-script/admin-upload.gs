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
  const headers = mergeHeaders(existingHeaders, newHeaders);
  const periodIndex = findHeaderIndex(headers, periodColumn);
  if (periodIndex === -1) throw new Error('No se encontro la columna de periodo: ' + periodColumn);

  const periodSet = new Set(periodValues);
  const keptRows = [];
  for (let i = 1; i < currentValues.length; i++) {
    const mapped = rowArrayToObject(existingHeaders, currentValues[i]);
    const currentPeriod = normalizeCell(mapped[headers[periodIndex]]);
    if (!periodSet.has(currentPeriod)) keptRows.push(mapped);
  }

  const finalRows = keptRows.concat(rows);
  const values = rowsToValues(finalRows, headers);
  sheet.clearContents();
  sheet.getRange(1, 1, values.length, headers.length).setValues(values);
  return {
    mode: 'replacePeriod',
    periodColumn: periodColumn,
    periodValues: periodValues,
    rows: rows.length,
    keptRows: keptRows.length,
    columns: headers.length
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

function rowsToValues(rows, headers) {
  return [headers].concat(rows.map(function(row) {
    return headers.map(function(header) {
      return row[header] == null ? '' : row[header];
    });
  }));
}

function normalizeHeader(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '').trim();
}

function normalizeCell(value) {
  return String(value == null ? '' : value).trim();
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
