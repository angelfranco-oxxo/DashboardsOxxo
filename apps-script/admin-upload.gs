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
const AUDIT_SHEET = '_Admin_Bitacora';
const BACKUP_PREFIX = '_BK_';
const BACKUP_LIMIT = 5;
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
  'Dashboard_11_Semanal',
  'Dashboard_12_Mensual',
  'Inventarios',
  'Catalogo_Asesores',
  'Reasignaciones'
];

// action=readSheet&sheet=NOMBRE: lee una hoja completa via SpreadsheetApp (sin
// pasar por gviz). Necesario porque gviz corrompe la exportacion CSV de
// Catalogo_Asesores (fusiona ~109 de 263 filas en una sola celda), ver
// fetchCatalogRowsDirect() en core.js, que es quien llama esto. Sin accion (o
// con una desconocida) se mantiene el comportamiento original: listar
// ALLOWED_SHEETS para diagnostico rapido.
function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || '');
  if (action === 'readSheet') {
    const sheetName = String((e && e.parameter && e.parameter.sheet) || '').trim();
    if (!sheetName) return jsonResponse({ ok: false, error: 'sheet requerido' });
    if (ALLOWED_SHEETS.indexOf(sheetName) === -1) return jsonResponse({ ok: false, error: 'sheet no permitido: ' + sheetName });
    try {
      const ss = SPREADSHEET_ID
        ? SpreadsheetApp.openById(SPREADSHEET_ID)
        : SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return jsonResponse({ ok: false, error: 'hoja no encontrada: ' + sheetName });
      const values = sheet.getDataRange().getValues();
      return jsonResponse({ ok: true, values: values });
    } catch (error) {
      return jsonResponse({ ok: false, error: String(error.message || error) });
    }
  }
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

    if (String(payload.action || '') === 'getAudit') {
      return jsonResponse(readAudit(Number(payload.limit || 100)));
    }

    if (String(payload.action || '') === 'getAdminOverview') {
      return jsonResponse(getAdminOverview(Number(payload.limit || 100)));
    }

    if (String(payload.action || '') === 'getBackupPreview') {
      return jsonResponse(getBackupPreview(payload));
    }

    if (String(payload.action || '') === 'restoreBackup') {
      const restoreLock = LockService.getScriptLock();
      restoreLock.waitLock(30000);
      try {
        return jsonResponse(restoreLatestBackup(payload));
      } finally {
        restoreLock.releaseLock();
      }
    }

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

      let backupName = '';
      let result;
      try {
        backupName = backupCurrentSheet(ss, sheet, targetSheet, String(payload.sourceFile || payload.source || 'Publicación desde Panel Admin'));
        result = updateMode === 'replacePeriod' && periodColumn
          ? replacePeriod(sheet, rows, newHeaders, periodColumn, periodValues)
          : replaceAll(sheet, rows, newHeaders);

        appendAudit(ss, payload, result, 'Correcta', '', backupName);
      } catch (publishError) {
        appendAudit(ss, payload, { mode: updateMode, rows: rows.length, keptRows: 0 }, 'Error', String(publishError.message || publishError), backupName);
        throw publishError;
      }

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
        columns: result.columns,
        backupSheet: backupName,
        audited: true
      });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error.message || error) });
  }
}

function backupCurrentSheet(ss, sourceSheet, targetSheet, sourceLabel) {
  if (!sourceSheet || sourceSheet.getLastRow() < 1 || sourceSheet.getLastColumn() < 1) return '';
  return saveSnapshot(ss, targetSheet, sourceSheet.getDataRange().getValues(), sourceLabel);
}

function saveSnapshot(ss, targetSheet, values, sourceLabel) {
  if (!values.length || !values[0].length) throw new Error('No hay datos para respaldar');
  const createdAt = new Date();
  const stamp = Utilities.formatDate(createdAt, ss.getSpreadsheetTimeZone() || 'America/Mexico_City', 'yyyyMMdd_HHmmss_SSS');
  const baseName = (BACKUP_PREFIX + targetSheet).slice(0, 76);
  let backupName = (baseName + '_' + stamp).slice(0, 99);
  let suffix = 2;
  while (ss.getSheetByName(backupName)) {
    backupName = (baseName + '_' + stamp + '_' + suffix).slice(0, 99);
    suffix++;
  }
  const backup = ss.insertSheet(backupName);
  const requiredRows = values.length + 2;
  const requiredCols = Math.max(values[0].length, 6);
  if (backup.getMaxRows() < requiredRows) backup.insertRowsAfter(backup.getMaxRows(), requiredRows - backup.getMaxRows());
  if (backup.getMaxColumns() < requiredCols) backup.insertColumnsAfter(backup.getMaxColumns(), requiredCols - backup.getMaxColumns());
  backup.getRange(1, 1, 1, 6).setValues([['Respaldo creado', createdAt, 'Hoja origen', targetSheet, 'Archivo origen', String(sourceLabel || '')]]);
  backup.getRange(3, 1, values.length, values[0].length).setValues(values);
  backup.hideSheet();
  SpreadsheetApp.flush();
  pruneBackups(ss, targetSheet, BACKUP_LIMIT);
  return backupName;
}

