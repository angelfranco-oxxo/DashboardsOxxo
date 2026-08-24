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
  // abajo).
  //
  // COMO REDESPLEGAR SIN CAMBIAR ESTA URL (importante):
  //   Implementar > Administrar implementaciones > selecciona la
  //   implementacion activa > icono de lapiz (Editar) > Version: "Nueva
  //   version" > Implementar.
  // Ese camino publica el codigo nuevo CONSERVANDO la misma URL /exec, y
  // entonces este archivo no se toca. Cada implementacion tiene su propio ID
  // y su propia URL estable; lo que cambia con cada version es el codigo que
  // sirve, no la direccion.
  //
  // El boton "Nueva implementacion" (el otro camino) crea una implementacion
  // DISTINTA, con URL /exec nueva, y deja la anterior viva pero congelada con
  // el codigo de ese momento. Si alguna vez el panel deja de ver los cambios
  // recien publicados, casi siempre es eso: se creo una implementacion nueva
  // y esta constante seguia apuntando a la vieja. Solo en ese caso hay que
  // actualizar la URL de abajo.
  //
  // Historial de versiones publicadas (que se cambio en el .gs cada vez):
  // 2026-08-14 (b): se agrego doGet(e) con action=readSheet, que
  // devuelve una hoja completa via SpreadsheetApp (sin gviz). Necesario
  // porque gviz corrompe la exportacion CSV de Catalogo_Asesores (fusiona
  // decenas de filas en una sola celda, ver loadAsesorCatalog en core.js).
  // 2026-08-14 (c): se agrego 'Dashboard_9_Semanal' a ALLOWED_SHEETS
  // para publicar el nuevo Dashboard 9 (Faltantes y Sobrantes).
  // 2026-08-17: se agrego 'Dashboard_10_FLEX' a ALLOWED_SHEETS para
  // publicar el nuevo Dashboard 10 (Personal FLEX).
  // 2026-08-18: se agrego 'Dashboard_11_Semanal' a ALLOWED_SHEETS
  // para publicar el nuevo Dashboard 11 (Registro y Apego a Horario).
  // 2026-08-18 (b): se restauro doGet(e) con action=readSheet, que
  // se habia perdido en el redeploy anterior (el doGet() de ese momento no
  // leia parametros en absoluto). Sin esto Catalogo_Asesores se publicaba
  // desde el respaldo estatico del repo en vez del Sheet en vivo.
  // 2026-08-18 (c): se agrego 'Reasignaciones' a ALLOWED_SHEETS,
  // para que el panel admin (pestana Reasignaciones) pueda publicar ahi.
  // 2026-08-21: se agrego 'Dashboard_12_Mensual' a ALLOWED_SHEETS
  // para publicar el nuevo Dashboard 12 (Enfoque del Lider). Es la primera
  // pestana con historico mensual: se carga con updateMode replacePeriod
  // sobre la columna 'Mes', asi que subir un mes NO borra los anteriores.
  // 2026-08-21 (c): se agrego 'Dashboard_13_Ausentismo' a ALLOWED_SHEETS para
  // publicar el nuevo Dashboard 13 (Control de Ausentismo). Se publico otra vez
  // como implementacion NUEVA, asi que la URL /exec volvio a cambiar y esta
  // constante se actualizo con ella. Verificado antes de fijarla: doGet lista
  // las 20 hojas permitidas con Dashboard_13_Ausentismo incluida, y
  // action=readSheet sigue respondiendo.
  // 2026-08-21 (b): implementacion NUEVA (URL /exec distinta a la anterior,
  // que sigue viva pero sin Dashboard_12_Mensual). Verificado contra la URL
  // de abajo: doGet responde con las 19 hojas permitidas incluyendo
  // Dashboard_12_Mensual, y action=readSheet sigue funcionando. Para las
  // proximas veces, ver "COMO REDESPLEGAR SIN CAMBIAR ESTA URL" arriba: si se
  // publica una version nueva sobre esta misma implementacion, esta constante
  // ya no se vuelve a tocar.
  // 2026-08-24 (v34): se restauro la app web, la lectura directa del
  // catalogo, la reparacion segura de pestanas y el soporte de D12/D13.
  ADMIN_UPLOAD_URL: "https://script.google.com/macros/s/AKfycbzTVlxLyHaKAphlRRwH1kI6aDga15rfKumCkquAUuvY1_X7ifx-XPrNT87IZN54_Gtk/exec",

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
    d11: "Dashboard_11_Semanal",
    m12: "Dashboard_12_Mensual",
    a13: "Dashboard_13_Ausentismo",
    promos: "Promociones",
    inventories: "Inventarios"
  }
};
