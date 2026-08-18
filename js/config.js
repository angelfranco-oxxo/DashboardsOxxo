/* ==========================================================
   OXXO DASHBOARDS - CONFIGURACION CENTRAL
   Edita aqui conexiones, pestanas y nombres compartidos.
   ========================================================== */

window.OXXO_CONFIG = {
  // ID del Google Sheets principal.
  SPREADSHEET_ID: "1EbUuyy-PRXiDwPmn9L14P93cGN6VXTyLfAHx-CE8M_A",

  // Pestanas base.
  CONFIG_SHEET: "Configuracion",
  CATALOG_SHEET: "Catalogo_Asesores",
  // Quien hereda las tiendas de un asesor que ya no esta (ej. Anadelia -> Timoteo).
  // Se administra desde el panel admin, pestana "Reasignaciones" -- no requiere
  // tocar codigo cuando otro asesor deje la empresa. Si la pestana aun no
  // existe en el Sheet, el sistema sigue funcionando igual que antes (cae al
  // respaldo fijo que ya trae core.js).
  REASIGNACIONES_SHEET: "Reasignaciones",

  // Web App de Apps Script usado por el panel admin para publicar bases y
  // para leer hojas directo (sin pasar por gviz, ver ADMIN_READ_ACTION mas
  // abajo). Cada vez que se redespliega el Apps Script (Implementar >
  // Administrar implementaciones > Nueva version) Google genera una URL
  // /exec NUEVA -- la anterior queda congelada con el codigo de ese momento,
  // ya no responde con los cambios. Toca actualizar esta URL cada vez.
  // Redeploy 2026-08-14 (b): se agrego doGet(e) con action=readSheet, que
  // devuelve una hoja completa via SpreadsheetApp (sin gviz). Necesario
  // porque gviz corrompe la exportacion CSV de Catalogo_Asesores (fusiona
  // decenas de filas en una sola celda, ver loadAsesorCatalog en core.js).
  // Redeploy 2026-08-14 (c): se agrego 'Dashboard_9_Semanal' a ALLOWED_SHEETS
  // para publicar el nuevo Dashboard 9 (Faltantes y Sobrantes).
  // Redeploy 2026-08-17: se agrego 'Dashboard_10_FLEX' a ALLOWED_SHEETS para
  // publicar el nuevo Dashboard 10 (Personal FLEX).
  // Redeploy 2026-08-18: se agrego 'Dashboard_11_Semanal' a ALLOWED_SHEETS
  // para publicar el nuevo Dashboard 11 (Registro y Apego a Horario).
  ADMIN_UPLOAD_URL: "https://script.google.com/macros/s/AKfycbxoVfrqQ3t4wFXsiwBgAcmfDC3oTz0PQYr27GIMsF2Nhp3Lt1bf4z_5QTJk5c5-lqo0/exec",

  // Nombres exactos de pestanas en Google Sheets.
  TABS: {
    d1: "Dashboard_1_Diario",
    d2: "Dashboard_2_Diario",
    d2otras: "Dashboard_2_Otras_Plazas",
    d2denom: "Denominaciones_Dashboard_2_Diario",
    d2plan: "Dashboard_2_Plan_Accion",
    d3: "Dashboard_3_Diario",
    d3plazas: "Dashboard_3_Otras_Plazas",
    s4: "Dashboard_4_Semanal",
    s5: "Dashboard_5_Semanal",
    s6: "Dashboard_6_Semanal",
    s7: "Dashboard_7_Semanal",
    d8: "Dashboard_8_Diario",
    s9: "Dashboard_9_Semanal",
    d10: "Dashboard_10_FLEX",
    d11: "Dashboard_11_Semanal"
  }
};