function readBackupMetadata(ss, targetSheet) {
  const timezone = ss.getSpreadsheetTimeZone() || 'America/Mexico_City';
  const items = [];
  ss.getSheets().forEach(function(sheet) {
    if (sheet.getName().indexOf(BACKUP_PREFIX) !== 0 || sheet.getLastRow() < 3) return;
    const metadata = sheet.getRange(1, 1, 1, 6).getValues()[0];
    const origin = String(metadata[3] || '').trim();
    if (!origin || (targetSheet && origin !== targetSheet)) return;
    const createdValue = metadata[1];
    const createdMillis = Object.prototype.toString.call(createdValue) === '[object Date]' && !isNaN(createdValue) ? createdValue.getTime() : 0;
    items.push({
      sheet: sheet,
      backupSheet: sheet.getName(),
      targetSheet: origin,
      createdAt: createdMillis ? Utilities.formatDate(createdValue, timezone, 'dd/MM/yyyy HH:mm:ss') : 'Fecha no disponible',
      createdMillis: createdMillis,
      sourceFile: String(metadata[5] || ''),
      rows: Math.max(0, sheet.getLastRow() - 4),
      columns: sheet.getLastColumn()
    });
  });
  return items.sort(function(a, b) { return b.createdMillis - a.createdMillis; });
}

function pruneBackups(ss, targetSheet, limit) {
  const backups = readBackupMetadata(ss, targetSheet);
  backups.slice(Math.max(1, Number(limit || BACKUP_LIMIT))).forEach(function(item) {
    ss.deleteSheet(item.sheet);
  });
}

function resolveBackup(ss, targetSheet, requestedBackup) {
  const backups = readBackupMetadata(ss, targetSheet);
  if (!backups.length) throw new Error('No existe un respaldo disponible para ' + targetSheet);
  const selected = requestedBackup ? backups.find(function(item) { return item.backupSheet === requestedBackup; }) : backups[0];
  if (!selected) throw new Error('El respaldo no corresponde a la hoja seleccionada o ya vencio');
  return selected;
}

function writeSnapshot(sheet, values) {
  if (!values.length || !values[0].length) throw new Error('El respaldo esta vacio');
  const previousRows = sheet.getMaxRows();
  const previousCols = sheet.getMaxColumns();
  const rows = values.length;
  const columns = values[0].length;
  if (previousRows < rows) sheet.insertRowsAfter(previousRows, rows - previousRows);
  if (previousCols < columns) sheet.insertColumnsAfter(previousCols, columns - previousCols);
  sheet.getRange(1, 1, rows, columns).setValues(values);
  if (previousRows > rows) sheet.getRange(rows + 1, 1, previousRows - rows, Math.max(previousCols, columns)).clearContent();
  if (previousCols > columns) sheet.getRange(1, columns + 1, rows, previousCols - columns).clearContent();
  SpreadsheetApp.flush();
}

function getBackupPreview(payload) {
  const targetSheet = String(payload.targetSheet || '').trim();
  const requestedBackup = String(payload.backupSheet || '').trim();
  if (!targetSheet) throw new Error('targetSheet requerido');
  if (ALLOWED_SHEETS.indexOf(targetSheet) === -1) throw new Error('targetSheet no permitido: ' + targetSheet);
  const ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  const target = ss.getSheetByName(targetSheet);
  if (!target) throw new Error('Hoja destino no encontrada: ' + targetSheet);
  const selected = resolveBackup(ss, targetSheet, requestedBackup);
  const backup = selected.sheet;

  const currentValues = target.getDataRange().getDisplayValues();
  const backupValues = backup.getRange(3, 1, backup.getLastRow() - 2, backup.getLastColumn()).getDisplayValues();
  const difference = compareSnapshots(currentValues, backupValues);
  return {
    ok: true,
    targetSheet: targetSheet,
    backupSheet: selected.backupSheet,
    createdAt: selected.createdAt,
    sourceFile: selected.sourceFile,
    current: { rows: Math.max(0, currentValues.length - 2), columns: currentValues[0] ? currentValues[0].length : 0, values: currentValues },
    backup: { rows: Math.max(0, backupValues.length - 2), columns: backupValues[0] ? backupValues[0].length : 0, values: backupValues },
    changedRows: difference.changedRows,
    changedCells: difference.changedCells
  };
}

