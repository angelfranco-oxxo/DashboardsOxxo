(function(){
  // Toda la logica de columnas/filtros/fechas que replica el comportamiento
  // real de los dashboards vive en core.js (window.OXXO.metrics*), para que
  // dashboards y presentaciones nunca vuelvan a divergir. Aqui solo se
  // referencian esas funciones — nada de esto se reimplementa.
  const findKey = OXXO.metricsFindKey;
  const findDataKey = OXXO.metricsFindDataKey;
  const val = OXXO.metricsVal;
  const num = OXXO.metricsNum;
  const normText = OXXO.metricsNormText;
  const latestByKey = (rows, key) => { const vals = [...new Set(rows.map(r => String(r[key]||'').trim()).filter(Boolean))]; return vals.sort().slice(-1)[0] || ''; };
  const tipoPuesto = OXXO.metricsTipoPuesto;
  const rowMonthKeyD1 = OXXO.metricsRowMonthKeyD1;
  const rowMonthKeyD2 = OXXO.metricsRowMonthKeyD2;
  const filterLatestMonth = OXXO.metricsFilterLatestMonth;
  const coerceTreoRowsD7 = OXXO.metricsCoerceTreoRows;
  // Ranking de conteo por nombre (p.ej. vacantes o bajas por Asesor), top N
  // descendente. Copia local de rankCount() de admin-pptx-rae.js (ya
  // verificada ahi) para no acoplar los dos archivos.
  function rankCount(rows, nameKey, limit){
    const counts = new Map();
    rows.forEach(r => {
      const name = String(val(r, nameKey)||'').trim();
      if(!name) return;
      counts.set(name, (counts.get(name)||0) + 1);
    });
    return [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, limit);
  }
  function tipoAusentismo(desc){
    const d = normText(desc);
    if(d.includes('FALTA')) return 'Faltas';
    if(d.includes('ACCIDENTE')) return 'Accidentes';
    if(d.includes('INC') || d.includes('ENF')) return 'Incapacidades';
    if(d.includes('VACAC')) return 'Vacaciones';
    if(d.includes('MATERN') || d.includes('PATERN') || d.includes('PERMISO')) return 'Permisos';
    return 'Otro';
  }

  async function kpiD1(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d1);
    if(!raw || !raw.length) return null;
    const mesKey = findKey(raw[0], ['Mes']);
    const puestoKey = findKey(raw[0], ['Descripcion de Posicion','Puesto']);
    const asesorKey = findKey(raw[0], ['Asesor']);
    const tiendaKey = findKey(raw[0], ['Tienda','Unidad org']);
    const crKey = findKey(raw[0], ['CR TIENDA','CR']);
    const fechaKey = findKey(raw[0], ['Fecha']);
    const diasKey = findKey(raw[0], ['Dias Vacantes','Dias_Vacantes']);
    // Misma logica verificada de dataD1() en admin-pptx-rae.js: catalogo de
    // 255 tiendas, excluir timoteoantonioperez, y los 3 filtros DEFAULT de
    // dashboard-1.html (puesto exacto, tienda no-entrenamiento/operaciones,
    // antiguedad>=1 dia).
    const asesorCatalog = await OXXO.loadAsesorCatalog();
    const stepCatalog = raw
      .filter(r => String(val(r, tiendaKey)||'').trim() && String(val(r, tiendaKey)||'').trim() !== 'Sin tienda')
      .filter(r => normText(val(r, asesorKey)).replace(/[^A-Z]/g,'') !== 'TIMOTEOANTONIOPEREZ')
      .filter(r => OXXO.isTiendaValid(asesorCatalog, val(r, tiendaKey), val(r, crKey)));
    const base = OXXO.metricsApplyD1Defaults(stepCatalog, { tiendaKey, asesorKey, puestoKey, diasKey });
    const { mes, rows } = filterLatestMonth(base, r => rowMonthKeyD1(r, mesKey, fechaKey));
    const byPuesto = { Lider: 0, Encargado: 0, Ayudante: 0, Otro: 0 };
    rows.forEach(r => { byPuesto[tipoPuesto(val(r, puestoKey))]++; });
    return {
      label: 'Total Vacantes', value: String(rows.length), sub: mes ? `Mes ${mes}` : 'Plaza Oaxaca',
      secondary: [
        { label: 'Lider', value: String(byPuesto.Lider) },
        { label: 'Encargado', value: String(byPuesto.Encargado) },
        { label: 'Ayudante', value: String(byPuesto.Ayudante) },
      ],
      chart: { title: 'Vacantes por Puesto', labels: ['Lider','Encargado','Ayudante'], values: [byPuesto.Lider, byPuesto.Encargado, byPuesto.Ayudante] },
      ranking: rankCount(rows, asesorKey, 8),
    };
  }

  async function kpiD2(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d2);
    if(!raw || !raw.length) return null;
    const mesKey = findKey(raw[0], ['Mes']);
    const asesorKey = findKey(raw[0], ['Asesor']);
    const puestoKey = findKey(raw[0], ['Puesto']);
    const medidaKey = findKey(raw[0], ['Denominación Medida','Denominacion Medida','Medida','Med.']);
    const plazaKey = findKey(raw[0], ['Plaza']);
    const fechaKey = findKey(raw[0], ['Fecha']);
    // Igual que filterData() en dashboard-2.html: si la hoja trae columna
    // de Medida, quedarse solo con BAJA; si trae Plaza, quedarse solo con
    // Oaxaca. Cada filtro solo se aplica si existe la columna y deja al
    // menos una fila.
    const asesorCrudoOk = raw.filter(r => String(val(r, asesorKey)||'').trim() && normText(val(r, asesorKey)).replace(/[^A-Z]/g,'') !== 'TIMOTEOANTONIOPEREZ');
    const base = OXXO.metricsFilterBajasD2(asesorCrudoOk, { medidaKey, plazaKey });
    const { mes, rows: byMonth } = filterLatestMonth(base, r => rowMonthKeyD2(r, mesKey, fechaKey));
    const rows = byMonth.filter(r => {
      const asesor = normText(val(r, asesorKey));
      if(!asesor || asesor.includes('SIN ASESOR')) return false;
      const puesto = tipoPuesto(val(r, puestoKey));
      return puesto !== 'Otro';
    });
    const byPuesto = { Lider: 0, Encargado: 0, Ayudante: 0 };
    rows.forEach(r => { byPuesto[tipoPuesto(val(r, puestoKey))]++; });
    return {
      label: 'Total de Bajas', value: String(rows.length), sub: mes ? `Mes ${mes}` : 'Plaza Oaxaca',
      secondary: [
        { label: 'Ayudante', value: String(byPuesto.Ayudante) },
        { label: 'Encargado', value: String(byPuesto.Encargado) },
        { label: 'Lider', value: String(byPuesto.Lider) },
      ],
      chart: { title: 'Bajas por Puesto', labels: ['Ayudante','Encargado','Lider'], values: [byPuesto.Ayudante, byPuesto.Encargado, byPuesto.Lider] },
      ranking: rankCount(rows, asesorKey, 8),
    };
  }

  async function kpiD3(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d3);
    if(!raw || !raw.length) return null;
    const estatusKey = findKey(raw[0], ['Clas Aprov','Estatus Con impacto Ausentismo','Estatus']);
    const asesorKey = findKey(raw[0], ['Asesor']);
    const fechaKey = findKey(raw[0], ['Mes Semana','Semana','Fecha','FECHA']);
    // Igual que dashboard-3.html: limitar al corte de la fecha mas
    // reciente, para no mezclar dias distintos si llegaran a quedar
    // varias fechas en la misma hoja.
    const fecha = latestByKey(raw, fechaKey);
    const rows = fecha ? raw.filter(r => String(r[fechaKey]||'').trim() === fecha) : raw;
    const total = rows.length;
    let completas = 0, incompletas = 0, criticas = 0;
    rows.forEach(r => {
      const c = OXXO.metricsClasificaAprovechamiento(val(r, estatusKey));
      if(c === 'criticas') criticas++;
      else if(c === 'incompletas') incompletas++;
      else if(c === 'completas') completas++;
    });
    const pct = total > 0 ? (completas / total * 100) : 0;
    // "Aprovechamiento por AT" (ranking) = EC% (Equipo Completo / Total) por
    // Asesor, misma clasificacion que arriba. Igual fallback que dataD3() en
    // admin-pptx-rae.js cuando no hay columna dedicada de 'Ec por AT'.
    const byAsesor = new Map();
    rows.forEach(r => {
      const name = String(val(r, asesorKey)||'').trim();
      if(!name) return;
      if(!byAsesor.has(name)) byAsesor.set(name, { total: 0, completas: 0 });
      const acc = byAsesor.get(name);
      acc.total++;
      if(OXXO.metricsClasificaAprovechamiento(val(r, estatusKey)) === 'completas') acc.completas++;
    });
    const ranking = [...byAsesor.entries()]
      .map(([name, v]) => ({ name, value: v.total > 0 ? (v.completas / v.total * 100) : 0 }))
      .filter(x => x.value > 0)
      .sort((a,b) => b.value - a.value)
      .slice(0, 8);
    return {
      label: 'Aprovechamiento General', value: pct.toFixed(2) + '%', sub: 'Plaza Oaxaca',
      secondary: [
        { label: 'Completas', value: String(completas) },
        { label: 'Incompletas', value: String(incompletas) },
        { label: 'Criticas', value: String(criticas) },
      ],
      chart: { title: 'Tiendas por Estatus', labels: ['Completas','Incompletas','Criticas'], values: [completas, incompletas, criticas], type: 'pie' },
      ranking,
    };
  }

  async function kpiD4(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.s4);
    if(!raw || !raw.length) return null;
    const semanaKey = findKey(raw[0], ['Semana']);
    const horasKey = findKey(raw[0], ['Cantidad']);
    const tipoKey = findKey(raw[0], ['Textos homologados']);
    const semana = latestByKey(raw, semanaKey);
    const rows = semana ? raw.filter(r => String(r[semanaKey]||'').trim() === semana) : raw;
    const totalHoras = rows.reduce((s,r) => s + num(val(r, horasKey)), 0);
    const byTipo = { Doble: 0, Triple: 0, Descanso: 0, Sencillo: 0 };
    // Clasificacion normalizada (sin acentos/espacios), igual que dashboard-4.html, para que
    // la presentacion no diverja del dashboard si 'Textos homologados' trae variantes de
    // acentos/espacios.
    rows.forEach(r => {
      const t = normText(val(r, tipoKey));
      const horas = num(val(r, horasKey));
      if(t.replace(/\s+/g,'') === 'TIEMPOEXTRADOBLE') byTipo.Doble += horas;
      else if(t.replace(/\s+/g,'') === 'TIEMPOEXTRATRIPLE') byTipo.Triple += horas;
      else if(t.replace(/\s+/g,'').startsWith('DIADES')) byTipo.Descanso += horas;
      else byTipo.Sencillo += horas;
    });
    return {
      label: 'Total Horas TE', value: OXXO.formatNum(totalHoras), sub: semana ? `Semana ${semana}` : 'Plaza Oaxaca',
      secondary: [
        { label: 'Doble', value: OXXO.formatNum(byTipo.Doble) },
        { label: 'Triple', value: OXXO.formatNum(byTipo.Triple) },
        { label: 'Descanso', value: OXXO.formatNum(byTipo.Descanso) },
      ],
      chart: { title: 'Horas TE por Tipo', labels: ['Sencillo','Doble','Triple','Descanso'], values: [byTipo.Sencillo, byTipo.Doble, byTipo.Triple, byTipo.Descanso] },
    };
  }

  async function kpiD5(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.s5);
    if(!raw || !raw.length) return null;
    const diasKey = findKey(raw[0], ['Dias_Restantes']);
    const bucketKey = findKey(raw[0], ['Bucket_Ant']);
    const totalDias = raw.reduce((s,r) => s + num(val(r, diasKey)), 0);
    const buckets = { 'ya vencieron sus dias': 0, '0 a 50 dias': 0, '51 a 100 dias': 0, '101 a 150 dias': 0, 'mas de 150 dias': 0 };
    raw.forEach(r => {
      const b = String(val(r, bucketKey) || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
      if(buckets[b] !== undefined) buckets[b]++;
    });
    return {
      label: 'Días Restantes de Vacaciones', value: OXXO.formatNum(Math.round(totalDias)), sub: 'Plaza Oaxaca',
      secondary: [
        { label: 'Vencidos', value: String(buckets['ya vencieron sus dias']) },
        { label: 'Vencen 0-50 días', value: String(buckets['0 a 50 dias']) },
        { label: 'Colaboradores', value: String(raw.length) },
      ],
      chart: { title: 'Colaboradores por Vencimiento', labels: ['Vencidos','0-50 días','51-100 días','101-150 días','+150 días'], values: [buckets['ya vencieron sus dias'], buckets['0 a 50 dias'], buckets['51 a 100 dias'], buckets['101 a 150 dias'], buckets['mas de 150 dias']] },
    };
  }

  async function kpiD6(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.s6);
    if(!raw || !raw.length) return null;
    const semanaKey = findKey(raw[0], ['Semana']);
    const diasKey = findKey(raw[0], ['Dias']);
    const denomKey = findKey(raw[0], ['Denominacion']);
    const tiendaKey = findKey(raw[0], ['Tienda']);
    const crKey = findKey(raw[0], ['Cr de Tienda','CR de Tienda']);
    // Igual que dashboard-6.html: filtrar por el catalogo de 255 tiendas
    // autorizadas (filterValidTiendas) antes de elegir semana/sumar dias.
    const asesorCatalog = await OXXO.loadAsesorCatalog();
    const base = raw.filter(r => OXXO.isTiendaValid(asesorCatalog, val(r, tiendaKey), val(r, crKey)));
    // Semana mas reciente por orden NUMERICO, igual que dashboard-6.html.
    const semana = OXXO.metricsLatestSemanaNumerica(base, semanaKey);
    const rows = semana ? base.filter(r => String(val(r, semanaKey)||'').trim() === semana) : base;
    const totalDias = rows.reduce((s,r) => s + num(val(r, diasKey)), 0);
    const byTipo = { Faltas: 0, Incapacidades: 0, Vacaciones: 0, Permisos: 0, Accidentes: 0, Otro: 0 };
    rows.forEach(r => { byTipo[tipoAusentismo(val(r, denomKey))] += num(val(r, diasKey)); });
    return {
      label: 'Días Ausentes', value: OXXO.formatNum(Math.round(totalDias)), sub: semana ? `Semana ${semana}` : 'Plaza Oaxaca',
      secondary: [
        { label: 'Faltas', value: OXXO.formatNum(Math.round(byTipo.Faltas)) },
        { label: 'Incapacidades', value: OXXO.formatNum(Math.round(byTipo.Incapacidades)) },
        { label: 'Vacaciones', value: OXXO.formatNum(Math.round(byTipo.Vacaciones)) },
      ],
      chart: { title: 'Días Ausentes por Tipo', labels: ['Faltas','Incapacidades','Vacaciones','Permisos','Accidentes'], values: [byTipo.Faltas, byTipo.Incapacidades, byTipo.Vacaciones, byTipo.Permisos, byTipo.Accidentes], type: 'pie' },
    };
  }

  async function kpiD7(){
    const rawSheet = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.s7);
    // Dashboard_7_Semanal es propensa al problema de exportacion de Google
    // donde el encabezado real queda pegado como texto en la primera fila
    // de datos; sin coerceTreoRowsD7 + findDataKey los alias pueden
    // emparejar una columna vacia o equivocada.
    const raw = coerceTreoRowsD7(rawSheet);
    if(!raw || !raw.length) return null;
    const difKey = findDataKey(raw, ['Dif SAP vs Est Optima Final'], 25, true);
    const asesorKey = findDataKey(raw, ['Asesor']);
    const tiendaKey = findDataKey(raw, ['Tienda','Nombre Tienda','Unidad','Unidad Org','Unidad Organizativa']);
    const crKey = findDataKey(raw, ['CR','ID Tienda','ID_Tienda']);
    const asesorCatalog = await OXXO.loadAsesorCatalog();
    const rows = raw
      .filter(r => String(val(r, tiendaKey)||'').trim() || String(val(r, asesorKey)||'').trim())
      .filter(r => OXXO.isTiendaValid(asesorCatalog, val(r, tiendaKey), val(r, crKey)))
      .filter(r => normText(val(r, asesorKey)).replace(/[^A-Z]/g,'') !== 'TIMOTEOANTONIOPEREZ');
    const total = rows.length;
    let alineadas = 0, subir = 0, bajar = 0;
    rows.forEach(r => {
      const d = num(val(r, difKey));
      if(d === 0) alineadas++;
      else if(d > 0) subir++;
      else bajar++;
    });
    const pct = total > 0 ? (alineadas / total * 100) : 0;
    return {
      label: 'Alineación Global TREO', value: pct.toFixed(1) + '%', sub: 'Plaza Oaxaca',
      secondary: [
        { label: 'Alineadas', value: String(alineadas) },
        { label: 'Por Subir', value: String(subir) },
        { label: 'Por Bajar', value: String(bajar) },
      ],
      chart: { title: 'Tiendas por Estatus TREO', labels: ['Alineadas','Por Subir','Por Bajar'], values: [alineadas, subir, bajar], type: 'pie' },
    };
  }

  // Estadisticas extra de D1 que no calcula kpiD1 (necesarias para llenar la
  // plantilla de Foro Bienestar: tienda con la vacante mas antigua, Top 5 de
  // tiendas con mas vacantes, y numero de asesores afectados). Usa el mismo
  // pipeline verificado de kpiD1 (catalogo + filtros DEFAULT + mes mas
  // reciente) para que nunca diverja del KPI principal. OJO: para el alias de
  // tienda se usa SOLO 'Unidad org' (no 'Tienda') porque ese alias tan corto
  // tambien matchea la columna 'CR TIENDA' y findDataKey puede quedarse con
  // esa por empate de score, devolviendo codigos de CR en vez de nombres.
  async function extraD1Stats(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d1);
    if(!raw || !raw.length) return null;
    const puestoKey = findDataKey(raw, ['Descripcion de Posicion','Puesto']);
    const asesorKey = findDataKey(raw, ['Asesor']);
    const tiendaKey = findDataKey(raw, ['Unidad org']);
    const crKey = findDataKey(raw, ['CR TIENDA','CR']);
    const fechaKey = findDataKey(raw, ['Fecha']);
    const diasKey = findDataKey(raw, ['Dias Vacantes','Dias_Vacantes']);
    const asesorCatalog = await OXXO.loadAsesorCatalog();
    const stepCatalog = raw
      .filter(r => String(val(r, tiendaKey)||'').trim() && String(val(r, tiendaKey)||'').trim() !== 'Sin tienda')
      .filter(r => normText(val(r, asesorKey)).replace(/[^A-Z]/g,'') !== 'TIMOTEOANTONIOPEREZ')
      .filter(r => OXXO.isTiendaValid(asesorCatalog, val(r, tiendaKey), val(r, crKey)));
    const base = OXXO.metricsApplyD1Defaults(stepCatalog, { tiendaKey, asesorKey, puestoKey, diasKey });
    const { rows } = filterLatestMonth(base, r => rowMonthKeyD1(r, findDataKey(raw, ['Mes']), fechaKey));
    const byTienda = new Map();
    rows.forEach(r => { const t = String(val(r, tiendaKey)||'').trim(); if(t) byTienda.set(t, (byTienda.get(t)||0) + 1); });
    const top5 = [...byTienda.entries()].sort((a,b) => b[1]-a[1]).slice(0,5);
    let maxDias = 0, maxTienda = '';
    rows.forEach(r => { const d = num(val(r, diasKey)); if(d > maxDias){ maxDias = d; maxTienda = String(val(r, tiendaKey)||'').trim(); } });
    const asesoresAfectados = new Set(rows.map(r => normText(val(r, asesorKey))).filter(Boolean));
    return { top5, maxDias, maxTienda, asesoresAfectados: asesoresAfectados.size };
  }

  const DASHBOARDS = [
    { name: 'Dashboard 1 · Vacantes', fn: kpiD1 },
    { name: 'Dashboard 2 · Bajas', fn: kpiD2 },
    { name: 'Dashboard 3 · Aprovechamiento', fn: kpiD3 },
    { name: 'Dashboard 6 · Ausentismos', fn: kpiD6 },
    { name: 'Dashboard 4 · Tiempo Extra', fn: kpiD4 },
    { name: 'Dashboard 5 · Vacaciones', fn: kpiD5 },
    { name: 'Dashboard 7 · TREO', fn: kpiD7 },
  ];

  const TEMPLATE_URL = 'assets/foro-bienestar-template.pptx';
  const RED_HEX = 'E3000F';
  const DARK_HEX = '221F1F';
  const GRAY_HEX = '6B6363';

  function xmlEscape(s){
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function emu(inches){ return Math.round(inches * 914400); }

  // Reemplaza la N-esima ocurrencia (0-based) de un texto exacto dentro de
  // <a:t>...</a:t>, sin tocar el resto del XML (misma tecnica que
  // admin-indicadores.js: parcheo quirurgico, nunca reescribir todo el
  // documento).
  function replaceNthText(xml, oldText, newText, n){
    const marker = `<a:t>${xmlEscape(oldText)}</a:t>`;
    const parts = xml.split(marker);
    if(parts.length - 1 <= n) return xml;
    return parts.slice(0, n + 1).join(marker) + `<a:t>${xmlEscape(newText)}</a:t>` + parts.slice(n + 1).join(marker);
  }
  function replaceAllText(xml, oldText, newText){
    const marker = `<a:t>${xmlEscape(oldText)}</a:t>`;
    return xml.split(marker).join(`<a:t>${xmlEscape(newText)}</a:t>`);
  }

  function nextShapeId(xml){
    const ids = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map(m => Number(m[1]));
    return (ids.length ? Math.max(...ids) : 0) + 1;
  }

  function textBoxXml(id, x, y, w, h, text, { size = 18, bold = false, color = DARK_HEX, align = 'l', anchor = 't', autofit = false } = {}){
    const bodyExtra = autofit ? '<a:normAutofit/>' : '';
    return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="KPI ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
      `<p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>` +
      `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
      `<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="${anchor}">${bodyExtra}</a:bodyPr><a:lstStyle/>` +
      `<a:p><a:pPr algn="${align}"/><a:r><a:rPr lang="es-MX" sz="${size * 100}" b="${bold ? 1 : 0}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>${xmlEscape(text)}</a:t></a:r></a:p>` +
      `</p:txBody></p:sp>`;
  }
  function cardRectXml(id, x, y, w, h){
    return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Card ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
      `<p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>` +
      `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 8000"/></a:avLst></a:prstGeom>` +
      `<a:solidFill><a:srgbClr val="F7F3F3"/></a:solidFill>` +
      `<a:ln w="9525"><a:solidFill><a:srgbClr val="E8DADA"/></a:solidFill></a:ln></p:spPr>` +
      `<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`;
  }
  // Barra de relleno de un ranking (sin borde, radio pequeño). Igual funcion
  // que la barra de "avance" de addRankingList()/addPctRankingList() en
  // admin-pptx-rae.js, pero como shape OOXML crudo.
  function fillBarXml(id, x, y, w, h, colorHex){
    return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Bar ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
      `<p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(Math.max(w,0.02))}" cy="${emu(h)}"/></a:xfrm>` +
      `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 30000"/></a:avLst></a:prstGeom>` +
      `<a:solidFill><a:srgbClr val="${colorHex}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr>` +
      `<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`;
  }

  // Coloca un hero (valor + etiqueta + subtitulo) y las tarjetas secundarias
  // DENTRO de los limites (x,y,w,h) de una tarjeta que ya existe en la
  // plantilla (evita el bug de encimarse con el fondo/tarjeta de la
  // plantilla, que es lo que pasaba al usar coordenadas fijas propias).
  function heroInBoundsXml(idStart, x, y, w, h, kpi){
    let id = idStart, extra = '';
    const leftW = w * 0.42;
    const valueH = h * 0.5;
    extra += textBoxXml(id++, x, y, leftW, valueH, kpi.value, { size: 60, bold: true, color: RED_HEX, anchor: 'b', autofit: true });
    extra += textBoxXml(id++, x, y + valueH + 0.05, leftW, h * 0.2, kpi.label, { size: 18, bold: true, color: DARK_HEX, autofit: true });
    extra += textBoxXml(id++, x, y + valueH + 0.05 + h * 0.2, leftW, h * 0.15, kpi.sub || '', { size: 13, color: GRAY_HEX, autofit: true });

    const items = kpi.secondary || [];
    if(items.length){
      const rightX = x + leftW + 0.3;
      const rightW = w - leftW - 0.3;
      const rowH = Math.min(1.05, h / items.length);
      items.forEach((s, i) => {
        const ry = y + i * rowH;
        const cardH = rowH * 0.82;
        extra += cardRectXml(id++, rightX, ry, rightW, cardH);
        extra += textBoxXml(id++, rightX + 0.2, ry, rightW * 0.58, cardH, s.label, { size: 14, color: GRAY_HEX, anchor: 'ctr' });
        extra += textBoxXml(id++, rightX + rightW * 0.55, ry, rightW * 0.4, cardH, s.value, { size: 18, bold: true, color: DARK_HEX, align: 'r', anchor: 'ctr' });
      });
    }
    return { xml: extra, nextId: id };
  }

  // Lista de ranking con barras (p.ej. "Bajas por Asesor", "Aprovechamiento
  // por AT"), dentro de los limites (x,y,w,h) de una tarjeta existente de la
  // plantilla. opts.pct=true usa escala 0-100 y color por semaforo (95/85%)
  // en vez de color fijo por posicion, igual que addPctRankingList() de
  // admin-pptx-rae.js.
  function rankListInBoundsXml(idStart, x, y, w, h, title, items, opts = {}){
    let id = idStart, extra = '';
    let contentY = y;
    if(title){
      extra += textBoxXml(id++, x, y, w, 0.4, title, { size: 16, bold: true, color: DARK_HEX });
      contentY = y + 0.5;
    }
    if(!items || !items.length){
      extra += textBoxXml(id++, x, contentY, w, 0.5, 'Sin datos disponibles', { size: 13, color: GRAY_HEX });
      return { xml: extra, nextId: id };
    }
    const availH = (y + h) - contentY;
    const rowH = Math.min(0.5, availH / items.length);
    const maxVal = opts.pct ? 100 : Math.max(...items.map(it => it.value), 1);
    const nameW = w * 0.34;
    const barX = x + nameW + 0.1;
    const barW = w - nameW - 1.0;
    const pillW = 0.85;
    items.forEach((item, i) => {
      const ry = contentY + i * rowH;
      const color = opts.pct ? (item.value >= 95 ? '00A878' : (item.value >= 85 ? 'D99A00' : RED_HEX)) : (i === 0 ? RED_HEX : 'D99A00');
      extra += textBoxXml(id++, x, ry, nameW - 0.1, rowH, item.name, { size: 10.5, color: DARK_HEX, anchor: 'ctr' });
      extra += cardRectXml(id++, barX, ry + rowH * 0.32, barW, rowH * 0.36);
      const fillW = Math.max(barW * (Math.min(item.value, maxVal) / maxVal), 0.06);
      extra += fillBarXml(id++, barX, ry + rowH * 0.32, fillW, rowH * 0.36, color);
      const valText = opts.pct ? `${item.value.toFixed(1)}%` : String(item.value);
      extra += textBoxXml(id++, x + w - pillW, ry, pillW, rowH, valText, { size: 11, bold: true, color: RED_HEX, align: 'r', anchor: 'ctr' });
    });
    return { xml: extra, nextId: id };
  }

  async function generatePresentation(){
    const statusEl = document.getElementById('pptx-status');
    const btn = document.getElementById('generate-pptx-btn');
    btn.disabled = true;
    btn.textContent = 'Generando...';
    if(statusEl) statusEl.textContent = 'Consultando Google Sheets...';
    try {
      const results = {};
      for(const d of DASHBOARDS){
        try { results[d.name] = await d.fn(); }
        catch(e) { console.error('Error KPI', d.name, e); results[d.name] = null; }
      }
      let extraD1 = null;
      try { extraD1 = await extraD1Stats(); } catch(e){ console.error('Error extraD1Stats', e); }

      if(statusEl) statusEl.textContent = 'Rellenando plantilla...';
      const resp = await fetch(TEMPLATE_URL, { cache: 'no-store' });
      if(!resp.ok) throw new Error(`No se pudo cargar la plantilla (HTTP ${resp.status})`);
      const buf = await resp.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);

      // Slide 1 (Vacantes): ya trae el diseño completo con datos de ejemplo,
      // solo se reemplazan los valores por los reales.
      const kpiD1v = results['Dashboard 1 · Vacantes'];
      if(kpiD1v){
        const path = 'ppt/slides/slide1.xml';
        let xml = await zip.file(path).async('string');
        const byPuesto = {};
        (kpiD1v.secondary || []).forEach(s => { byPuesto[s.label] = s.value; });
        xml = replaceAllText(xml, '37', String(kpiD1v.value));
        xml = replaceAllText(xml, '7', byPuesto['Encargado'] ?? '7');
        xml = replaceAllText(xml, '30', byPuesto['Ayudante'] ?? '30');
        if(extraD1){
          xml = replaceAllText(xml, '28 días', `${extraD1.maxDias} días`);
          xml = replaceAllText(xml, '9 asesores afectados', `${extraD1.asesoresAfectados} asesores afectados`);
          // Badge "OXXO Amilpas OAX" esta partido en 3 runs; se deja el nombre
          // completo en el run del medio y se vacian los otros dos.
          xml = replaceAllText(xml, 'Amilpas', extraD1.maxTienda || 'Amilpas');
          xml = replaceAllText(xml, 'OXXO ', '');
          xml = replaceAllText(xml, ' OAX', '');
          const oldNames = ['OXXO AMILPAS OAX', 'OXXO EMILIO OAX', 'OXXO LOS TAMARINDOS VSA', 'OXXO CARRIZALILLO ', 'OXXO LA VENTOSA'];
          extraD1.top5.forEach(([name], i) => {
            if(oldNames[i]) xml = replaceAllText(xml, oldNames[i], name);
          });
          extraD1.top5.forEach(([, count], i) => {
            xml = replaceNthText(xml, '2 vac.', `${count} vac.`, 0);
          });
        }
        zip.file(path, xml);
      }

      // Slides 2-7: por instrucción explícita del usuario, se dejan TAL COMO
      // ESTÁN en la plantilla (solo título), sin agregar tarjetas ni
      // rankings. Los intentos anteriores de inyectar contenido propio en
      // estas diapositivas causaron texto encimado con el diseño del
      // template; en vez de seguir ajustando coordenadas a ciegas (no hay
      // forma de renderizar el .pptx visualmente en este entorno para
      // verificarlo), se deja el resto del archivo intacto.

      const out = await zip.generateAsync({ type: 'blob' });
      const today = new Date();
      const fileName = `Presentacion-Foro-Bienestar-Dias-Martes-${today.toISOString().slice(0,10)}.pptx`;
      OXXO.downloadBlob(out, fileName);
      if(statusEl) statusEl.textContent = 'Presentación generada correctamente.';
    } catch(e){
      console.error(e);
      if(statusEl) statusEl.textContent = 'Error al generar la presentación: ' + e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '📊 Generar Presentación Foro Bienestar Días Martes';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('generate-pptx-btn');
    if(btn) btn.addEventListener('click', generatePresentation);
  });
})();
