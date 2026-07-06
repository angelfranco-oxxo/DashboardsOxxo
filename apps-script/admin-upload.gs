/**
 * DashboardsOxxo Admin Upload
 *
 * Pega este archivo en Google Apps Script ligado al Google Sheets.
 * Publica como Web App y copia la URL en admin.html.
 *
 * Deploy recomendado:
 * - Execute as: Me
 * - Who has access: Anyone with the link
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const targetSheet = String(payload.targetSheet || '').trim();
    const rows = Array.isArray(payload.rows) ? payload.rows : [];

    if (!targetSheet) throw new Error('targetSheet requerido');
    if (!rows.length) throw new Error('rows requerido');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(targetSheet);
    if (!sheet) sheet = ss.insertSheet(targetSheet);

    const headers = Object.keys(rows.reduce(function(acc, row) {
      Object.keys(row || {}).forEach(function(key) { acc[key] = true; });
      return acc;
    }, {}));

    const values = [headers].concat(rows.map(function(row) {
      return headers.map(function(header) {
        return row[header] == null ? '' : row[header];
      });
    }));

    sheet.clearContents();
    sheet.getRange(1, 1, values.length, headers.length).setValues(values);
    sheet.setFrozenRows(1);

    return jsonResponse({ ok: true, targetSheet: targetSheet, rows: rows.length, columns: headers.length });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error.message || error) });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
