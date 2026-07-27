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
  // Misma regla que normalizePct() en dashboard-3.html: solo se divide entre
  // 100 cuando el valor viene claramente duplicado por el formato Porcentaje
  // de Sheets (>150). Un aprovechamiento real de 100-150% (tienda con mas
  // activos de los necesarios) no se debe tocar.
  function normPct(v){ const n = num(v); return n > 150 ? n / 100 : n; }
  function normText(v){ return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase(); }
  // Acorta un nombre largo a "Nombre(s) Apellido1 A." (inicial del ultimo
  // apellido) en vez de cortarlo a solo el primer nombre: la plaza suele tener
  // varios asesores que comparten nombre de pila, asi que recortar de mas
  // volveria a confundirlos.
  function shortenName(name, maxChars = 24){
    const trimmed = String(name || '').trim();
    if(trimmed.length <= maxChars) return trimmed;
    const parts = trimmed.split(/\s+/);
    if(parts.length <= 2) return trimmed;
    return `${parts.slice(0, -1).join(' ')} ${parts[parts.length - 1][0]}.`;
  }
  function latestByKey(rows, key){
    const vals = [...new Set(rows.map(r => String(r[key]||'').trim()).filter(Boolean))];
    return vals.sort().slice(-1)[0] || '';
  }
  // Igual que normalizeMonthKey()/normalizeMesColumn() en dashboard-1.html y
  // dashboard-2.html: convierte "Mes" (texto tipo "jul-26", "07-2026",
  // "2026-07") a una clave canonica "YYYY-MM". Sin esto, ordenar el texto
  // crudo alfabeticamente ("ago-26" < "ene-26" < "jul-26") no coincide con el
  // orden cronologico real y puede elegir un mes distinto al que muestra el
  // dashboard.
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
  // Devuelve { mes: <clave canonica YYYY-MM>, rows: <filas de ese mes segun
  // la clave canonica, no el texto crudo> }. Si ninguna fila tiene un mes
  // reconocible, regresa todas las filas sin filtrar (igual que cuando
  // mesKey no existe).
  // Igual que parseFechaVacante()+mesKeyFromDate() en dashboard-1.html: si el
  // texto de "Mes" no es reconocible, intenta leer una fecha (serial de Excel
  // o texto dd/mm/aaaa, aaaa-mm-dd, etc.) y deriva el mes de ahi.
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
  // Clave de mes por fila igual que dashboard-1.html
  // (mesInfo.key || mesKeyFromDate(fechaObj)): si "Mes" no se puede
  // normalizar, se deriva del valor de "Fecha" parseado como fecha real
  // (no solo texto tipo "jul-26").
  function rowMonthKeyD1(row, mesKey, fechaKey){
    return normalizeMonthKey(val(row, mesKey)) || mesKeyFromDate(parseFechaVacante(val(row, fechaKey)));
  }
  // Clave de mes por fila igual que monthKeyFromRow() en dashboard-2.html:
  // normalizeMonthKey(Mes) || normalizeMonthKey(Fecha) (aqui si el fallback
  // es solo texto, sin parsear fecha completa).
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
  function tipoPuesto(desc){
    const d = normText(desc);
    if(d.includes('LIDER')) return 'Lider';
    if(d.includes('ENCARGADO')) return 'Encargado';
    if(d.includes('AYUDANTE')) return 'Ayudante';
    return 'Otro';
  }
  // Ranking de conteo por nombre (p.ej. vacantes o bajas por Asesor), top N descendente.
  function rankCount(rows, nameKey, limit){
    const counts = new Map();
    rows.forEach(r => {
      const name = String(val(r, nameKey)||'').trim();
      if(!name) return;
      counts.set(name, (counts.get(name)||0) + 1);
    });
    return [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, limit);
  }
  // Ranking de promedio por nombre (p.ej. % aprovechamiento por AT), ordenado descendente.
  function rankAvg(rows, nameKey, valueKey, limit){
    const sums = new Map(), counts = new Map();
    rows.forEach(r => {
      const name = String(val(r, nameKey)||'').trim();
      if(!name) return;
      sums.set(name, (sums.get(name)||0) + num(val(r, valueKey)));
      counts.set(name, (counts.get(name)||0) + 1);
    });
    return [...sums.entries()].map(([name, sum]) => ({ name, value: sum / counts.get(name) })).sort((a,b) => b.value - a.value).slice(0, limit);
  }
  async function dataD1(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d1);
    if(!raw || !raw.length) return null;
    const mesKey = findKey(raw[0], ['Mes']);
    const puestoKey = findKey(raw[0], ['Descripcion de Posicion','Puesto']);
    const asesorKey = findKey(raw[0], ['Asesor']);
    const tiendaKey = findKey(raw[0], ['Tienda','Unidad org']);
    const crKey = findKey(raw[0], ['CR TIENDA','CR']);
    const fechaKey = findKey(raw[0], ['Fecha']);
    // dashboard-1.html filtra TODA la base cargada (no solo el mes activo) por:
    // tienda no vacia, excluir 'timoteoantonioperez', y el catalogo de 255
    // tiendas autorizadas (isTiendaValid). Sin esto se cuentan filas de
    // tiendas/plazas que el dashboard real nunca muestra.
    const asesorCatalog = await OXXO.loadAsesorCatalog();
    console.log('[RAE][D1] raw.length=', raw.length, { mesKey, puestoKey, asesorKey, tiendaKey, crKey, fechaKey });
    console.log('[RAE][D1] catalog.loaded=', asesorCatalog && asesorCatalog.loaded, 'validTiendas.size=', asesorCatalog && asesorCatalog.validTiendas && asesorCatalog.validTiendas.size);
    const stepTienda = raw.filter(r => String(val(r, tiendaKey)||'').trim() && String(val(r, tiendaKey)||'').trim() !== 'Sin tienda');
    const stepTimoteo = stepTienda.filter(r => normText(val(r, asesorKey)).replace(/[^A-Z]/g,'') !== 'TIMOTEOANTONIOPEREZ');
    const base = stepTimoteo.filter(r => OXXO.isTiendaValid(asesorCatalog, val(r, tiendaKey), val(r, crKey)));
    console.log('[RAE][D1] tras tienda no vacia=', stepTienda.length, '/ tras excluir timoteo=', stepTimoteo.length, '/ tras catalogo=', base.length);
    const { mes, rows } = filterLatestMonth(base, r => rowMonthKeyD1(r, mesKey, fechaKey));
    console.log('[RAE][D1] mes elegido=', mes, '/ filas de ese mes=', rows.length);
    const mesesDisponibles = [...new Set(base.map(r => rowMonthKeyD1(r, mesKey, fechaKey)).filter(Boolean))].sort();
    console.log('[RAE][D1] meses disponibles en base=', mesesDisponibles, '(conteo por mes:', mesesDisponibles.map(m => `${m}:${base.filter(r=>rowMonthKeyD1(r,mesKey,fechaKey)===m).length}`).join(', '), ')');
    const byPuesto = { Lider: 0, Encargado: 0, Ayudante: 0, Otro: 0 };
    rows.forEach(r => { byPuesto[tipoPuesto(val(r, puestoKey))]++; });
    return {
      total: rows.length, sub: mes ? `Mes ${mes}` : 'Plaza Oaxaca',
      byPuesto,
      ranking: rankCount(rows, asesorKey, 15),
    };
  }

  async function dataD2(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d2);
    if(!raw || !raw.length) return null;
    const mesKey = findKey(raw[0], ['Mes']);
    const asesorKey = findKey(raw[0], ['Asesor']);
    const puestoKey = findKey(raw[0], ['Puesto']);
    const medidaKey = findKey(raw[0], ['Denominación Medida','Denominacion Medida','Medida','Med.']);
    const plazaKey = findKey(raw[0], ['Plaza']);
    const fechaKey = findKey(raw[0], ['Fecha']);
    const asesorCrudoOk = r => String(val(r, asesorKey)||'').trim() && normText(val(r, asesorKey)).replace(/[^A-Z]/g,'') !== 'TIMOTEOANTONIOPEREZ';
    // Igual que filterData() en dashboard-2.html: si la hoja trae columna de
    // Medida, quedarse solo con movimientos de BAJA; si trae Plaza, quedarse
    // solo con Oaxaca. Cada filtro solo se aplica si existe la columna y deja
    // al menos una fila (mismo criterio "solo si aplica" del dashboard).
    let base = raw.filter(r => asesorCrudoOk(r));
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
      total: rows.length, sub: mes ? `Mes ${mes}` : 'Plaza Oaxaca',
      byPuesto,
      ranking: rankCount(rows, asesorKey, 15),
    };
  }

  async function dataD3(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d3);
    if(!raw || !raw.length) return null;
    const estatusKey = findKey(raw[0], ['Clas Aprov','Estatus Con impacto Ausentismo','Estatus']);
    const asesorKey = findKey(raw[0], ['Asesor']);
    const ecPorAtKey = findKey(raw[0], ['Ec','EC','Ec por AT','EC POR AT','EC por AT','Ec Por AT']);
    const atKey = findKey(raw[0], ['Ats','ATS','AT','At']);
    const fechaKey = findKey(raw[0], ['Mes Semana','Semana','Fecha','FECHA']);
    // Igual que Dashboard 3: aunque cada carga deberia reemplazar toda la
    // pestana (foto diaria), si llegaran a quedar varias fechas mezcladas se
    // usa solo la mas reciente, para no promediar dias distintos.
    const fecha = latestByKey(raw, fechaKey);
    const rows = fecha ? raw.filter(r => String(r[fechaKey]||'').trim() === fecha) : raw;
    const total = rows.length;
    // Misma clasificacion que isCompleta/isIncompleta/isCritica de
    // dashboard-3.html (por texto de Estatus, no por umbral numerico).
    const clasifica = r => {
      const s = normText(val(r, estatusKey));
      if(s.includes('CRIT')) return 'criticas';
      if(s.includes('INCOMPLETO')) return 'incompletas';
      if(s.includes('COMPLETO')) return 'completas';
      return null;
    };
    let completas = 0, incompletas = 0, criticas = 0;
    rows.forEach(r => {
      const c = clasifica(r);
      if(c === 'criticas') criticas++;
      else if(c === 'incompletas') incompletas++;
      else if(c === 'completas') completas++;
    });
    // "Aprovechamiento General" del Dashboard 3 = Equipo Completo / Total (EC%).
    const pct = total > 0 ? (completas / total * 100) : 0;

    // El gauge de OAXACA en "Aprovechamiento por Plaza" reutiliza ese mismo
    // EC% (asi lo calcula dashboard-3.html cuando no hay una columna de plaza
    // por tienda separada) — no es un promedio del aprovechamiento crudo.
    const oaxacaAvg = pct;

    let plazas = [];
    try {
      const otras = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d3plazas);
      if(otras && otras.length){
        const plazaKey = findKey(otras[0], ['PLAZAS','Plaza']);
        const valKey = findKey(otras[0], ['Aprovechamiento de estructura a hoy','Aprovechamiento']);
        plazas = otras.map(r => ({ name: String(val(r, plazaKey)||'').trim(), value: normPct(val(r, valKey)) })).filter(p => p.name);
      }
    } catch(e){ /* sin datos de otras plazas: se muestra solo Oaxaca */ }
    plazas.push({ name: 'OAXACA', value: oaxacaAvg });
    plazas.sort((a,b) => b.value - a.value);

    // "Aprovechamiento por AT" = tabla EC% (AT) del Dashboard 3: usa la
    // columna 'Ec por AT' de la hoja si viene poblada; si no, cae al mismo
    // EC% (completas/total) calculado por asesor con la clasificacion de
    // Estatus de arriba — nunca el umbral sobre el valor crudo.
    // Dashboard-3.html cruza el EC% (columna 'Ec por AT') por la columna 'AT'
    // (no 'Asesor'), y ese promedio se calcula sobre TODA la base cargada
    // (ALL_DATA, sin filtrar por fecha/semana) — "fijo, no depende de
    // filtros". El resto (total de tiendas y EC% de respaldo) sí usa solo
    // las filas de la fecha mas reciente.
    const ecByAt = new Map();
    if(ecPorAtKey && atKey){
      raw.forEach(r => {
        const ecVal = normPct(val(r, ecPorAtKey));
        const atName = String(val(r, atKey)||'').trim().toUpperCase();
        if(!(ecVal > 0) || !atName) return;
        if(!ecByAt.has(atName)) ecByAt.set(atName, { sum: 0, n: 0 });
        const acc = ecByAt.get(atName);
        acc.sum += ecVal; acc.n++;
      });
    }
    const byAsesor = new Map();
    rows.forEach(r => {
      const name = String(val(r, asesorKey)||'').trim();
      if(!name) return;
      if(!byAsesor.has(name)) byAsesor.set(name, { total: 0, completas: 0 });
      const acc = byAsesor.get(name);
      acc.total++;
      if(clasifica(r) === 'completas') acc.completas++;
    });
    const ranking = [...byAsesor.entries()]
      .map(([name, v]) => {
        const ecAt = ecByAt.get(name.trim().toUpperCase());
        const ec = v.total > 0 ? v.completas / v.total : 0;
        return { name, value: ecAt ? ecAt.sum / ecAt.n : ec * 100, hasData: !!ecAt || ec > 0 };
      })
      .filter(x => x.hasData)
      .sort((a,b) => b.value - a.value)
      .slice(0, 15);

    return {
      pct, completas, incompletas, criticas,
      plazas: plazas.slice(0, 5),
      ranking,
    };
  }

  // Replica buildActivosPorCR() de dashboard-7.html: el "Empleados Activos" de
  // TREO no se toma de su propia columna sino de Dashboard 3 (Estructura
  // Diaria - Vacante), por CR, tomando solo el corte de la FECHA mas reciente.
  async function buildActivosPorCR(){
    const rows = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d3);
    if(!rows || !rows.length) return new Map();
    const crKey = findKey(rows[0], ['CR TIENDA','CR']);
    const fechaKey = findKey(rows[0], ['FECHA','Fecha']);
    const estructuraKey = findKey(rows[0], ['Estructura Diaria']);
    const vacanteKey = findKey(rows[0], ['Vacante']);
    const fecha = latestByKey(rows, fechaKey);
    const map = new Map();
    rows.forEach(r => {
      if(fecha && String(val(r, fechaKey)||'').trim() !== fecha) return;
      const cr = String(val(r, crKey)||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
      if(!cr) return;
      const activos = Math.max(0, num(val(r, estructuraKey)) - num(val(r, vacanteKey)));
      map.set(cr, activos);
    });
    return map;
  }

  async function dataD7(){
    const [raw, activosPorCR] = await Promise.all([
      OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.s7),
      buildActivosPorCR(),
    ]);
    if(!raw || !raw.length) return null;
    const difKey = findKey(raw[0], ['Dif SAP vs Est Optima Final']);
    const treoKey = findKey(raw[0], ['Estructura Propuesta TREO P2 Jun - Ago','TREO']);
    const activosKey = findKey(raw[0], ['Empleados Activos','Activos']);
    const vacantesKey = findKey(raw[0], ['Vacantes']);
    const asesorKey = findKey(raw[0], ['Asesor']);
    // Mismos alias que pickField() en dashboard-7.html para 'tienda' y 'cr':
    // sin ellos, una hoja que use 'Unidad Organizativa' o 'ID Tienda' en vez
    // de 'Tienda'/'CR' se queda sin CR para el match por catalogo y cae al
    // respaldo por nombre de tienda, que es menos preciso.
    const tiendaKey = findKey(raw[0], ['Tienda','Nombre Tienda','Unidad','Unidad Org','Unidad Organizativa']);
    const crKey = findKey(raw[0], ['CR','ID Tienda','ID_Tienda']);
    // dashboard-7.html filtra por el catalogo de 255 tiendas autorizadas y
    // excluye 'timoteoantonioperez', igual que Dashboard 1.
    const asesorCatalog = await OXXO.loadAsesorCatalog();
    console.log('[RAE][D7] raw.length=', raw.length, { difKey, treoKey, activosKey, vacantesKey, asesorKey, tiendaKey, crKey });
    console.log('[RAE][D7] catalog.loaded=', asesorCatalog && asesorCatalog.loaded, 'validTiendas.size=', asesorCatalog && asesorCatalog.validTiendas && asesorCatalog.validTiendas.size, 'activosPorCR.size=', activosPorCR.size);
    const stepTiendaOAsesor = raw.filter(r => String(val(r, tiendaKey)||'').trim() || String(val(r, asesorKey)||'').trim());
    const stepCatalogo = stepTiendaOAsesor.filter(r => OXXO.isTiendaValid(asesorCatalog, val(r, tiendaKey), val(r, crKey)));
    const stepTimoteo = stepCatalogo.filter(r => normText(val(r, asesorKey)).replace(/[^A-Z]/g,'') !== 'TIMOTEOANTONIOPEREZ');
    console.log('[RAE][D7] tras tienda-o-asesor=', stepTiendaOAsesor.length, '/ tras catalogo=', stepCatalogo.length, '/ tras excluir timoteo=', stepTimoteo.length);
    const excluidasPorCatalogo = stepTiendaOAsesor.filter(r => !OXXO.isTiendaValid(asesorCatalog, val(r, tiendaKey), val(r, crKey)));
    if(excluidasPorCatalogo.length) console.log('[RAE][D7] ejemplo de filas excluidas por catalogo (hasta 5):', excluidasPorCatalogo.slice(0,5).map(r => ({ tienda: val(r,tiendaKey), cr: val(r,crKey) })));
    const rows = raw
      .filter(r => String(val(r, tiendaKey)||'').trim() || String(val(r, asesorKey)||'').trim())
      .filter(r => OXXO.isTiendaValid(asesorCatalog, val(r, tiendaKey), val(r, crKey)))
      .filter(r => normText(val(r, asesorKey)).replace(/[^A-Z]/g,'') !== 'TIMOTEOANTONIOPEREZ')
      .map(r => {
        const cr = String(val(r, crKey)||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
        const activosD3 = cr ? activosPorCR.get(cr) : undefined;
        return activosD3 !== undefined ? { ...r, [activosKey]: activosD3 } : r;
      });
    const total = rows.length;
    let alineadas = 0, subir = 0, bajar = 0, posSubir = 0, posBajar = 0;
    rows.forEach(r => {
      const d = num(val(r, difKey));
      if(d === 0) alineadas++;
      else if(d > 0) { subir++; posSubir += d; }
      else { bajar++; posBajar += -d; }
    });
    const totalTreo = rows.reduce((s,r) => s + num(val(r, treoKey)), 0);
    const totalActivos = rows.reduce((s,r) => s + num(val(r, activosKey)), 0);
    const totalVacantes = rows.reduce((s,r) => s + num(val(r, vacantesKey)), 0);
    const cobertura = totalTreo > 0 ? (totalActivos / totalTreo * 100) : 0;
    // "Sub-dotadas"/"Sobre-dotadas" NO son subir/bajar (esas comparan SAP vs
    // Est. Optima via 'dif'): dashboard-7.html las calcula aparte, comparando
    // Empleados Activos (ya con el override de D3 aplicado) contra el
    // objetivo TREO directamente por tienda.
    const subDotadas = rows.filter(r => num(val(r, activosKey)) < num(val(r, treoKey))).length;
    const sobreDotadas = rows.filter(r => num(val(r, activosKey)) > num(val(r, treoKey))).length;
    return {
      total, alineadas, subir, bajar, posSubir, posBajar,
      totalTreo, totalActivos, totalVacantes, cobertura,
      subDotadas, sobreDotadas,
    };
  }

  // ── Paleta y helpers visuales (misma estructura que RAE_BASE.pptx) ──
  const RED = 'CC0000', GOLD = 'FFC400', ORANGE = 'EE7203', DARK = '2B1714';
  const PINKBG = 'FCE8EA', TRACKBG = 'F4F4F4', BORDER = 'E2E2E2';
  const TEXT = '222222', MUTED = '777777', SUBTLE = 'FFE3E0', BADGETEXT = '5A3A00', WHITE = 'FFFFFF', GREEN = '00A878';
  const PAGE_W = 13.333, MARGIN_X = 0.45, HEADER_H = 0.92;

  function addHeader(slide, title, dateLabel){
    slide.addShape('rect', { x: 0, y: 0, w: PAGE_W, h: HEADER_H, fill: { color: RED }, line: { type: 'none' } });
    slide.addShape('rect', { x: 0, y: HEADER_H, w: PAGE_W, h: 0.05, fill: { color: GOLD }, line: { type: 'none' } });
    const fontSize = title.length > 22 ? 22 : 30;
    slide.addText(title, { x: MARGIN_X, y: 0, w: 7.5, h: HEADER_H, fontSize, bold: true, color: WHITE, fontFace: 'Arial', valign: 'middle', margin: 0 });
    slide.addShape('roundRect', { x: 8.05, y: 0.26, w: 2.55, h: 0.42, rectRadius: 0.08, fill: { color: GOLD }, line: { type: 'none' } });
    slide.addText('Plaza Oaxaca', { x: 8.05, y: 0.26, w: 2.55, h: 0.42, fontSize: 13, bold: true, color: BADGETEXT, fontFace: 'Arial', align: 'center', valign: 'middle', margin: 0 });
    slide.addText(`OXXO · Uso Interno · ${dateLabel}`, { x: 10.7, y: 0, w: 2.2, h: HEADER_H, fontSize: 10, color: SUBTLE, fontFace: 'Arial', align: 'right', valign: 'middle', margin: 0 });
  }

  function addSectionTitle(slide, x, y, w, text, rightText){
    slide.addShape('ellipse', { x, y: y + 0.05, w: 0.13, h: 0.13, fill: { color: RED }, line: { type: 'none' } });
    slide.addText(text, { x: x + 0.22, y, w: w - 0.22, h: 0.32, fontSize: 13, bold: true, color: TEXT, fontFace: 'Arial', margin: 0, valign: 'middle' });
    if(rightText){
      slide.addText(rightText, { x: x + w - 2.2, y, w: 2.2, h: 0.32, fontSize: 10, color: MUTED, fontFace: 'Arial', align: 'right', margin: 0, valign: 'middle' });
    }
  }

  function addHeroKpi(slide, x, y, w, h, value, label, sub){
    slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.12, fill: { color: RED }, line: { type: 'none' } });
    slide.addText(String(value), { x: x + 0.2, y: y + 0.12, w: w * 0.45, h: h - 0.24, fontSize: 56, bold: true, color: WHITE, fontFace: 'Arial', valign: 'middle', margin: 0 });
    slide.addText([
      { text: label, options: { bold: true, breakLine: true } },
      { text: sub, options: { bold: false } },
    ], { x: x + w * 0.45, y, w: w * 0.55 - 0.15, h, fontSize: 11, color: SUBTLE, fontFace: 'Arial', valign: 'middle', margin: 0 });
  }

  function addDoughnutCard(pptx, slide, x, y, w, h, title, segments){
    slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.1, fill: { color: WHITE }, line: { color: BORDER, width: 1 } });
    addSectionTitle(slide, x + 0.2, y + 0.16, w - 0.4, title);
    const clean = segments.filter(s => s.value > 0);
    if(!clean.length){
      slide.addText('Sin datos disponibles', { x: x + 0.2, y: y + h/2 - 0.2, w: w - 0.4, h: 0.4, fontSize: 12, color: MUTED, align: 'center', fontFace: 'Arial', margin: 0 });
      return;
    }
    const total = clean.reduce((s, seg) => s + seg.value, 0) || 1;

    // Bloque grafica+leyenda centrado verticalmente en el area bajo el titulo:
    // ancla fija arriba dejaba huecos enormes en tarjetas altas con pocos segmentos.
    const contentTop = y + 0.62;
    const contentH = h - 0.62 - 0.2;
    const chartSize = Math.min(w * 0.42, contentH, 2.3);
    const rowStep = Math.min(0.62, Math.max(contentH, 0.62 * clean.length) / clean.length);
    const blockH = Math.max(chartSize, rowStep * clean.length);
    const blockY = contentTop + Math.max(0, (contentH - blockH) / 2);
    const chartY = blockY + (blockH - chartSize) / 2;

    slide.addChart(pptx.ChartType.doughnut, [{ name: title, labels: clean.map(s => s.label), values: clean.map(s => s.value) }], {
      x: x + 0.25, y: chartY, w: chartSize, h: chartSize,
      chartColors: clean.map(s => s.color),
      showLegend: false, showValue: false, showPercent: false,
      dataBorder: { pt: 2, color: WHITE },
      holeSize: 62,
    });
    const top = clean[0];
    const topPct = Math.round((top.value / total) * 100);
    slide.addText(`${topPct}%`, { x: x + 0.25, y: chartY + chartSize/2 - 0.32, w: chartSize, h: 0.34, fontSize: 20, bold: true, color: TEXT, align: 'center', fontFace: 'Arial', margin: 0 });
    slide.addText(top.label.toUpperCase(), { x: x + 0.25, y: chartY + chartSize/2 + 0.02, w: chartSize, h: 0.22, fontSize: 8, color: MUTED, align: 'center', fontFace: 'Arial', margin: 0 });

    const legendX = x + 0.35 + chartSize;
    const legendW = w - 0.6 - chartSize;
    const legendRowH = Math.min(0.22, rowStep * 0.36);
    let ly = blockY + (blockH - rowStep * clean.length) / 2;
    clean.forEach(seg => {
      const pct = Math.round((seg.value / total) * 100);
      slide.addShape('ellipse', { x: legendX, y: ly + 0.05, w: 0.1, h: 0.1, fill: { color: seg.color }, line: { type: 'none' } });
      slide.addText(seg.label.toUpperCase(), { x: legendX + 0.18, y: ly - 0.03, w: legendW * 0.55, h: legendRowH, fontSize: 9.5, bold: true, color: MUTED, fontFace: 'Arial', margin: 0 });
      slide.addText(`${pct}%`, { x: legendX + legendW * 0.55, y: ly - 0.03, w: legendW * 0.45, h: legendRowH, fontSize: 9.5, bold: true, color: seg.color, fontFace: 'Arial', align: 'right', margin: 0 });
      slide.addText(String(seg.value), { x: legendX + 0.18, y: ly + rowStep * 0.3, w: legendW, h: legendRowH, fontSize: rowStep >= 0.5 ? 16 : 12, bold: true, color: TEXT, fontFace: 'Arial', margin: 0 });
      ly += rowStep;
    });
  }

  function addRankingList(slide, x, y, w, h, title, items, rightText){
    slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.1, fill: { color: WHITE }, line: { color: BORDER, width: 1 } });
    addSectionTitle(slide, x + 0.2, y + 0.16, w - 0.4, title, rightText);
    if(!items.length){
      slide.addText('Sin datos disponibles', { x: x + 0.2, y: y + h/2 - 0.2, w: w - 0.4, h: 0.4, fontSize: 12, color: MUTED, align: 'center', fontFace: 'Arial', margin: 0 });
      return;
    }
    const maxValue = Math.max(...items.map(it => it.value), 1);
    const rowH = Math.min(0.68, (h - 0.8) / items.length);
    let ry = y + 0.62;
    items.forEach((item, idx) => {
      const barColor = idx === 0 ? RED : GOLD;
      const nameW = w * 0.32;
      const barX = x + 0.2 + nameW;
      const barW = w - 0.4 - nameW - 0.65;
      const pillW = 0.6;
      slide.addText(shortenName(item.name), { x: x + 0.2, y: ry, w: nameW - 0.1, h: rowH, fontSize: 9.5, color: TEXT, fontFace: 'Arial', valign: 'middle', margin: 0, fit: 'shrink' });
      slide.addShape('roundRect', { x: barX, y: ry + rowH * 0.28, w: barW, h: rowH * 0.32, rectRadius: 0.04, fill: { color: TRACKBG }, line: { type: 'none' } });
      const fillW = Math.max(barW * (item.value / maxValue), 0.06);
      slide.addShape('roundRect', { x: barX, y: ry + rowH * 0.28, w: fillW, h: rowH * 0.32, rectRadius: 0.04, fill: { color: barColor }, line: { type: 'none' } });
      slide.addShape('roundRect', { x: x + w - 0.2 - pillW, y: ry + (rowH - 0.24) / 2, w: pillW, h: 0.24, rectRadius: 0.04, fill: { color: PINKBG }, line: { type: 'none' } });
      slide.addText(String(item.value), { x: x + w - 0.2 - pillW, y: ry + (rowH - 0.24) / 2, w: pillW, h: 0.24, fontSize: 10, bold: true, color: RED, fontFace: 'Arial', align: 'center', valign: 'middle', margin: 0 });
      ry += rowH;
    });
  }

  function addGaugeCard(slide, x, y, w, h, pct, label){
    const color = pct >= 95 ? GREEN : (pct >= 85 ? GOLD : RED);
    slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.08, fill: { color: WHITE }, line: { color: BORDER, width: 1 } });
    slide.addText(`${pct.toFixed(1)}%`, { x: x + 0.1, y: y + 0.16, w: w - 0.2, h: 0.6, fontSize: 26, bold: true, color, fontFace: 'Arial', margin: 0 });
    slide.addText(label.toUpperCase(), { x: x + 0.1, y: y + 0.72, w: w - 0.2, h: 0.24, fontSize: 10, bold: true, color: MUTED, fontFace: 'Arial', margin: 0, fit: 'shrink' });
    slide.addShape('roundRect', { x: x + 0.1, y: y + h - 0.24, w: w - 0.2, h: 0.1, rectRadius: 0.05, fill: { color: TRACKBG }, line: { type: 'none' } });
    slide.addShape('roundRect', { x: x + 0.1, y: y + h - 0.24, w: (w - 0.2) * Math.min(pct, 100) / 100, h: 0.1, rectRadius: 0.05, fill: { color }, line: { type: 'none' } });
  }

  // Ranking de porcentaje con barra (p.ej. Aprovechamiento por AT). Igual que
  // addRankingList pero con barra hasta el 100% y color por umbral (95/85%)
  // en vez de color fijo por posicion, y valor mostrado con decimales.
  function addPctRankingList(slide, x, y, w, h, title, items, rightText){
    slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.1, fill: { color: WHITE }, line: { color: BORDER, width: 1 } });
    addSectionTitle(slide, x + 0.2, y + 0.16, w - 0.4, title, rightText);
    if(!items.length){
      slide.addText('Sin datos disponibles', { x: x + 0.2, y: y + h/2 - 0.2, w: w - 0.4, h: 0.4, fontSize: 12, color: MUTED, align: 'center', fontFace: 'Arial', margin: 0 });
      return;
    }
    const rowH = Math.min(0.68, (h - 0.8) / items.length);
    let ry = y + 0.62;
    items.forEach(item => {
      const barColor = item.value >= 95 ? GREEN : (item.value >= 85 ? GOLD : RED);
      const nameW = w * 0.32;
      const barX = x + 0.2 + nameW;
      const barW = w - 0.4 - nameW - 0.75;
      const pillW = 0.7;
      slide.addText(shortenName(item.name), { x: x + 0.2, y: ry, w: nameW - 0.1, h: rowH, fontSize: 9.5, color: TEXT, fontFace: 'Arial', valign: 'middle', margin: 0, fit: 'shrink' });
      slide.addShape('roundRect', { x: barX, y: ry + rowH * 0.28, w: barW, h: rowH * 0.32, rectRadius: 0.04, fill: { color: TRACKBG }, line: { type: 'none' } });
      const fillW = Math.max(barW * Math.min(item.value, 100) / 100, 0.06);
      slide.addShape('roundRect', { x: barX, y: ry + rowH * 0.28, w: fillW, h: rowH * 0.32, rectRadius: 0.04, fill: { color: barColor }, line: { type: 'none' } });
      slide.addShape('roundRect', { x: x + w - 0.2 - pillW, y: ry + (rowH - 0.24) / 2, w: pillW, h: 0.24, rectRadius: 0.04, fill: { color: PINKBG }, line: { type: 'none' } });
      slide.addText(`${item.value.toFixed(1)}%`, { x: x + w - 0.2 - pillW, y: ry + (rowH - 0.24) / 2, w: pillW, h: 0.24, fontSize: 9.5, bold: true, color: barColor, fontFace: 'Arial', align: 'center', valign: 'middle', margin: 0 });
      ry += rowH;
    });
  }

  // Tarjeta de metrica TREO. Proporciones fraccionales (label ~arriba 8-25%,
  // valor grande ~27-68%, nota ~74-96%) tomadas de las coordenadas reales de
  // RAE_BASE.pptx (tarjetas de 1.83x2.05in), para que escale igual sin
  // importar el alto exacto que se le pase.
  function addMetricCard(slide, x, y, w, h, label, value, note){
    slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.08, fill: { color: WHITE }, line: { color: BORDER, width: 1 } });
    slide.addText(label.toUpperCase(), { x: x + 0.14, y: y + h * 0.08, w: w - 0.28, h: h * 0.17, fontSize: 9, bold: true, color: MUTED, fontFace: 'Arial', margin: 0, fit: 'shrink' });
    slide.addText(String(value), { x: x + 0.14, y: y + h * 0.27, w: w - 0.28, h: h * 0.41, fontSize: 30, bold: true, color: TEXT, fontFace: 'Arial', margin: 0, fit: 'shrink' });
    slide.addText(note, { x: x + 0.14, y: y + h * 0.74, w: w - 0.28, h: h * 0.22, fontSize: 8.5, bold: true, color: RED, fontFace: 'Arial', margin: 0, fit: 'shrink' });
  }

  function addNoteCard(slide, x, y, w, h, title, note){
    slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.08, fill: { color: WHITE }, line: { color: BORDER, width: 1 } });
    slide.addText(title, { x: x + 0.14, y: y + h * 0.1, w: w - 0.28, h: h * 0.4, fontSize: 11, bold: true, color: TEXT, fontFace: 'Arial', margin: 0, fit: 'shrink' });
    slide.addText(note, { x: x + 0.14, y: y + h * 0.5, w: w - 0.28, h: h * 0.4, fontSize: 10, color: RED, fontFace: 'Arial', margin: 0, fit: 'shrink' });
  }

  // Tarjeta "Alineacion Global": dona arriba + 3 casillas de estatus abajo,
  // igual que la columna derecha de la diapositiva TREO en RAE_BASE.pptx
  // (ahi la dona no lleva leyenda lateral, sino recuadros debajo).
  function addTreoAlignmentCard(pptx, slide, x, y, w, h, segments){
    slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.1, fill: { color: WHITE }, line: { color: BORDER, width: 1 } });
    addSectionTitle(slide, x + 0.3, y + 0.29, w - 0.6, 'Alineación Global');
    const clean = segments.filter(s => s.value > 0);
    const total = clean.reduce((s, seg) => s + seg.value, 0) || 1;
    const chartSize = Math.min(w * 0.78, h * 0.56);
    const chartX = x + (w - chartSize) / 2;
    const chartY = y + 0.7;
    if(clean.length){
      slide.addChart(pptx.ChartType.doughnut, [{ name: 'Alineación Global', labels: clean.map(s => s.label), values: clean.map(s => s.value) }], {
        x: chartX, y: chartY, w: chartSize, h: chartSize,
        chartColors: clean.map(s => s.color),
        showLegend: false, showValue: false, showPercent: false,
        dataBorder: { pt: 2, color: WHITE },
        holeSize: 62,
      });
      const topPct = Math.round((clean[0].value / total) * 100);
      slide.addText(`${topPct}%`, { x: chartX, y: chartY + chartSize/2 - 0.32, w: chartSize, h: 0.34, fontSize: 22, bold: true, color: TEXT, align: 'center', fontFace: 'Arial', margin: 0 });
      slide.addText(clean[0].label.toUpperCase(), { x: chartX, y: chartY + chartSize/2 + 0.03, w: chartSize, h: 0.22, fontSize: 9, color: MUTED, align: 'center', fontFace: 'Arial', margin: 0 });
    }
    const boxY = chartY + chartSize + 0.15;
    const boxW = (w - 0.4) / segments.length - 0.1;
    segments.forEach((seg, i) => {
      const bx = x + 0.2 + i * (boxW + 0.13);
      slide.addShape('roundRect', { x: bx, y: boxY, w: boxW, h: 0.85, rectRadius: 0.06, fill: { color: TRACKBG }, line: { type: 'none' } });
      slide.addText(String(seg.value), { x: bx, y: boxY + 0.08, w: boxW, h: 0.42, fontSize: 16, bold: true, color: TEXT, align: 'center', fontFace: 'Arial', margin: 0 });
      slide.addText(seg.label, { x: bx, y: boxY + 0.52, w: boxW, h: 0.26, fontSize: 8.5, color: MUTED, align: 'center', fontFace: 'Arial', margin: 0, fit: 'shrink' });
    });
  }

  function emptySlide(pptx, title, dateLabel){
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, title, dateLabel);
    slide.addText('Sin datos disponibles en Google Sheets', { x: MARGIN_X, y: 3, w: PAGE_W - MARGIN_X*2, h: 0.6, fontSize: 18, color: MUTED, align: 'center', fontFace: 'Arial' });
    return slide;
  }

  function buildD1(pptx, d, dateLabel){
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'VACANTES', dateLabel);
    addHeroKpi(slide, MARGIN_X, 1.25, 4.55, 1.35, d.total, 'VACANTES TOTALES', 'en tiendas filtradas · Plaza Oaxaca');
    addDoughnutCard(pptx, slide, MARGIN_X, 2.8, 4.55, 2.5, 'Distribución por puesto', [
      { label: 'Ayudante', value: d.byPuesto.Ayudante, color: GOLD },
      { label: 'Encargado', value: d.byPuesto.Encargado, color: ORANGE },
      { label: 'Lider', value: d.byPuesto.Lider, color: RED },
    ]);
    addRankingList(slide, 5.35, 1.25, 7.55, 5.75, 'Vacantes por Asesor', d.ranking, `${d.total} vacantes totales`);
  }

  function buildD2(pptx, d, dateLabel){
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'BAJAS', dateLabel);
    addRankingList(slide, MARGIN_X, 1.25, 6.85, 5.75, 'Bajas por Asesor', d.ranking, `${d.total} bajas totales`);
    addDoughnutCard(pptx, slide, 8.3, 1.25, 4.6, 5.75, 'Bajas por Puesto', [
      { label: 'Ayudante', value: d.byPuesto.Ayudante, color: GOLD },
      { label: 'Encargado', value: d.byPuesto.Encargado, color: ORANGE },
      { label: 'Lider', value: d.byPuesto.Lider, color: RED },
    ]);
  }

  function buildD3(pptx, d, dateLabel){
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'APROVECHAMIENTO DE ESTRUCTURA', dateLabel);
    addSectionTitle(slide, MARGIN_X, 1.2, 6.85, 'Aprovechamiento por Plaza', 'Meta 95%');
    const gW = (6.85 - 0.2 * 4) / 5;
    d.plazas.forEach((p, i) => addGaugeCard(slide, MARGIN_X + i * (gW + 0.2), 1.65, gW, 1.4, p.value, p.name));
    // Un asesor por fila cabe holgado hasta ~10; con 11+ se le da toda la
    // altura restante hasta la base del panel derecho (mismo fondo que
    // 'Estatus con impacto de ausentismo') en vez de dejar espacio muerto.
    addPctRankingList(slide, MARGIN_X, 3.2, 6.85, 3.8, 'Aprovechamiento por AT', d.ranking, 'Meta 95%');
    addDoughnutCard(pptx, slide, 8.3, 1.2, 4.6, 5.8, 'Estatus con impacto de ausentismo', [
      { label: 'Completas', value: d.completas, color: GREEN },
      { label: 'Incompletas', value: d.incompletas, color: GOLD },
      { label: 'Criticas', value: d.criticas, color: RED },
    ]);
  }

  function buildD7(pptx, d, dateLabel){
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'TREO · ESTRUCTURA', dateLabel);
    // Coordenadas exactas de RAE_BASE.pptx: bloque de 8 tarjetas (2 filas x 4
    // columnas de 1.83x2.05in) confinado a la izquierda, con la tarjeta de
    // Alineacion Global a la derecha ocupando el alto completo de ambas filas.
    const cardW = 1.83, cardH = 2.05, gapX = 0.22, gapY = 0.25;
    const xs = [MARGIN_X, MARGIN_X + (cardW + gapX), MARGIN_X + 2 * (cardW + gapX), MARGIN_X + 3 * (cardW + gapX)];
    const row1Y = 1.28, row2Y = row1Y + cardH + gapY;

    addMetricCard(slide, xs[0], row1Y, cardW, cardH, 'Total Tiendas', d.total, 'Plaza Oaxaca');
    addMetricCard(slide, xs[1], row1Y, cardW, cardH, 'Cobertura Estructura', `${d.cobertura.toFixed(0)}%`, `${OXXO.formatNum(d.totalActivos)} de ${OXXO.formatNum(d.totalTreo)} posiciones`);
    addMetricCard(slide, xs[2], row1Y, cardW, cardH, 'Alineadas', d.alineadas, `${d.total ? Math.round(d.alineadas/d.total*100) : 0}% del total`);
    addMetricCard(slide, xs[3], row1Y, cardW, cardH, 'Vacantes Totales', OXXO.formatNum(d.totalVacantes), 'En tiendas filtradas');
    addMetricCard(slide, xs[0], row2Y, cardW, cardH, 'Por Subir ▲', OXXO.formatNum(Math.round(d.posSubir)), `+${OXXO.formatNum(Math.round(d.posSubir))} posiciones a agregar`);
    addMetricCard(slide, xs[1], row2Y, cardW, cardH, 'Por Bajar ▼', OXXO.formatNum(Math.round(d.posBajar)), `-${OXXO.formatNum(Math.round(d.posBajar))} posiciones a liberar`);
    addMetricCard(slide, xs[2], row2Y, cardW, cardH, 'Sub-dotadas', d.subDotadas, 'Activos < TREO');
    addMetricCard(slide, xs[3], row2Y, cardW, cardH, 'Sobre-dotadas', d.sobreDotadas, 'Activos > TREO');

    const rightX = xs[3] + cardW + 0.35, rightW = PAGE_W - MARGIN_X - rightX;
    addTreoAlignmentCard(pptx, slide, rightX, 1.25, rightW, 4.55, [
      { label: 'Alineada', value: d.alineadas, color: GREEN },
      { label: 'Subir', value: d.subir, color: GOLD },
      { label: 'Bajar', value: d.bajar, color: RED },
    ]);
    addNoteCard(slide, rightX, 5.95, rightW, 1.05, 'Cobertura de estructura sobre TREO', `${d.cobertura.toFixed(0)}% de cobertura`);
  }

  // Solo las 4 diapositivas que trae RAE_BASE.pptx: Vacantes, Bajas,
  // Aprovechamiento y TREO. Tiempo Extra/Vacaciones/Ausentismos no van aqui.
  const DASHBOARDS = [
    { title: 'VACANTES', fetch: dataD1, build: buildD1 },
    { title: 'BAJAS', fetch: dataD2, build: buildD2 },
    { title: 'APROVECHAMIENTO DE ESTRUCTURA', fetch: dataD3, build: buildD3 },
    { title: 'TREO · ESTRUCTURA', fetch: dataD7, build: buildD7 },
  ];

  async function generatePresentation(){
    const statusEl = document.getElementById('pptx-rae-status');
    const btn = document.getElementById('generate-pptx-rae-btn');
    btn.disabled = true;
    btn.textContent = 'Generando...';
    if(statusEl) statusEl.textContent = 'Consultando Google Sheets...';
    try {
      const today = new Date();
      const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const dateLabel = `${MESES[today.getMonth()]} ${today.getFullYear()}`;

      const pptx = new window.PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE'; // 13.333in x 7.5in, igual que RAE_BASE.pptx

      const title = pptx.addSlide();
      title.background = { color: RED };
      title.addText('Presentación RAE', { x: 0.8, y: 2.3, w: 11.7, h: 1.3, fontSize: 40, bold: true, color: 'FFFFFF', fontFace: 'Arial' });
      title.addText('Indicadores clave · Plaza Oaxaca', { x: 0.8, y: 3.7, w: 11.7, h: 0.5, fontSize: 20, color: 'FFD7D5', fontFace: 'Arial' });
      title.addText(today.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }), { x: 0.8, y: 6.4, w: 11.7, h: 0.4, fontSize: 13, color: 'FFD7D5', fontFace: 'Arial' });

      for(const d of DASHBOARDS){
        try {
          const data = await d.fetch();
          if(data) d.build(pptx, data, dateLabel);
          else emptySlide(pptx, d.title, dateLabel);
        } catch(e){
          console.error('Error generando slide', d.title, e);
          emptySlide(pptx, d.title, dateLabel);
        }
      }

      const fileName = `Presentacion-RAE-Oaxaca-${today.toISOString().slice(0,10)}.pptx`;
      await pptx.writeFile({ fileName });
      if(statusEl) statusEl.textContent = 'Presentación generada correctamente.';
    } catch(e){
      console.error(e);
      if(statusEl) statusEl.textContent = 'Error al generar la presentación: ' + e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '📊 Generar Presentación RAE';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('generate-pptx-rae-btn');
    if(btn) btn.addEventListener('click', generatePresentation);
  });
})();
