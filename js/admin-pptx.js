(function(){
  function findKey(row, aliases){
    const clean = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
    const keys = Object.keys(row||{});
    const map = new Map(keys.map(k => [clean(k), k]));
    for(const a of aliases){ const found = map.get(clean(a)); if(found) return found; }
    for(const a of aliases){ const ca = clean(a); const found = keys.find(k => clean(k).includes(ca) || ca.includes(clean(k))); if(found) return found; }
    return null;
  }
  function val(row, key, fallback=''){ const v = key ? row[key] : undefined; return (v===undefined||v===null||String(v).trim()==='') ? fallback : v; }
  function num(v){ const n = Number(String(v??'').replace(/[$,%]/g,'').replace(/,/g,'').trim()); return Number.isFinite(n) ? n : 0; }
  function normText(v){ return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase(); }
  function latestByKey(rows, key){
    const vals = [...new Set(rows.map(r => String(r[key]||'').trim()).filter(Boolean))];
    return vals.sort().slice(-1)[0] || '';
  }
  function tipoPuesto(desc){
    const d = normText(desc);
    if(d.includes('LIDER')) return 'Lider';
    if(d.includes('ENCARGADO')) return 'Encargado';
    if(d.includes('AYUDANTE')) return 'Ayudante';
    return 'Otro';
  }
  // ── Helpers portados y verificados contra datos reales en
  // js/admin-pptx-rae.js: replican el mismo comportamiento (bugs
  // incluidos) de dashboard-1.html/dashboard-7.html para que esta
  // presentacion coincida con lo que esos dashboards muestran de verdad.
  const MES_ABBR = {
    ene:1, enero:1, feb:2, febrero:2, mar:3, marzo:3, abr:4, abril:4,
    may:5, mayo:5, jun:6, junio:6, jul:7, julio:7, ago:8, agosto:8,
    sep:9, sept:9, septiembre:9, set:9, setiembre:9,
    oct:10, octubre:10, nov:11, noviembre:11, dic:12, diciembre:12,
  };
  function normalizeMonthKey(value){
    const raw = String(value ?? '').trim();
    if(!raw) return '';
    const clean = raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[._/]+/g,'-').replace(/\s+/g,'-').trim();
    let m = clean.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
    if(m) return `${m[1]}-${String(+m[2]).padStart(2,'0')}`;
    m = clean.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
    if(m){ const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return `${y}-${String(+m[2]).padStart(2,'0')}`; }
    m = clean.match(/^([a-z]+)-?(\d{2,4})$/);
    if(m && MES_ABBR[m[1]]){ const y = +m[2] < 100 ? 2000 + +m[2] : +m[2]; return `${y}-${String(MES_ABBR[m[1]]).padStart(2,'0')}`; }
    m = clean.match(/^(\d{1,2})-([a-z]+)-(\d{2,4})$/);
    if(m && MES_ABBR[m[2]]){ const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return `${y}-${String(MES_ABBR[m[2]]).padStart(2,'0')}`; }
    return '';
  }
  function parseFechaVacante(value){
    const raw = String(value ?? '').trim();
    if(!raw) return null;
    if(/^\d+(\.\d+)?$/.test(raw)){
      const serial = Number(raw);
      if(serial > 25000 && serial < 80000){
        const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
        return isNaN(d) ? null : d;
      }
    }
    const clean = raw.replace(/\s+\d{1,2}:\d{2}(:\d{2})?.*$/, '').replace(/[.]/g,'/').replace(/-/g,'/');
    const parts = clean.split('/').map(p => p.trim()).filter(Boolean);
    if(parts.length >= 3){
      let day, month, year;
      if(parts[0].length === 4){ year = Number(parts[0]); month = Number(parts[1]); day = Number(parts[2]); }
      else { day = Number(parts[0]); month = Number(parts[1]); year = Number(parts[2]); }
      if(year < 100) year += 2000;
      const d = new Date(year, month - 1, day);
      if(!isNaN(d) && d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) return d;
    }
    const d = new Date(raw);
    return isNaN(d) ? null : d;
  }
  function mesKeyFromDate(date){
    if(!date) return '';
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  }
  // Replica EXACTA (con su mismo bug) de normalizeMesColumn() en
  // dashboard-1.html: la columna "Mes" de Dashboard_1_Diario trae una
  // fecha de corte completa ("26/07/2026"), y esta funcion (igual que la
  // real) solo lee las 2 primeras partes tras separar por guiones, asi
  // que interpreta mal el mes y siempre falla -> regresa el texto crudo
  // tal cual como clave de agrupacion (nunca cae al respaldo por "Fecha"
  // mientras "Mes" no este vacio, igual que el dashboard real).
  function normalizeMesColumnD1(value){
    const raw = String(value ?? '').trim();
    if(!raw) return '';
    const clean = raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[._/]+/g,'-');
    const parts = clean.split('-').map(p => p.trim()).filter(Boolean);
    let month = 0, year = 0;
    if(parts.length >= 2){
      month = MES_ABBR[parts[0]] || Number(parts[0]) || 0;
      year = Number(parts[1]) || 0;
    } else {
      const m = clean.match(/^([a-z]+)\s*(\d{2,4})$/);
      if(m){ month = MES_ABBR[m[1]] || 0; year = Number(m[2]) || 0; }
    }
    if(year > 0 && year < 100) year += 2000;
    if(month >= 1 && month <= 12 && year >= 2000) return `${year}-${String(month).padStart(2,'0')}`;
    return raw;
  }
  function rowMonthKeyD1(row, mesKey, fechaKey){
    return normalizeMesColumnD1(val(row, mesKey)) || mesKeyFromDate(parseFechaVacante(val(row, fechaKey)));
  }
  function rowMonthKeyD2(row, mesKey, fechaKey){
    return normalizeMonthKey(val(row, mesKey)) || normalizeMonthKey(val(row, fechaKey));
  }
  function filterLatestMonth(rows, rowKeyFn){
    const keyed = rows.map(r => ({ r, k: rowKeyFn(r) }));
    const keys = [...new Set(keyed.map(x => x.k).filter(Boolean))].sort();
    const mes = keys.slice(-1)[0] || '';
    if(!mes) return { mes: '', rows };
    return { mes, rows: keyed.filter(x => x.k === mes).map(x => x.r) };
  }
  // findDataKey: como findKey(), pero cuando varias columnas matchean el
  // alias (ej. hojas con encabezados corruptos por exportacion de Google
  // donde el texto real queda pegado en columnas vecinas), elige la que de
  // verdad tiene datos en vez de la primera que coincide por texto.
  function findDataKey(rows, aliases, sample=25, numeric=false){
    if(!rows || !rows.length) return null;
    const clean = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
    const keys = Object.keys(rows[0]||{});
    const exact = [], partial = [];
    for(const a of aliases){
      const ca = clean(a);
      for(const k of keys){
        const ck = clean(k);
        if(ck === ca) exact.push(k);
        else if(ck.includes(ca) || ca.includes(ck)) partial.push(k);
      }
    }
    const candidates = [...new Set([...exact, ...partial])];
    if(!candidates.length) return null;
    const n = Math.min(sample, rows.length);
    const isNum = v => v !== '' && Number.isFinite(Number(String(v).replace(/,/g,'').trim()));
    let best = candidates[0], bestScore = -1;
    for(const k of candidates){
      let score = 0;
      for(let i = 0; i < n; i++){
        const v = String(rows[i][k]??'').trim();
        if(!v) continue;
        score += (numeric ? (isNum(v) ? 1 : 0) : 1);
      }
      if(score > bestScore){ bestScore = score; best = k; }
    }
    return best;
  }
  function normKeyD7(s){
    return String(s||'')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }
  function hasTreoHeaderValuesD7(row){
    const values = Object.values(row || {}).map(v => normKeyD7(v));
    const hits = ['zona','plaza','tienda','id_tienda','at_ro','estructura_sap','movimiento_inicial']
      .filter(h => values.includes(h)).length;
    return hits >= 4;
  }
  function coerceTreoRowsD7(rows){
    if(!Array.isArray(rows) || !rows.length) return [];
    if(!hasTreoHeaderValuesD7(rows[0])) return rows;
    const sourceKeys = Object.keys(rows[0]);
    const headers = sourceKeys.map((key, idx) => {
      const value = String(rows[0][key] || '').trim();
      return value || `col_${idx + 1}`;
    });
    return rows.slice(1).map(raw => {
      const out = {};
      sourceKeys.forEach((key, idx) => { out[headers[idx]] = raw[key]; });
      return out;
    });
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
    const DEFAULT_PUESTOS_D1 = new Set([
      'ENCARGADO TURNO', 'ENCARGADO TURNO SATELITE',
      'LIDER TIENDA', 'LIDER TIENDA SATELITE',
      'AYUDANTE TIENDA', 'AYUDANTE TIENDA SATELITE',
    ]);
    const isDefaultExcludedTiendaD1 = v => {
      const t = normText(v);
      return t.includes('ENTRENAMIENTO') || t.includes('OPERACIONES');
    };
    const pasaAntiguedadDefaultD1 = r => {
      const dias = num(val(r, diasKey));
      const diasRaw = String(val(r, diasKey)||'').trim();
      const esTiendaNueva = dias > 500 || diasRaw === '';
      if(esTiendaNueva) return false;
      return dias >= 1;
    };
    const base = raw
      .filter(r => String(val(r, tiendaKey)||'').trim() && String(val(r, tiendaKey)||'').trim() !== 'Sin tienda')
      .filter(r => normText(val(r, asesorKey)).replace(/[^A-Z]/g,'') !== 'TIMOTEOANTONIOPEREZ')
      .filter(r => OXXO.isTiendaValid(asesorCatalog, val(r, tiendaKey), val(r, crKey)))
      .filter(r => !isDefaultExcludedTiendaD1(val(r, tiendaKey)))
      .filter(r => normText(val(r, asesorKey)).replace(/[^A-Z]/g,'') !== 'SINASESORASIGNADO')
      .filter(r => DEFAULT_PUESTOS_D1.has(String(val(r, puestoKey)||'').trim().toUpperCase()))
      .filter(pasaAntiguedadDefaultD1);
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
    let base = raw.filter(r => String(val(r, asesorKey)||'').trim() && normText(val(r, asesorKey)).replace(/[^A-Z]/g,'') !== 'TIMOTEOANTONIOPEREZ');
    if(medidaKey){
      const bajas = base.filter(r => normText(val(r, medidaKey)).includes('BAJA'));
      if(bajas.length) base = bajas;
    }
    if(plazaKey){
      const oax = base.filter(r => normText(val(r, plazaKey)).includes('OAXACA'));
      if(oax.length) base = oax;
    }
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
    };
  }

  async function kpiD3(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d3);
    if(!raw || !raw.length) return null;
    const estatusKey = findKey(raw[0], ['Clas Aprov','Estatus Con impacto Ausentismo','Estatus']);
    const fechaKey = findKey(raw[0], ['Mes Semana','Semana','Fecha','FECHA']);
    // Igual que dashboard-3.html: limitar al corte de la fecha mas
    // reciente, para no mezclar dias distintos si llegaran a quedar
    // varias fechas en la misma hoja.
    const fecha = latestByKey(raw, fechaKey);
    const rows = fecha ? raw.filter(r => String(r[fechaKey]||'').trim() === fecha) : raw;
    const total = rows.length;
    let completas = 0, incompletas = 0, criticas = 0;
    rows.forEach(r => {
      const s = normText(val(r, estatusKey));
      if(s.includes('CRIT')) criticas++;
      else if(s.includes('INCOMPLETO')) incompletas++;
      else if(s.includes('COMPLETO')) completas++;
    });
    const pct = total > 0 ? (completas / total * 100) : 0;
    return {
      label: 'Aprovechamiento General', value: pct.toFixed(2) + '%', sub: 'Plaza Oaxaca',
      secondary: [
        { label: 'Completas', value: String(completas) },
        { label: 'Incompletas', value: String(incompletas) },
        { label: 'Criticas', value: String(criticas) },
      ],
      chart: { title: 'Tiendas por Estatus', labels: ['Completas','Incompletas','Criticas'], values: [completas, incompletas, criticas], type: 'pie' },
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
    // Semana mas reciente por orden NUMERICO (parseInt de los digitos del
    // texto, ej. "Sem 28" -> 28), igual que dashboard-6.html — un orden de
    // texto simple falla entre semanas de una y dos cifras (ej. "Sem 9" >
    // "Sem 28" alfabeticamente).
    const semanas = [...new Set(base.map(r => String(val(r, semanaKey)||'').trim()).filter(Boolean))]
      .sort((a,b) => (parseInt(a.replace(/\D+/g,''),10)||0) - (parseInt(b.replace(/\D+/g,''),10)||0));
    const semana = semanas[semanas.length - 1] || '';
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

  const DASHBOARDS = [
    { name: 'Dashboard 1 · Vacantes', fn: kpiD1 },
    { name: 'Dashboard 2 · Bajas', fn: kpiD2 },
    { name: 'Dashboard 3 · Aprovechamiento', fn: kpiD3 },
    { name: 'Dashboard 4 · Tiempo Extra', fn: kpiD4 },
    { name: 'Dashboard 5 · Vacaciones', fn: kpiD5 },
    { name: 'Dashboard 6 · Ausentismos', fn: kpiD6 },
    { name: 'Dashboard 7 · TREO', fn: kpiD7 },
  ];

  const RED = 'F71926';
  const DARK = '211312';
  const GRAY = '7A4A42';
  const PALETTE = ['F71926','F07B22','F6B73C','1DB954','0066CC','8B4CF7','9E9E9E'];

  function addKpiSlide(pptx, name, kpi){
    const slide = pptx.addSlide();
    slide.background = { color: 'FFF8EF' };
    slide.addText(name, { x: 0.4, y: 0.3, w: 9.2, h: 0.5, fontSize: 22, bold: true, color: DARK, fontFace: 'Arial' });

    if(!kpi){
      slide.addText('Sin datos disponibles', { x: 0.4, y: 2.3, w: 9.2, h: 0.6, fontSize: 22, color: GRAY, align: 'center', fontFace: 'Arial' });
      return;
    }

    // KPI principal (izquierda)
    slide.addText(kpi.value, { x: 0.4, y: 1.0, w: 4.2, h: 1.3, fontSize: 56, bold: true, color: RED, align: 'center', fontFace: 'Arial' });
    slide.addText(kpi.label, { x: 0.4, y: 2.25, w: 4.2, h: 0.45, fontSize: 15, color: DARK, align: 'center', fontFace: 'Arial', bold: true });
    slide.addText(kpi.sub || '', { x: 0.4, y: 2.65, w: 4.2, h: 0.35, fontSize: 11, color: GRAY, align: 'center', fontFace: 'Arial' });

    // KPIs secundarios (debajo del principal)
    (kpi.secondary || []).forEach((s, i) => {
      const y = 3.15 + i * 0.62;
      slide.addShape(pptx.ShapeType.roundRect, { x: 0.4, y, w: 4.2, h: 0.52, fill: { color: 'FFFFFF' }, line: { color: 'EFE2DC', width: 1 }, rectRadius: 0.08 });
      slide.addText(s.label, { x: 0.55, y: y + 0.06, w: 2.6, h: 0.4, fontSize: 12, color: GRAY, fontFace: 'Arial', valign: 'middle' });
      slide.addText(s.value, { x: 3.1, y: y + 0.06, w: 1.4, h: 0.4, fontSize: 14, bold: true, color: DARK, align: 'right', fontFace: 'Arial', valign: 'middle' });
    });

    // Gráfica (derecha)
    if(kpi.chart && kpi.chart.values.some(v => v > 0)){
      const chartType = kpi.chart.type === 'pie' ? pptx.ChartType.pie : pptx.ChartType.bar;
      const dataSeries = [{ name: kpi.chart.title, labels: kpi.chart.labels, values: kpi.chart.values }];
      slide.addText(kpi.chart.title, { x: 4.9, y: 0.9, w: 4.7, h: 0.35, fontSize: 13, bold: true, color: DARK, fontFace: 'Arial' });
      slide.addChart(chartType, dataSeries, {
        x: 4.85, y: 1.25, w: 4.75, h: 3.9,
        chartColors: PALETTE,
        showLegend: true, legendPos: 'b', legendFontSize: 9,
        showValue: kpi.chart.type === 'pie',
        dataLabelFontSize: 10,
        catAxisLabelFontSize: 10,
        valAxisLabelFontSize: 10,
      });
    }
  }

  async function generatePresentation(){
    const statusEl = document.getElementById('pptx-status');
    const btn = document.getElementById('generate-pptx-btn');
    btn.disabled = true;
    btn.textContent = 'Generando...';
    if(statusEl) statusEl.textContent = 'Consultando Google Sheets...';
    try {
      const results = [];
      for(const d of DASHBOARDS){
        try {
          const kpi = await d.fn();
          results.push({ name: d.name, kpi });
        } catch(e) {
          console.error('Error KPI', d.name, e);
          results.push({ name: d.name, kpi: null });
        }
      }

      const pptx = new window.PptxGenJS();
      pptx.defineLayout({ name: 'OXXO', width: 10, height: 5.63 });
      pptx.layout = 'OXXO';

      const title = pptx.addSlide();
      title.background = { color: RED };
      title.addText('Presentación Foro Bienestar Días Martes', { x: 0.6, y: 1.6, w: 8.8, h: 1.3, fontSize: 34, bold: true, color: 'FFFFFF', fontFace: 'Arial' });
      title.addText('Indicadores clave · Plaza Oaxaca', { x: 0.6, y: 2.9, w: 8.8, h: 0.5, fontSize: 18, color: 'FFD7D5', fontFace: 'Arial' });
      const today = new Date();
      title.addText(today.toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' }), { x: 0.6, y: 4.8, w: 8.8, h: 0.4, fontSize: 12, color: 'FFD7D5', fontFace: 'Arial' });

      results.forEach(({ name, kpi }) => addKpiSlide(pptx, name, kpi));

      const fileName = `Presentacion-Foro-Bienestar-Dias-Martes-${today.toISOString().slice(0,10)}.pptx`;
      await pptx.writeFile({ fileName });
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