function compareSnapshots(currentValues, backupValues) {
  const rowCount = Math.max(currentValues.length, backupValues.length);
  let changedRows = 0;
  let changedCells = 0;
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const currentRow = currentValues[rowIndex] || [];
    const backupRow = backupValues[rowIndex] || [];
    const columnCount = Math.max(currentRow.length, backupRow.length);
    let rowChanged = false;
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
      if (String(currentRow[columnIndex] || '') !== String(backupRow[columnIndex] || '')) {
        changedCells++;
        rowChanged = true;
      }
    }
    if (rowChanged) changedRows++;
  }
  return { changedRows: changedRows, changedCells: changedCells };
}

function restoreLatestBackup(payload) {
  const targetSheet = String(payload.targetSheet || '').trim();
  const requestedBackup = String(payload.backupSheet || '').trim();
  if (!targetSheet) throw new Error('targetSheet requerido');
  if (ALLOWED_SHEETS.indexOf(targetSheet) === -1) throw new Error('targetSheet no permitido: ' + targetSheet);
  const ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  const target = ss.getSheetByName(targetSheet);
  if (!target) throw new Error('Hoja destino no encontrada: ' + targetSheet);
  const selected = resolveBackup(ss, targetSheet, requestedBackup);
  const backup = selected.sheet;

  const backupValues = backup.getRange(3, 1, backup.getLastRow() - 2, backup.getLastColumn()).getValues();
  const currentValues = target.getDataRange().getValues();
  const undoBackup = saveSnapshot(ss, targetSheet, currentValues, 'Estado anterior a restaurar ' + selected.backupSheet);
  writeSnapshot(target, backupValues);
  target.setFrozenRows(Math.min(2, target.getLastRow()));

  const dataRows = Math.max(0, backupValues.length - 2);
  const result = { mode: 'restoreBackup', rows: dataRows, keptRows: 0, columns: backupValues[0].length };
  appendAudit(ss, {
    targetSheet: targetSheet,
    source: 'Restauracion desde Panel Admin',
    sourceFile: selected.backupSheet,
    adminUser: String(payload.adminUser || 'Administrador')
  }, result, 'Restaurada', '', undoBackup);
  return { ok: true, restored: true, targetSheet: targetSheet, rows: dataRows, restoredFrom: selected.backupSheet, backupSheet: undoBackup, reversible: true };
}

function appendAudit(ss, payload, result, status, message, backupName) {
  let sheet = ss.getSheetByName(AUDIT_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(AUDIT_SHEET);
    sheet.appendRow(['Fecha', 'Hoja', 'Modo', 'Filas publicadas', 'Filas conservadas', 'Archivo', 'Origen', 'Usuario', 'Estado', 'Detalle', 'Respaldo']);
    sheet.setFrozenRows(1);
    sheet.hideSheet();
  }
  sheet.appendRow([
    new Date(), String(payload.targetSheet || ''), String(result.mode || payload.updateMode || ''), Number(result.rows || 0),
    Number(result.keptRows || 0), String(payload.sourceFile || ''), String(payload.source || ''), String(payload.adminUser || 'Administrador'),
    status, message, backupName || ''
  ]);
}

