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

  // Contexto operativo central. Por ahora el sitio solo publica Plaza Oaxaca,
  // pero mantener estos valores en un unico lugar evita dejar la plaza
  // hardcodeada dentro de cada dashboard. Cuando se incorpore otra plaza se
  // cambia/selecciona el contexto, no se reconstruyen las pantallas.
  DATA_CONTEXT: {
    COUNTRY_CODE: "MX",
    COUNTRY: "Mexico",
    STATE: "Oaxaca",
    REGION: "Oaxaca",
    PLAZA_ID: "PLAZA-OAXACA",
    PLAZA: "Plaza Oaxaca",
    ZONE: "",
    BRAND_SUBTITLE: "Plaza Oaxaca-ByPamsb",
    PLAZA_ALIASES: ["Oaxaca", "OXXO OAXACA", "10VHT Oaxaca"]
  },
  // El alcance se mantiene en Oaxaca hasta registrar las plazas reales de la
  // region. La arquitectura ya acepta region/plaza/zona desde URL o sesion sin
  // duplicar paginas: ?scope=region, ?plaza=... o ?zona=...
  SCOPE_MODEL: {
    DEFAULT_LEVEL: "plaza",
    QUERY_PARAM: "scope",
    STORAGE_KEY: "oxxo_active_data_scope",
    DISCOVER_FROM_CATALOG: true
  },
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
  // 2026-08-24 (v35): se agrego penalizacion progresiva y bitacora muestreada
  // para intentos de acceso incorrectos, protegiendo las cuotas de Apps Script.
  // 2026-08-24 (v36): verificacion de filas/columnas tras cada publicacion,
  // version visible en el panel y cadencias completas para todas las fuentes.
  // Se actualizo la implementacion existente; la URL /exec no cambio.
  // 2026-08-25: se agrego 'Dashboard_14_Comercial' a ALLOWED_SHEETS (nuevo
  // Dashboard 14, Avance Comercial) en apps-script/admin-upload.gs.
  // 2026-08-25 (b): implementacion NUEVA (se uso "Nueva implementacion" en
  // vez de "Nueva version" sobre la existente, asi que la URL /exec cambio;
  // la anterior sigue viva pero congelada sin Dashboard_14_Comercial).
  // Verificado antes de fijarla: doGet responde con las 21 hojas permitidas
  // incluyendo Dashboard_14_Comercial.
  ADMIN_UPLOAD_URL: "https://script.google.com/macros/s/AKfycbxLR3dIFgqFoN2rKOg5tTReOu90iKVeGl9b0sghToomWfOkoikU9PqVRiD-s1u1kk1C/exec",

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
    c14: "Dashboard_14_Comercial",
    promos: "Promociones",
    inventories: "Inventarios"
  }
};
