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
  'Dashboard_2_Otras_Plazas',
  'Denominaciones_Dashboard_2_Diario',
  'Dashboard_2_Plan_Accion',
  'Dashboard_3_Diario',
  'Dashboard_3_Otras_Plazas',
  'Dashboard_4_Semanal',
  'Dashboard_5_Semanal',
  'Dashboard_6_Semanal',
  'Dashboard_7_Semanal',
  'Dashboard_8_Diario',
  'Dashboard_9_Semanal',
  'Dashboard_10_FLEX',
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

    // Fecha automatica: cada publish() en admin.js llama esta accion aparte
    // despues de publicar, para que "Ultima actualizacion" en la portada
    // (index.html) ya no dependa de que alguien la edite a mano en la hoja
    // Configuracion — siempre queda igual a la fecha real del ultimo publish.
    if (String(payload.action || '') === 'updateConfigDate') {
      const lock = LockService.getScriptLock();
      lock.waitLock(30000);
      try {
        return jsonResponse(updateConfigDate(String(payload.dashboardId || '').trim()));
      } finally {
        lock.releaseLock();
      }
    }

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

      sheet.setFrozenRows(2); // fila 1 = sacrificio, fila 2 = encabezados reales
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

// FIX 1: antes se hacia sheet.clearContents() y luego setValues() como dos pasos separados.
// Esa ventana entre "borrar todo" y "escribir de nuevo" hacia que el exportador CSV de
// Google (gviz, el que usan los dashboards) a veces tomara una foto a medio camino,
// mezclando varias filas en una sola celda. Ahora se escribe directo encima de lo que
// ya habia, y solo se limpia el sobrante (si la base nueva es mas chica) al final.
//
// FIX 2 (version anterior, con bug): se agrego una fila "sacrificio" (_buffer_) como
// fila 1 fisica de la hoja, para que si Google corrompe "la primera fila" de una
// escritura masiva, se coma esa basura y no los encabezados/datos reales. PERO la
// implementacion anterior volvia a partir la escritura en DOS llamadas setValues()
// separadas (una para la fila buffer, otra para encabezados+datos) — exactamente el
// mismo patron de "pasos separados" que el FIX 1 identifico como causa de la
// corrupcion. Resultado real (confirmado leyendo el CSV crudo exportado): el
// exportador tomaba su foto justo entre esas dos escrituras y fusionaba el texto de
// ambas en una sola celda por columna (ej. "_buffer_ Plaza" en vez de "_buffer_" y
// "Plaza" en filas separadas), corrompiendo el encabezado real.
//
// FIX 3 (este cambio): la fila buffer, los encabezados y los datos se arman en UN
// SOLO arreglo 2D y se escriben con UNA SOLA llamada a setValues(), eliminando por
// completo la ventana entre escrituras. dashboards/js/core.js ya sabe detectar los
// encabezados reales aunque no esten en la fila 1 (busca en las primeras filas cual
// tiene pinta de encabezado), asi que esto sigue siendo compatible sin tocar los
// dashboards.
const BUFFER_ROW_VALUE = '_buffer_';
function writeWithBufferRow(sheet, values, numCols) {
  const prevMaxRows = sheet.getMaxRows();
  const prevMaxCols = sheet.getMaxColumns();
  const bufferRow = new Array(numCols).fill(BUFFER_ROW_VALUE);
  const allRows = [bufferRow].concat(values); // buffer + encabezados + datos, un solo arreglo

  sheet.getRange(1, 1, allRows.length, numCols).setValues(allRows); // una sola escritura
  SpreadsheetApp.flush(); // fuerza a confirmar antes de seguir: sin esto, en bases grandes
  // (~260+ filas) el exportador CSV (gviz, el que usan los dashboards) podia leer un
  // estado intermedio de la escritura por lotes y mezclar el texto de varias filas en
  // una sola celda — confirmado reproduciendo el bug llamando al Web App directo, fuera
  // del navegador, con la base real de Catalogo_Asesores (263 filas).

  const totalRows = allRows.length;
  if (prevMaxRows > totalRows) {
    sheet.getRange(totalRows + 1, 1, prevMaxRows - totalRows, Math.max(prevMaxCols, numCols)).clearContent();
  }
  if (prevMaxCols > numCols) {
    sheet.getRange(1, numCols + 1, totalRows, prevMaxCols - numCols).clearContent();
  }
  SpreadsheetApp.flush();
}