function readAudit(limit) {
  const ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(AUDIT_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return { ok: true, rows: [] };
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values.shift();
  const safeLimit = Math.max(1, Math.min(Number(limit || 100), 500));
  const rows = values.slice(-safeLimit).reverse().map(function(valuesRow) {
    const row = {};
    headers.forEach(function(header, index) { row[String(header)] = valuesRow[index] || ''; });
    return row;
  });
  return { ok: true, rows: rows };
}

function getAdminOverview(limit) {
  const ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  const audit = readAudit(limit);
  const auditSheet = ss.getSheetByName(AUDIT_SHEET);
  const latestBySheet = {};
  if (auditSheet && auditSheet.getLastRow() >= 2) {
    const values = auditSheet.getDataRange().getValues();
    const headers = values.shift().map(String);
    const sheetIndex = headers.indexOf('Hoja');
    const dateIndex = headers.indexOf('Fecha');
    const statusIndex = headers.indexOf('Estado');
    const rowsIndex = headers.indexOf('Filas publicadas');
    for (let index = values.length - 1; index >= 0; index--) {
      const sheetName = String(values[index][sheetIndex] || '');
      if (!sheetName || latestBySheet[sheetName]) continue;
      const dateValue = values[index][dateIndex];
      const dateMillis = Object.prototype.toString.call(dateValue) === '[object Date]' && !isNaN(dateValue) ? dateValue.getTime() : 0;
      latestBySheet[sheetName] = {
        publishedAt: dateMillis ? Utilities.formatDate(dateValue, ss.getSpreadsheetTimeZone() || 'America/Mexico_City', 'dd/MM/yyyy HH:mm') : '',
        publishedMillis: dateMillis,
        status: String(values[index][statusIndex] || ''),
        rows: Number(values[index][rowsIndex] || 0)
      };
    }
  }

  const allBackups = readBackupMetadata(ss).filter(function(item) { return ALLOWED_SHEETS.indexOf(item.targetSheet) !== -1; });
  const backupsBySheet = {};
  allBackups.forEach(function(item) {
    if (!backupsBySheet[item.targetSheet]) backupsBySheet[item.targetSheet] = [];
    backupsBySheet[item.targetSheet].push(item);
  });

  const now = Date.now();
  const sources = ALLOWED_SHEETS.map(function(sheetName) {
    const latest = latestBySheet[sheetName] || null;
    const backups = backupsBySheet[sheetName] || [];
    const thresholds = publicationThresholds(sheetName);
    const ageDays = latest && latest.publishedMillis ? Math.floor((now - latest.publishedMillis) / 86400000) : null;
    let health = 'neutral';
    let healthLabel = 'Sin registro';
    if (latest) {
      health = String(latest.status).toLowerCase() === 'error' ? 'bad' : ageDays > thresholds.bad ? 'bad' : ageDays > thresholds.warn ? 'warn' : 'ok';
      healthLabel = health === 'bad' ? 'Requiere atención' : health === 'warn' ? 'Por actualizar' : 'Al día';
    }
    return {
      sheet: sheetName,
      status: latest ? latest.status : '',
      health: health,
      healthLabel: healthLabel,
      publishedAt: latest ? latest.publishedAt : '',
      publishedRows: latest ? latest.rows : 0,
      ageDays: ageDays,
      backupCount: backups.length,
      latestBackup: backups[0] ? backups[0].createdAt : ''
    };
  });

  const backups = allBackups.map(function(item) {
    return { targetSheet: item.targetSheet, backupSheet: item.backupSheet, createdAt: item.createdAt, sourceFile: item.sourceFile, rows: item.rows, columns: item.columns };
  });
  return {
    ok: true,
    rows: audit.rows,
    sources: sources,
    backups: backups,
    summary: {
      sources: sources.length,
      withBackups: sources.filter(function(item) { return item.backupCount > 0; }).length,
      backups: backups.length,
      attention: sources.filter(function(item) { return item.health === 'warn' || item.health === 'bad'; }).length
    }
  };
}

function publicationThresholds(sheetName) {
  const daily = ['Dashboard_1_Diario', 'Dashboard_2_Diario', 'Dashboard_2_Otras_Plazas', 'Denominaciones_Dashboard_2_Diario', 'Dashboard_2_Plan_Accion'];
  const weekly = ['Dashboard_3_Diario', 'Dashboard_3_Otras_Plazas', 'Dashboard_7_Semanal', 'Dashboard_9_Semanal', 'Dashboard_10_FLEX', 'Dashboard_11_Semanal'];
  const monthly = ['Dashboard_4_Semanal', 'Dashboard_6_Semanal', 'Inventarios'];
  if (daily.indexOf(sheetName) !== -1) return { warn: 14, bad: 45 };
  if (weekly.indexOf(sheetName) !== -1) return { warn: 14, bad: 35 };
  if (monthly.indexOf(sheetName) !== -1) return { warn: 45, bad: 75 };
  return { warn: 90, bad: 180 };
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
