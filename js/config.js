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

  // Web App de Apps Script usado por el panel admin para publicar bases.
  // Redeploy 2026-08-14: se agrego "Reasignaciones" a ALLOWED_SHEETS en el
  // Apps Script. La URL anterior quedo inactiva con ese redeploy (dejo de
  // responder, "Page Not Found"), asi que ademas de agregar la pestana
  // hubo que actualizar esta URL a la nueva.
  ADMIN_UPLOAD_URL: "https://script.google.com/macros/s/AKfycbyC1_KR0Ux59_Y_rT8cF799Syn7uW6Lc-EK9UMaSRFXxeFEmg711e3Za7Dyf65JMUro/exec",

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
    d8: "Dashboard_8_Diario"
  }
};