// Actualiza SOLO la celda "ultima_actualizacion" de la fila de un dashboard
// en la hoja Configuracion (columna A=dashboard_id, ver comentario de
// loadSystemConfig en core.js), sin tocar ninguna otra celda/fila. No usa
// writeWithBufferRow porque aqui no se reemplaza la hoja completa — es una
// edicion quirurgica de una sola celda.
function updateConfigDate(dashboardId) {
  if (!dashboardId) throw new Error('dashboardId requerido');
  const ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Configuracion');
  if (!sheet) throw new Error('Hoja Configuracion no encontrada');

  const values = sheet.getDataRange().getValues();
  const normCell = v => String(v || '').trim().toLowerCase();

  let headerRow = -1, headers = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i].some(c => normCell(c) === 'dashboard_id')) { headerRow = i; headers = values[i]; break; }
  }
  if (headerRow === -1) throw new Error('No se encontro el encabezado dashboard_id en Configuracion');

  const idxId = headers.findIndex(h => normCell(h) === 'dashboard_id');
  const idxFecha = headers.findIndex(h => normCell(h) === 'ultima_actualizacion');
  if (idxFecha === -1) throw new Error('No se encontro la columna ultima_actualizacion en Configuracion');

  const wantedId = normCell(dashboardId);
  for (let i = headerRow + 1; i < values.length; i++) {
    if (normCell(values[i][idxId]) === wantedId) {
      const today = Utilities.formatDate(new Date(), 'America/Mexico_City', 'dd/MM/yyyy');
      sheet.getRange(i + 1, idxFecha + 1).setValue(today);
      return { ok: true, updated: true, dashboardId: wantedId, date: today };
    }
  }
  // No es un error fatal: hay dashboards (d2otras, d2plan, d3plazas, s7...) que
  // publican datos pero no tienen fila propia en Configuracion. Se reporta sin
  // reventar el publish principal, que ya tuvo exito antes de llegar aqui.
  return { ok: true, updated: false, error: 'dashboard_id no encontrado en Configuracion: ' + wantedId };
}

function replaceAll(sheet, rows, headers) {
  const values = rowsToValues(rows, headers);
  writeWithBufferRow(sheet, values, headers.length);
  return { mode: 'replaceAll', rows: rows.length, columns: headers.length };
}

function replacePeriod(sheet, rows, newHeaders, periodColumn, periodValues) {
  if (!periodValues.length) throw new Error('No se detectaron valores para ' + periodColumn);

  const currentValues = sheet.getDataRange().getValues();
  // Si la fila 1 es la fila "sacrificio", los encabezados reales estan en la fila 2 y
  // los datos empiezan en la fila 3.
  const hasBufferRow = currentValues.length && String(currentValues[0][0]) === BUFFER_ROW_VALUE;
  const headerRowIndex = hasBufferRow ? 1 : 0;
  const existingHeaders = currentValues.length > headerRowIndex ? currentValues[headerRowIndex].map(String) : [];
  const periodKey = normalizeHeader(periodColumn);
  const periodSet = new Set(periodValues.map(function(value) {
    return normalizePeriodValue(value, periodColumn);
  }).filter(Boolean));
  const keptRows = [];

  rows.forEach(function(row) {
    row[periodColumn] = normalizePeriodValue(row[periodColumn], periodColumn);
  });

  for (let i = headerRowIndex + 1; i < currentValues.length; i++) {
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
  writeWithBufferRow(sheet, values, newHeaders.length);

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
    .replace(/[̀-ͯ]/g, '')
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
