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

      const headers = Object.keys(rows.reduce(function(acc, row) {
        Object.keys(row || {}).forEach(function(key) { acc[key] = true; });
        return acc;
      }, {}));

      if (!headers.length) throw new Error('Sin columnas para publicar');

      const values = [headers].concat(rows.map(function(row) {
        return headers.map(function(header) {
          return row[header] == null ? '' : row[header];
        });
      }));

      sheet.clearContents();
      sheet.getRange(1, 1, values.length, headers.length).setValues(values);
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, Math.min(headers.length, 20));

      return jsonResponse({ ok: true, targetSheet: targetSheet, rows: rows.length, columns: headers.length });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error.message || error) });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
