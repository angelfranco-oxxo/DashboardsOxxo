/* ==========================================================
   MI TIENDA — vista por tienda
   Se busca una tienda (buscador, no lista completa) y se ve, en
   una sola pagina, sus datos de los 8 dashboards (Vacantes, Bajas,
   Aprovechamiento, Tiempo Extra, Vacaciones, Ausentismos, TREO y
   Capacidades). Usa la MISMA logica de carga que cada dashboard
   real (js/mi-dashboard.js es el equivalente por asesor) pero
   agrupando por tienda: el nombre de tienda no siempre viene igual
   en cada hoja (ej. "OXXO LAS FLORES" vs "Las Flores"), asi que el
   match usa OXXO.normalizeCatalogTienda (misma normalizacion que ya
   usa el catalogo de asesores) en vez de comparar texto exacto.
   ========================================================== */
(function () {
  'use strict';

  // ── Utilidades compartidas ────────────────────────────
  const {
    esc, plural, statTile, emptyRow, clearBox, noneBox,
    gaugeTone, gaugeSVG, gaugeRowHTML, barListHTML, pctBarsHTML,
    movInfo, movPill, estatusCell, rkTile, toneByCount, tonePct,
    chipsHTML, metaHTML, mountSingleSelect, openModal,
  } = window.OXXO_FICHA;
  const V = (row, key) => OXXO.metricsVal(row, key);
  const K = (row, aliases) => OXXO.metricsFindKey(row, aliases);
  const n = (v) => OXXO.formatNum(Math.round(Number(v) || 0));
  const tKey = (v) => OXXO.normalizeCatalogTienda(v);

  // ── Acordeon mensual compartido ────────────────────────
  // Varios paneles (Vacantes, Bajas, Tiempo Extra, Ausentismos,
  // Faltantes/Sobrantes) guardan varios meses en su hoja pero antes solo se
  // mostraba el mas reciente. renderMonthsAccordion pinta un boton por mes
  // (mas reciente primero); al hacer clic abre el modal compartido con la
  // tabla de ese mes, en vez de expandirla dentro de la tarjeta.
  const MESES_NOMBRE = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  function mesLabel(ym) {
    const m = String(ym || '').match(/^(\d{4})-(\d{2})$/);
    return m ? `${MESES_NOMBRE[Number(m[2]) - 1]} ${m[1]}` : 'Sin fecha';
  }
  // Columnas "Mes"/"Ano" de Tiempo Extra y Ausentismos vienen como
  // "08.- Agosto" / "2026" -- OXXO.metricsNormalizeMonthKey (pensado para
  // "ago-26" o fechas completas) no reconoce ese formato y regresa ''. Como
  // el numero de mes ya viene al inicio del texto, es mas simple y confiable
  // leerlo directo que intentar generalizar el helper compartido.
  function mesKeyFromMesAno(mesRaw, anoRaw) {
    const mm = String(mesRaw || '').match(/^(\d{1,2})/);
    const yyyy = String(anoRaw || '').match(/(\d{4})/);
    return (mm && yyyy) ? `${yyyy[1]}-${mm[1].padStart(2, '0')}` : '';
  }
  function renderMonthsAccordion(container, rows, monthKeyFn, { titulo, summaryHtml, theadHtml, rowsHtml }) {
    if (!rows.length) { container.innerHTML = ''; return; }
    const porMes = new Map();
    rows.forEach((r) => {
      const ym = monthKeyFn(r);
      if (!porMes.has(ym)) porMes.set(ym, []);
      porMes.get(ym).push(r);
    });
    const keys = [...porMes.keys()].sort().reverse();
    container.innerHTML = keys.map((ym) => `<button type="button" class="mi-month">
        <span class="mi-month__name">${esc(mesLabel(ym))}</span>
        <span class="mi-month__nums">${summaryHtml(porMes.get(ym))}</span>
      </button>`).join('');
    [...container.children].forEach((btn, i) => {
      const mrows = porMes.get(keys[i]);
      btn.addEventListener('click', () => {
        openModal(`${titulo} · ${mesLabel(keys[i])}`, `<table class="tbl"><thead>${theadHtml}</thead><tbody>${rowsHtml(mrows)}</tbody></table>`);
      });
    });
  }

  // ── Estado global (se carga una sola vez) ─────────────
  let CATALOG = null;
  const TIENDAS = new Map(); // normKey -> nombre a mostrar (canonico del catalogo si existe, si no el nombre crudo)
  const DATA = {};

  // El nombre de tienda no viene igual en todas las bases, y en 7 casos ni
  // siquiera empata al normalizar: TREO manda "Bacocho OAX" donde el resto
  // manda "OXXO BACHOCO" (mismo CR 50BKC); igual con Dos Oceanos/Dos
  // Oceanis, Gas Huatulco/Huatulco, Gas Transistmica/Transoceanica, etc.
  // Asi la tienda salia partida en dos entradas del buscador, cada una con
  // datos a medias (una con todo menos TREO, la otra solo con TREO).
  // El CR es la llave real y el catalogo tiene el nombre bueno de cada CR:
  // si la fila trae CR se resuelve por ahi; si no, por nombre (D2 y D5 no
  // traen CR, pero nombran igual que el catalogo).
  function canonKey(cr, nombre) {
    const crk = cr ? OXXO.normalizeCatalogCr(cr) : '';
    const hit = crk ? CATALOG?.byCr?.get(crk) : null;
    if (hit && hit.tienda) return tKey(hit.tienda);
    return tKey(nombre);
  }
  function rowKey(row, d) {
    return canonKey(d.crKey ? V(row, d.crKey) : '', V(row, d.tiendaKey));
  }
  function rowsFor(d, tienda) {
    return d.rows.filter((r) => rowKey(r, d) === tienda);
  }
  function addTiendas(rows, tiendaKey, crKey) {
    if (!tiendaKey) return;
    rows.forEach((r) => {
      const raw = String(V(r, tiendaKey) || '').trim();
      if (!raw) return;
      const key = canonKey(crKey ? V(r, crKey) : '', raw);
      if (!key || TIENDAS.has(key)) return;
      const canon = CATALOG?.byTienda?.get(key)?.tienda;
      TIENDAS.set(key, canon || raw);
    });
  }

  // ── D1 · Vacantes Diarias (mismo pipeline que dashboard-1.html) ──
  async function loadD1() {
    const d1 = await OXXO.metricsD1Rows(true);
    if (!d1) { DATA.d1 = null; return; }
    const diasKey = d1.rows[0] ? K(d1.rows[0], ['Dias Vacantes', 'Dias_Vacantes']) : null;
    const fechaKey = d1.rows[0] ? K(d1.rows[0], ['Fecha']) : null;
    const crKey = d1.rows[0] ? K(d1.rows[0], ['CR TIENDA', 'CR']) : null;
    const statusKey = d1.rows[0] ? K(d1.rows[0], ['Status ocupacion', 'Status ocupación', 'Estatus ocupacion']) : null;
    DATA.d1 = { ...d1, diasKey, fechaKey, crKey, statusKey };
    addTiendas(d1.rows, d1.tiendaKey, crKey);
  }
  function renderD1(tienda) {
    const d = DATA.d1;
    const el = document.getElementById('sec-d1');
    if (!d) { el.classList.remove('show'); return null; }
    const allRows = rowsFor(d, tienda);
    el.classList.add('show');
    const mesKeyFn = (r) => OXXO.metricsRowMonthKeyD1(r, d.mesKey, d.fechaKey);
    const { mes, rows } = OXXO.metricsFilterLatestMonth(allRows, mesKeyFn);
    document.getElementById('badge-d1').textContent = mes ? mesLabel(mes) : '—';
    const byPuesto = { Lider: 0, Encargado: 0, Ayudante: 0, Otro: 0 };
    rows.forEach((r) => { byPuesto[OXXO.metricsTipoPuesto(V(r, d.puestoKey))]++; });
    if (!rows.length) {
      document.getElementById('stats-d1').innerHTML = '';
      document.getElementById('viz-d1').innerHTML = clearBox('Sin vacantes activas este mes');
    } else {
      document.getElementById('stats-d1').innerHTML =
        statTile(n(rows.length), 'Vacantes', 'rojo') +
        statTile(n(byPuesto.Lider), 'Líder') +
        statTile(n(byPuesto.Encargado), 'Encargado') +
        statTile(n(byPuesto.Ayudante), 'Ayudante');
      document.getElementById('viz-d1').innerHTML = barListHTML([
        { label: 'Líder', value: byPuesto.Lider },
        { label: 'Encargado', value: byPuesto.Encargado },
        { label: 'Ayudante', value: byPuesto.Ayudante },
        { label: 'Otro', value: byPuesto.Otro },
      ]);
    }
    renderMonthsAccordion(document.getElementById('months-d1'), allRows, mesKeyFn, {
      titulo: 'Vacantes',
      summaryHtml: (mrows) => `<b class="rojo">${n(mrows.length)}</b> vacantes`,
      theadHtml: '<tr><th>Puesto</th><th class="center">Días</th><th>Fecha</th><th>Estatus</th></tr>',
      rowsHtml: (mrows) => mrows.map((r) => `<tr>
          <td>${esc(V(r, d.puestoKey) || '—')}</td>
          <td class="center">${d.diasKey ? esc(OXXO.metricsDiasVacantesValue(V(r, d.diasKey))) : '—'}</td>
          <td>${esc(d.fechaKey ? V(r, d.fechaKey) || '—' : '—')}</td>
          <td>${esc(d.statusKey ? OXXO.truncate(String(V(r, d.statusKey) || '—'), 30) : '—')}</td>
        </tr>`).join(''),
    });
    return { vacantes: rows.length };
  }

  // ── D2 · Bajas Diarias (mismo pipeline que dashboard-2.html) ──
  async function loadD2() {
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d2);
    if (!raw || !raw.length) { DATA.d2 = null; return; }
    const h = raw[0];
    const asesorKey = K(h, ['Asesor']);
    const tiendaKey = K(h, ['Tienda']);
    const medidaKey = K(h, ['Denominación Medida', 'Denominacion Medida', 'Medida', 'Med.']);
    const plazaKey = K(h, ['Plaza']);
    const puestoKey = K(h, ['Puesto']);
    const motivoKey = K(h, ['Motivo', 'Denominación Motivo', 'Denominacion Motivo']);
    const detalleKey = K(h, ['Detalle', 'Detalle de Baja']);
    const fechaKey = K(h, ['Fecha']);
    const mesKey = K(h, ['Mes']);

    const rawSinTimoteo = raw.filter((r) => OXXO.metricsCleanKey(V(r, asesorKey) || '') !== 'timoteoantonioperez');
    rawSinTimoteo.forEach((r) => { r[asesorKey] = OXXO.resolveAsesorD1(CATALOG, { tienda: V(r, tiendaKey), asesor: V(r, asesorKey) }); });
    let base = OXXO.metricsFilterBajasD2(rawSinTimoteo, { medidaKey, plazaKey });
    if (puestoKey) {
      const operativos = base.filter((r) => { const p = OXXO.metricsNormText(V(r, puestoKey)); return p.includes('AYUDANTE') || p.includes('ENCARGADO') || p.includes('LIDER') || p.includes('LÍDER'); });
      if (operativos.length) base = operativos;
    }
    DATA.d2 = { rows: base, asesorKey, tiendaKey, puestoKey, motivoKey, detalleKey, fechaKey, mesKey };
    addTiendas(base, tiendaKey);
  }
  function renderD2(tienda) {
    const d = DATA.d2;
    const el = document.getElementById('sec-d2');
    if (!d) { el.classList.remove('show'); return null; }
    const allRows = rowsFor(d, tienda);
    el.classList.add('show');
    const mesKeyFn = (r) => OXXO.metricsRowMonthKeyD2(r, d.mesKey, d.fechaKey);
    const { mes, rows } = OXXO.metricsFilterLatestMonth(allRows, mesKeyFn);
    document.getElementById('badge-d2').textContent = mes ? mesLabel(mes) : '—';
    const porMotivo = {};
    rows.forEach((r) => { const m = V(r, d.detalleKey) || V(r, d.motivoKey) || 'Sin motivo'; porMotivo[m] = (porMotivo[m] || 0) + 1; });
    const topMotivo = Object.entries(porMotivo).sort((a, b) => b[1] - a[1])[0];
    if (!rows.length) {
      document.getElementById('stats-d2').innerHTML = '';
      document.getElementById('viz-d2').innerHTML = clearBox('Sin bajas este mes');
    } else {
      document.getElementById('stats-d2').innerHTML =
        statTile(n(rows.length), 'Bajas del mes', 'rojo') +
        statTile(topMotivo ? esc(OXXO.truncate(topMotivo[0], 22)) : '—', 'Motivo más frecuente', 'amarillo txt');
      document.getElementById('viz-d2').innerHTML = barListHTML(
        Object.entries(porMotivo).map(([label, value]) => ({ label: OXXO.truncate(label, 24), value }))
      );
    }
    renderMonthsAccordion(document.getElementById('months-d2'), allRows, mesKeyFn, {
      titulo: 'Bajas',
      summaryHtml: (mrows) => `<b class="rojo">${n(mrows.length)}</b> bajas`,
      theadHtml: '<tr><th>Asesor</th><th>Puesto</th><th>Motivo</th><th>Fecha</th></tr>',
      rowsHtml: (mrows) => mrows.map((r) => `<tr>
          <td>${esc(OXXO.truncate(String(V(r, d.asesorKey) || '—'), 20))}</td>
          <td>${esc(V(r, d.puestoKey) || '—')}</td>
          <td>${esc(OXXO.truncate(String(V(r, d.detalleKey) || V(r, d.motivoKey) || '—'), 26))}</td>
          <td>${esc(V(r, d.fechaKey) || '—')}</td>
        </tr>`).join(''),
    });
    return { bajas: rows.length, motivo: topMotivo ? topMotivo[0] : '' };
  }

  // ── D3 · Aprovechamiento de Estructura (mismo pipeline que dashboard-3.html) ──
  async function loadD3() {
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d3);
    if (!raw || !raw.length) { DATA.d3 = null; return; }
    const h = raw[0];
    const asesorKey = K(h, ['Asesor']);
    const tiendaKey = K(h, ['Tienda']);
    const crKey = K(h, ['CR', 'CR Tienda', 'CR TIENDA']);
    const estatusKey = K(h, ['Clas Aprov', 'Estatus Con impacto Ausentismo', 'Estatus']);
    // Misma columna que usa la ficha de tienda de dashboard-3.html: trae el
    // estatus recalculado descontando los ausentismos, con el mismo
    // vocabulario ("Equipo Completo"/"Equipo Incompleto"/"Tienda Critica"),
    // asi que se clasifica con el mismo helper.
    const ecSinAusKey = K(h, ['EC SIN AUSENTISMO', 'EC sin ausentismo', 'EC Sin Ausentismo']);
    const semanaKey = K(h, ['Mes Semana', 'Semana', 'Fecha', 'FECHA']);
    raw.forEach((r) => { r[asesorKey] = OXXO.resolveAsesorD1(CATALOG, { cr: V(r, crKey), tienda: V(r, tiendaKey), asesor: V(r, asesorKey) }); });
    const semanas = [...new Set(raw.map((r) => String(V(r, semanaKey) || '').trim()).filter(Boolean))].sort();
    const semana = semanas[semanas.length - 1] || '';
    const rows = semana ? raw.filter((r) => String(V(r, semanaKey) || '').trim() === semana) : raw;
    DATA.d3 = { rows, semana, asesorKey, tiendaKey, crKey, estatusKey, ecSinAusKey };
    addTiendas(rows, tiendaKey, crKey);
  }
  function renderD3(tienda) {
    const d = DATA.d3;
    const el = document.getElementById('sec-d3');
    if (!d) { el.classList.remove('show'); return null; }
    const rows = rowsFor(d, tienda);
    el.classList.add('show');
    document.getElementById('badge-d3').textContent = d.semana || '—';
    let completas = 0, incompletas = 0, criticas = 0;
    let sinCompletas = 0, sinTotal = 0;
    rows.forEach((r) => {
      const c = OXXO.metricsClasificaAprovechamiento(V(r, d.estatusKey));
      if (c === 'completas') completas++; else if (c === 'incompletas') incompletas++; else if (c === 'criticas') criticas++;
      if (d.ecSinAusKey) {
        const s = OXXO.metricsClasificaAprovechamiento(V(r, d.ecSinAusKey));
        if (s) { sinTotal++; if (s === 'completas') sinCompletas++; }
      }
    });
    const ec = rows.length ? Math.round((completas / rows.length) * 100) : 0;
    const ecSin = sinTotal ? Math.round((sinCompletas / sinTotal) * 100) : null;
    document.getElementById('stats-d3').innerHTML = '';
    document.getElementById('viz-d3').innerHTML = rows.length
      ? gaugeRowHTML(ec, null, 'EC · Equipo Completo',
          statTile(n(completas), 'Completas', 'verde') +
          statTile(n(incompletas), 'Incompletas', 'amarillo') +
          statTile(n(criticas), 'Críticas', 'rojo')
        ) + (ecSin !== null ? pctBarsHTML([
          { label: 'Con ausentismo', value: ec },
          { label: 'Sin ausentismo', value: ecSin },
        ]) : '')
      : noneBox('Tu tienda no aparece en la semana vigente');
    const tbody = document.querySelector('#tbl-d3 tbody');
    tbody.innerHTML = rows.length ? rows.slice(0, 200).map((r) => `<tr>
        <td>${esc(V(r, d.asesorKey) || '—')}</td>
        ${estatusCell(V(r, d.estatusKey))}
        ${estatusCell(d.ecSinAusKey ? V(r, d.ecSinAusKey) : '')}
      </tr>`).join('') : emptyRow(3, 'Sin datos de estructura para tu tienda en la semana vigente.');
    return rows.length ? { ec, ecSin, completas, incompletas, criticas } : null;
  }


  // ── D4 · Tiempo Extra (mismo pipeline que dashboard-4.html) ──
  async function loadD4() {
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.s4);
    if (!raw || !raw.length) { DATA.d4 = null; return; }
    const h = raw[0];
    const asesorKey = K(h, ['Asesor']);
    const tiendaKey = K(h, ['Texto breve de unidad organizativa']);
    const crKey = K(h, ['Cr de Tienda', 'CR de Tienda']);
    const nombreKey = K(h, ['Nombre del empleado o candidato']);
    const semanaKey = K(h, ['Semana']);
    const mesKey = K(h, ['Mes']);
    const anoKey = K(h, ['Ano', 'Año']);
    const horasKey = K(h, ['Cantidad']);
    const importeKey = K(h, ['Importe']);
    const conceptoKey = K(h, ['Textos homologados', 'Texto homologado']);
    raw.forEach((r) => OXXO.applyAsesorCatalog(r, CATALOG, { asesorKey, tiendaKey, crKey }));
    DATA.d4 = { rows: raw, asesorKey, tiendaKey, crKey, nombreKey, semanaKey, mesKey, anoKey, horasKey, importeKey, conceptoKey };
    addTiendas(raw, tiendaKey, crKey);
  }
  function semanaRank(value) {
    const v = String(value || '').trim();
    const sem = v.match(/(?:sem|semana)\s*(\d{1,2})/i);
    if (sem) return Number(sem[1]);
    if (/^\d{1,2}$/.test(v)) return Number(v);
    const nums = v.match(/\d+/g);
    return nums ? Number(nums[nums.length - 1]) : -1;
  }
  function numParse(v) { const x = parseFloat(String(v ?? '').replace(/,/g, '')); return isNaN(x) ? 0 : x; }
  function renderD4(tienda) {
    const d = DATA.d4;
    const el = document.getElementById('sec-d4');
    if (!d) { el.classList.remove('show'); return null; }
    const allRows = rowsFor(d, tienda);
    el.classList.add('show');
    const mesKeyFn = (r) => mesKeyFromMesAno(V(r, d.mesKey), V(r, d.anoKey));
    // Semana solo se usa para elegir "la mas reciente" DENTRO del mes vigente
    // (sus valores no traen mes, comparar el numero de semana entre meses
    // distintos daria un resultado incorrecto -- ago sem 1 "perderia" contra
    // jul sem 4 aunque agosto sea mas reciente).
    const meses = [...new Set(allRows.map(mesKeyFn).filter(Boolean))].sort();
    const mesVigente = meses[meses.length - 1] || '';
    const rowsMes = mesVigente ? allRows.filter((r) => mesKeyFn(r) === mesVigente) : allRows;
    const semanas = [...new Set(rowsMes.map((r) => String(V(r, d.semanaKey) || '').trim()).filter(Boolean))];
    semanas.sort((a, b) => semanaRank(b) - semanaRank(a));
    const semana = semanas[0] || '';
    const rows = semana ? rowsMes.filter((r) => String(V(r, d.semanaKey) || '').trim() === semana) : rowsMes;
    document.getElementById('badge-d4').textContent = semana ? (/sem/i.test(semana) ? semana : 'Sem ' + semana) : '—';
    const totHoras = rows.reduce((s, r) => s + numParse(V(r, d.horasKey)), 0);
    const totGasto = rows.reduce((s, r) => s + numParse(V(r, d.importeKey)), 0);
    const porEmpleado = {};
    rows.forEach((r) => { const nom = V(r, d.nombreKey) || 'Sin nombre'; porEmpleado[nom] = (porEmpleado[nom] || 0) + numParse(V(r, d.horasKey)); });
    if (!rows.length) {
      document.getElementById('stats-d4').innerHTML = '';
      document.getElementById('viz-d4').innerHTML = clearBox('Sin tiempo extra esta semana');
    } else {
      document.getElementById('stats-d4').innerHTML =
        statTile(n(totHoras), 'Horas TE', 'amarillo') +
        statTile('$' + n(totGasto), 'Gasto TE', 'rojo') +
        statTile(n(rows.length), 'Registros');
      document.getElementById('viz-d4').innerHTML = barListHTML(
        Object.entries(porEmpleado).map(([label, value]) => ({ label: OXXO.truncate(label, 24), value })), 'naranja'
      );
    }
    renderMonthsAccordion(document.getElementById('months-d4'), allRows, mesKeyFn, {
      titulo: 'Tiempo Extra',
      summaryHtml: (mrows) => {
        const horas = mrows.reduce((s, r) => s + numParse(V(r, d.horasKey)), 0);
        const gasto = mrows.reduce((s, r) => s + numParse(V(r, d.importeKey)), 0);
        return `<span><b class="amarillo">${n(horas)}</b> h</span><span><b class="rojo">$${n(gasto)}</b></span>`;
      },
      theadHtml: '<tr><th>Empleado</th><th>Concepto</th><th class="center">Horas</th><th class="center">Importe</th></tr>',
      rowsHtml: (mrows) => {
        const porEmp = new Map();
        mrows.forEach((r) => {
          const nom = V(r, d.nombreKey) || 'Sin nombre';
          const cur = porEmp.get(nom) || { horas: 0, importe: 0, conceptos: new Set() };
          cur.horas += numParse(V(r, d.horasKey));
          cur.importe += numParse(V(r, d.importeKey));
          if (d.conceptoKey) { const c = V(r, d.conceptoKey); if (c) cur.conceptos.add(String(c)); }
          porEmp.set(nom, cur);
        });
        return [...porEmp.entries()].sort((a, b) => b[1].importe - a[1].importe).map(([nom, v]) => `<tr>
            <td>${esc(OXXO.truncate(nom, 26))}</td>
            <td>${esc(OXXO.truncate([...v.conceptos].join(', ') || '—', 26))}</td>
            <td class="center">${n(v.horas)}</td>
            <td class="center">$${n(v.importe)}</td>
          </tr>`).join('');
      },
    });
    return { horas: totHoras, gasto: totGasto };
  }

  // ── D5 · Vacaciones (mismo pipeline que js/dashboard-5-vacaciones.js) ──
  async function loadD5() {
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.s5);
    if (!raw || !raw.length) { DATA.d5 = null; return; }
    const h = raw[0];
    const asesorKey = K(h, ['Asesor']);
    const tiendaKey = K(h, ['Tienda']);
    const nombreKey = K(h, ['Nombre']);
    const diasRestKey = K(h, ['Dias_Restantes']);
    const bucketKey = K(h, ['Bucket_Ant']);
    const puestoKey = K(h, ['Puesto']);
    const fechaFinKey = K(h, ['Fecha_Fin']);
    raw.forEach((r) => { r[asesorKey] = OXXO.resolveAsesorD1(CATALOG, { asesor: V(r, asesorKey), tienda: V(r, tiendaKey) }); });
    DATA.d5 = { rows: raw, asesorKey, tiendaKey, nombreKey, diasRestKey, bucketKey, puestoKey, fechaFinKey };
    addTiendas(raw, tiendaKey);
  }
  function renderD5(tienda) {
    const d = DATA.d5;
    const el = document.getElementById('sec-d5');
    if (!d) { el.classList.remove('show'); return null; }
    const rows = rowsFor(d, tienda);
    el.classList.add('show');
    document.getElementById('badge-d5').textContent = plural(rows.length, 'colaborador', 'colaboradores');
    const totDias = rows.reduce((s, r) => s + (Number(V(r, d.diasRestKey)) || 0), 0);
    const vencidos = rows.filter((r) => OXXO.metricsNormText(V(r, d.bucketKey)).includes('VENCIERON')).length;
    const proximos = rows.filter((r) => { const b = OXXO.metricsNormText(V(r, d.bucketKey)); return b.includes('0 A 50') || b.includes('0A50'); }).length;
    if (!rows.length) {
      document.getElementById('stats-d5').innerHTML = '';
      document.getElementById('viz-d5').innerHTML = noneBox('Sin colaboradores con saldo de vacaciones');
    } else {
      document.getElementById('stats-d5').innerHTML =
        statTile(n(totDias), 'Días restantes', 'azul') +
        statTile(n(vencidos), 'Ya vencidos', vencidos > 0 ? 'rojo' : 'verde') +
        statTile(n(proximos), 'Vencen 0-50 d', proximos > 0 ? 'amarillo' : 'verde');
      document.getElementById('viz-d5').innerHTML = barListHTML([
        { label: 'Ya vencidos', value: vencidos },
        { label: 'Vencen 0-50 días', value: proximos },
        { label: 'Resto del equipo', value: Math.max(0, rows.length - vencidos - proximos) },
      ], 'azul');
    }
    const tbody = document.querySelector('#tbl-d5 tbody');
    const sorted = [...rows].sort((a, b) => (Number(V(b, d.diasRestKey)) || 0) - (Number(V(a, d.diasRestKey)) || 0));
    tbody.innerHTML = sorted.length ? sorted.slice(0, 200).map((r) => `<tr>
        <td>${esc(OXXO.truncate(String(V(r, d.nombreKey) || '—'), 26))}</td>
        <td>${esc(d.puestoKey ? V(r, d.puestoKey) || '—' : '—')}</td>
        <td class="center">${esc(V(r, d.diasRestKey) || '0')}</td>
        <td>${esc(V(r, d.bucketKey) || '—')}</td>
        <td>${esc(d.fechaFinKey ? V(r, d.fechaFinKey) || '—' : '—')}</td>
      </tr>`).join('') : emptyRow(5, 'Sin colaboradores con saldo de vacaciones.');
    return { colaboradores: rows.length, diasVac: totDias, vencidos, proximos };
  }

  // ── D6 · Ausentismos (mismo pipeline que dashboard-6.html) ──
  async function loadD6() {
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.s6);
    if (!raw || !raw.length) { DATA.d6 = null; return; }
    const h = raw[0];
    const asesorKey = K(h, ['Asesor']);
    const tiendaKey = K(h, ['Tienda']);
    const crKey = K(h, ['Cr de Tienda', 'CR de Tienda']);
    const tipoKey = K(h, ['Denominacion', 'Denominación']);
    const diasKey = K(h, ['Dias', 'Días']);
    const nombreKey = K(h, ['Nombre del empleado o candidato', 'Nombre del empleado']);
    const noPersKey = K(h, ['N de personal', 'N de Personal', 'No de personal', 'N° de personal']);
    const puestoKey = K(h, ['Puesto']);
    const mesKey = K(h, ['Mes']);
    const anoKey = K(h, ['Ano', 'Año']);
    raw.forEach((r) => OXXO.applyAsesorCatalog(r, CATALOG, { asesorKey, tiendaKey, crKey }));
    DATA.d6 = { rows: raw, asesorKey, tiendaKey, crKey, tipoKey, diasKey, nombreKey, noPersKey, puestoKey, mesKey, anoKey };
    addTiendas(raw, tiendaKey, crKey);
  }
  function renderD6(tienda) {
    const d = DATA.d6;
    const el = document.getElementById('sec-d6');
    if (!d) { el.classList.remove('show'); return null; }
    const allRows = rowsFor(d, tienda);
    el.classList.add('show');
    const mesKeyFn = (r) => mesKeyFromMesAno(V(r, d.mesKey), V(r, d.anoKey));
    const meses = [...new Set(allRows.map(mesKeyFn).filter(Boolean))].sort();
    const mesVigente = meses[meses.length - 1] || '';
    const rows = mesVigente ? allRows.filter((r) => mesKeyFn(r) === mesVigente) : allRows;
    document.getElementById('badge-d6').textContent = mesVigente ? mesLabel(mesVigente) : plural(rows.length, 'registro', 'registros');
    const empleados = new Set(rows.map((r) => V(r, d.noPersKey) || V(r, d.nombreKey))).size;
    const totDias = rows.reduce((s, r) => s + (parseFloat(V(r, d.diasKey)) || 0), 0);
    const faltas = rows.filter((r) => OXXO.metricsNormText(V(r, d.tipoKey)).includes('FALTA')).length;
    const porTipo = {};
    rows.forEach((r) => { const tipo = V(r, d.tipoKey) || 'Sin tipo'; porTipo[tipo] = (porTipo[tipo] || 0) + (parseFloat(V(r, d.diasKey)) || 0); });
    if (!rows.length) {
      document.getElementById('stats-d6').innerHTML = '';
      document.getElementById('viz-d6').innerHTML = clearBox('Sin ausentismos registrados este mes');
    } else {
      document.getElementById('stats-d6').innerHTML =
        statTile(n(empleados), 'Empleados', 'rojo') +
        statTile(n(totDias), 'Días ausentes', 'amarillo') +
        statTile(n(faltas), 'Faltas', faltas > 0 ? 'rojo' : 'verde');
      document.getElementById('viz-d6').innerHTML = barListHTML(
        Object.entries(porTipo).map(([label, value]) => ({ label: OXXO.truncate(label, 24), value }))
      );
    }
    renderMonthsAccordion(document.getElementById('months-d6'), allRows, mesKeyFn, {
      titulo: 'Ausentismos',
      summaryHtml: (mrows) => {
        const dias = mrows.reduce((s, r) => s + (parseFloat(V(r, d.diasKey)) || 0), 0);
        const mFaltas = mrows.filter((r) => OXXO.metricsNormText(V(r, d.tipoKey)).includes('FALTA')).length;
        return `<span><b class="amarillo">${n(dias)}</b> días</span><span><b class="rojo">${n(mFaltas)}</b> faltas</span>`;
      },
      theadHtml: '<tr><th>Empleado</th><th>Puesto</th><th>Tipo</th><th class="center">Días</th></tr>',
      rowsHtml: (mrows) => mrows.map((r) => `<tr>
          <td>${esc(OXXO.truncate(String(V(r, d.nombreKey) || '—'), 24))}</td>
          <td>${esc(d.puestoKey ? V(r, d.puestoKey) || '—' : '—')}</td>
          <td>${esc(V(r, d.tipoKey) || '—')}</td>
          <td class="center">${esc(V(r, d.diasKey) || '—')}</td>
        </tr>`).join(''),
    });
    return { ausentes: empleados, diasAus: totDias, faltas };
  }

  // ── D7 · TREO (mismo pipeline que dashboard-7.html) ──
  async function loadD7() {
    const d7 = await OXXO.metricsD7Rows();
    if (!d7) { DATA.d7 = null; return; }
    d7.rows.forEach((r) => { r[d7.asesorKey] = OXXO.resolveAsesorD1(CATALOG, { tienda: V(r, d7.tiendaKey), asesor: V(r, d7.asesorKey) }); });
    // Campos extra (no resueltos por OXXO.metricsD7Rows) para la Ficha
    // Tecnica TREO -- se buscan una sola vez contra la primera fila, el
    // resto de filas comparte los mismos encabezados.
    const sample = d7.rows[0] || {};
    const crKey = K(sample, ['CR', 'ID Tienda', 'ID_Tienda']);
    const turnosKey = K(sample, ['Turnos']);
    const antiguedadKey = K(sample, ['Antiguedad', 'Antigüedad']);
    const accionableKey = K(sample, ['Accionable sugerido TREO', 'Accionable sugerido']);
    DATA.d7 = { ...d7, crKey, turnosKey, antiguedadKey, accionableKey };
    addTiendas(d7.rows, d7.tiendaKey, crKey);
  }
  function fichaRow(label, value, wide) {
    if (value === undefined || value === null || String(value).trim() === '') return '';
    return `<div class="ficha-treo__row${wide ? ' ficha-treo__row--wide' : ''}"><span>${esc(label)}</span><span>${esc(value)}</span></div>`;
  }
  function renderFichaTreo(tiendaLabel, d, r) {
    const sap = V(r, d.sapKey) || '0';
    const treo = V(r, d.treoKey) || '0';
    const dif = OXXO.metricsNum(V(r, d.difKey));
    const mov = movInfo(dif);
    const difTxt = (dif > 0 ? '+' : '') + dif;
    return `<div class="ficha-treo">
      <div class="ficha-treo__head">
        <div class="ficha-treo__title">${esc(tiendaLabel)}</div>
        <span class="ficha-treo__badge">Ficha Técnica TREO</span>
      </div>
      <div class="ficha-treo__body">
        <div class="ficha-treo__kpis">
          <div class="ficha-treo__kpi"><b>${esc(sap)}</b><span>SAP</span></div>
          <div class="ficha-treo__kpi"><b>${esc(treo)}</b><span>TREO</span></div>
          <div class="ficha-treo__kpi ${mov.cls}"><b>${esc(difTxt)}</b><span>Dif</span></div>
        </div>
        <div class="ficha-treo__mov ${mov.cls}"><span class="arrow">${mov.arrow}</span> Movimiento recomendado: ${mov.txt.toUpperCase()}</div>
        <div class="ficha-treo__details">
          ${fichaRow('Activos', d.activosKey ? V(r, d.activosKey) : '')}
          ${fichaRow('Vacantes', d.vacantesKey ? V(r, d.vacantesKey) : '')}
          ${fichaRow('Turnos', d.turnosKey ? V(r, d.turnosKey) : '')}
          ${fichaRow('Antigüedad', d.antiguedadKey ? V(r, d.antiguedadKey) : '')}
          ${fichaRow('Accionable sugerido', d.accionableKey ? V(r, d.accionableKey) : '', true)}
        </div>
      </div>
    </div>`;
  }
  function renderD7(tienda) {
    const d = DATA.d7;
    const el = document.getElementById('sec-d7');
    if (!d) { el.classList.remove('show'); return null; }
    const rows = rowsFor(d, tienda);
    el.classList.add('show');
    document.getElementById('badge-d7').textContent = plural(rows.length, 'registro', 'registros');
    const fichaEl = document.getElementById('ficha-d7');
    const statsEl = document.getElementById('stats-d7');
    const detailEl = document.querySelector('.mi-detail-btn[data-modal-target="tbl-d7"]');
    // Caso normal: la tienda tiene exactamente un registro en TREO -> se
    // muestra la Ficha Tecnica en vez de la tabla generica (que tendria una
    // sola fila, poco util). Se oculta tambien el "Ver detalle" (no hay
    // nada mas que mostrar, la ficha ya trae todos los campos). Si hay 0 o
    // mas de un registro (caso raro) se conserva el comportamiento anterior
    // de KPIs + tabla con su propio "Ver detalle", sin romper nada.
    if (rows.length === 1) {
      fichaEl.innerHTML = renderFichaTreo(rows[0][d.tiendaKey] || tienda, d, rows[0]);
      fichaEl.style.display = '';
      statsEl.style.display = 'none';
      statsEl.innerHTML = '';
      detailEl.style.display = 'none';
      document.querySelector('#tbl-d7 tbody').innerHTML = '';
      const r0 = rows[0];
      const dif0 = OXXO.metricsNum(V(r0, d.difKey));
      return {
        asesor: V(r0, d.asesorKey) || '',
        cr: d.crKey ? V(r0, d.crKey) : '',
        turnos: d.turnosKey ? V(r0, d.turnosKey) : '',
        antiguedad: d.antiguedadKey ? V(r0, d.antiguedadKey) : '',
        sap: OXXO.metricsNum(V(r0, d.sapKey)),
        treo: OXXO.metricsNum(V(r0, d.treoKey)),
        activos: d.activosKey ? OXXO.metricsNum(V(r0, d.activosKey)) : 0,
        dif: dif0,
        mov: movInfo(dif0),
      };
    }
    // Sin registros no se pintan KPIs en cero (se leian como "SAP 0,
    // TREO 0" cuando en realidad la tienda no esta en esa base), igual
    // que en los demas paneles.
    if (!rows.length) {
      fichaEl.style.display = '';
      fichaEl.innerHTML = noneBox('Tu tienda no aparece en TREO');
      statsEl.style.display = 'none';
      statsEl.innerHTML = '';
      detailEl.style.display = 'none';
      document.querySelector('#tbl-d7 tbody').innerHTML = '';
      return null;
    }
    fichaEl.style.display = 'none';
    fichaEl.innerHTML = '';
    statsEl.style.display = '';
    detailEl.style.display = '';
    const sumSap = rows.reduce((s, r) => s + (OXXO.metricsNum(V(r, d.sapKey)) || 0), 0);
    const sumTreo = rows.reduce((s, r) => s + (OXXO.metricsNum(V(r, d.treoKey)) || 0), 0);
    const sumAct = rows.reduce((s, r) => s + (OXXO.metricsNum(V(r, d.activosKey)) || 0), 0);
    const cobertura = sumTreo > 0 ? Math.round((sumAct / sumTreo) * 100) : 0;
    statsEl.innerHTML =
      statTile(n(sumSap), 'SAP') +
      statTile(n(sumTreo), 'TREO', 'azul') +
      statTile(n(sumAct), 'Activos', 'verde') +
      statTile(cobertura + '%', 'Cobertura', cobertura >= 98 ? 'verde' : cobertura >= 90 ? 'amarillo' : 'rojo');
    const tbody = document.querySelector('#tbl-d7 tbody');
    tbody.innerHTML = rows.length ? rows.map((r) => {
      const dif = OXXO.metricsNum(V(r, d.difKey));
      const mov = movInfo(dif);
      const movTxt = mov.cls === 'alineada' ? '✔ Alineada' : mov.cls === 'subir' ? '▲ Subir' : '▼ Bajar';
      return `<tr>
        <td>${esc(V(r, d.asesorKey) || '—')}</td>
        <td class="center">${esc(V(r, d.sapKey) || '0')}</td>
        <td class="center">${esc(V(r, d.treoKey) || '0')}</td>
        <td class="center">${esc(V(r, d.activosKey) || '0')}</td>
        <td class="center"><span class="pill-mov ${mov.cls}">${movTxt}</span></td>
      </tr>`;
    }).join('') : emptyRow(5, 'Tu tienda no aparece en TREO.');
    if (!rows.length) return null;
    const difTot = sumSap - sumTreo;
    return {
      asesor: V(rows[0], d.asesorKey) || '',
      cr: d.crKey ? V(rows[0], d.crKey) : '',
      turnos: '', antiguedad: '',
      sap: sumSap, treo: sumTreo, activos: sumAct, cobertura,
      dif: difTot, mov: movInfo(difTot),
    };
  }

  // ── D8 · Capacidades 2026 (mismo pipeline que dashboard-8.html) ──
  const CERT_COLS = [
    { key: 'Promedio de Código de Ética 2026', label: 'Código de Ética' },
    { key: 'Promedio de Seguridad en la persona 2026', label: 'Seguridad en la Persona' },
    { key: 'Promedio de PLD2026Certificacion', label: 'PLD 2026' },
    { key: 'Promedio de ModuloCercaSiempre2026', label: 'Módulo Cerca Siempre' },
  ];
  async function loadD8() {
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d8);
    if (!raw || !raw.length) { DATA.d8 = null; return; }
    const h = raw[0];
    const asesorKey = K(h, ['Asesor_Correcto', 'Asesor']);
    const unidadKey = K(h, ['Unidad org.', 'Unidad org']);
    const crKey = K(h, ['Cr de tienda', 'Cr de Tienda', 'CR de Tienda']);
    const noPersKey = K(h, ['Nº personal', 'N personal', 'No Personal']);
    const empleadoKey = K(h, ['Empleados', 'Empleado']);
    const certRealKeys = {};
    CERT_COLS.forEach((c) => { certRealKeys[c.key] = K(h, [c.key]) || c.key; });
    raw.forEach((r) => OXXO.applyAsesorCatalog(r, CATALOG, { asesorKey, tiendaKey: unidadKey, crKey }));
    DATA.d8 = { rows: raw, asesorKey, unidadKey, tiendaKey: unidadKey, crKey, noPersKey, empleadoKey, certRealKeys };
    addTiendas(raw, unidadKey, crKey);
  }
  function capValue(row, certKey, certRealKeys) {
    const raw = row[certRealKeys[certKey]];
    if (raw === undefined || raw === null || String(raw).trim() === '') return null;
    const num = OXXO.metricsNum(raw);
    return Number.isFinite(num) ? num : null;
  }
  function renderD8(tienda) {
    const d = DATA.d8;
    const el = document.getElementById('sec-d8');
    if (!d) { el.classList.remove('show'); return null; }
    const rows = rowsFor(d, tienda);
    el.classList.add('show');
    const empleados = new Set(rows.map((r) => V(r, d.noPersKey) || V(r, d.empleadoKey))).size;
    document.getElementById('badge-d8').textContent = plural(empleados, 'empleado', 'empleados');
    const certStats = CERT_COLS.map((c) => {
      let aplic = 0, comp = 0;
      rows.forEach((r) => { const v = capValue(r, c.key, d.certRealKeys); if (v !== null) { aplic++; if (v >= 1) comp++; } });
      return { ...c, aplic, comp, pct: aplic ? Math.round((comp / aplic) * 100) : null };
    });
    const aplicTotal = certStats.reduce((s, c) => s + c.aplic, 0);
    const compTotal = certStats.reduce((s, c) => s + c.comp, 0);
    const pctGlobal = aplicTotal ? Math.round((compTotal / aplicTotal) * 100) : 0;
    document.getElementById('stats-d8').innerHTML = '';
    const certBars = barListHTML(certStats.filter((c) => c.pct !== null).map((c) => ({ label: c.label, value: c.pct, display: c.pct + '%' })), 'verde');
    document.getElementById('viz-d8').innerHTML = rows.length
      ? gaugeRowHTML(pctGlobal, null, 'Cumplimiento global', statTile(n(empleados), 'Empleados')) + certBars
      : noneBox('Tu tienda no aparece en capacidades');
    const tbody = document.querySelector('#tbl-d8 tbody');
    tbody.innerHTML = certStats.length ? certStats.map((c) => `<tr>
        <td>${esc(c.label)}</td>
        <td class="center">${n(c.aplic)}</td>
        <td class="center">${n(c.comp)}</td>
        <td class="center">${c.pct === null ? 'N/A' : c.pct + '%'}</td>
      </tr>`).join('') : emptyRow(4, 'Sin datos de certificaciones.');
    return rows.length ? { capPct: pctGlobal, empleados } : null;
  }

  // ── D9 · Faltantes y Sobrantes (ultimos 3 meses con datos) ──
  async function loadD9() {
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.s9);
    if (!raw || !raw.length) { DATA.d9 = null; return; }
    const h = raw[0];
    const crKey = K(h, ['CR']);
    const tiendaKey = K(h, ['Tienda']);
    const importeKey = K(h, ['Importe']);
    const tipoKey = K(h, ['Tipo']);
    const fechaKey = K(h, ['Fecha']);
    const asesorKey = K(h, ['Asesor']);
    const conceptoKey = K(h, ['Concepto']);
    const meses = new Set();
    raw.forEach((r) => { const f = String(V(r, fechaKey) || ''); if (/^\d{4}-\d{2}/.test(f)) meses.add(f.slice(0, 7)); });
    const ultimos3 = [...meses].sort().slice(-3);
    const rows = ultimos3.length ? raw.filter((r) => ultimos3.includes(String(V(r, fechaKey) || '').slice(0, 7))) : raw;
    DATA.d9 = { rows, crKey, tiendaKey, importeKey, tipoKey, fechaKey, asesorKey, conceptoKey, meses: ultimos3 };
    addTiendas(raw, tiendaKey, crKey);
  }
  function sumaFaltanteSobrante(rows, importeKey) {
    let faltante = 0, sobrante = 0;
    rows.forEach((r) => {
      const importe = OXXO.metricsNum(V(r, importeKey));
      if (importe >= 0) faltante += importe; else sobrante += Math.abs(importe);
    });
    return { faltante, sobrante };
  }
  function renderD9(tienda) {
    const d = DATA.d9;
    const el = document.getElementById('sec-d9');
    if (!d) { el.classList.remove('show'); return null; }
    const rows = rowsFor(d, tienda);
    el.classList.add('show');
    document.getElementById('badge-d9').textContent = d.meses.length ? plural(d.meses.length, 'mes', 'meses') : '—';
    const { faltante, sobrante } = sumaFaltanteSobrante(rows, d.importeKey);
    const neto = faltante - sobrante;
    const monthsEl = document.getElementById('months-d9');
    if (!rows.length) {
      document.getElementById('stats-d9').innerHTML = '';
      document.getElementById('viz-d9').innerHTML = clearBox('Sin faltantes ni sobrantes en el periodo');
      monthsEl.innerHTML = '';
      return null;
    }
    document.getElementById('stats-d9').innerHTML =
      statTile('$' + n(faltante), 'Faltante') +
      statTile('$' + n(sobrante), 'Sobrante') +
      statTile((neto >= 0 ? '$' : '-$') + n(Math.abs(neto)), 'Neto');
    document.getElementById('viz-d9').innerHTML = '';
    const mesKeyFn = (r) => String(V(r, d.fechaKey) || '').slice(0, 7);
    renderMonthsAccordion(monthsEl, rows, mesKeyFn, {
      titulo: 'Faltantes y Sobrantes',
      summaryHtml: (mrows) => {
        const { faltante: mf, sobrante: ms } = sumaFaltanteSobrante(mrows, d.importeKey);
        return `<span><b class="rojo">$${n(mf)}</b> falt</span><span><b class="verde">$${n(ms)}</b> sobr</span>`;
      },
      theadHtml: '<tr><th>Fecha</th><th>Asesor</th><th>Tipo</th><th>Concepto</th><th class="center">Importe</th></tr>',
      rowsHtml: (mrows) => [...mrows].sort((a, b) => String(V(b, d.fechaKey)).localeCompare(String(V(a, d.fechaKey)))).map((r) => `<tr>
          <td>${esc(V(r, d.fechaKey) || '—')}</td>
          <td>${esc(d.asesorKey ? OXXO.truncate(String(V(r, d.asesorKey) || '—'), 20) : '—')}</td>
          <td>${esc(V(r, d.tipoKey) || '—')}</td>
          <td>${esc(d.conceptoKey ? OXXO.truncate(String(V(r, d.conceptoKey) || '—'), 26) : '—')}</td>
          <td class="center">$${n(Math.abs(OXXO.metricsNum(V(r, d.importeKey))))}</td>
        </tr>`).join(''),
    });
    return { faltante, sobrante, neto };
  }

  // ── D10 · Personal FLEX (foto: colaboradores FLEX por tienda) ──
  async function loadD10() {
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d10);
    if (!raw || !raw.length) { DATA.d10 = null; return; }
    const h = raw[0];
    // Coincidencia exacta (no K/metricsFindKey): si la pestana "Dashboard_10_FLEX"
    // no existe todavia, gviz no da error -- devuelve otra pestana del libro
    // por accidente (normalmente Dashboard_1_Diario). Con coincidencia "se
    // parece a", 'Tienda' emparejaba por error contra la columna 'CR TIENDA'
    // de esa hoja, y esos codigos de CR terminaban ensuciando el buscador de
    // tiendas de toda la pagina (ver addTiendas). Exacta evita eso: si la
    // hoja real trae "Tienda" literal, sigue matcheando igual.
    const tiendaKey = OXXO.metricsFindKeyExact(h, ['Tienda']);
    const crKey = K(h, ['Cr de Tienda', 'CR TIENDA', 'CR']);
    const fechaKey = K(h, ['Fecha']);
    const flexKey = K(h, ['COLABORADORESFLEX_NUM']);
    DATA.d10 = { rows: raw, tiendaKey, crKey, fechaKey, flexKey };
    addTiendas(raw, tiendaKey, crKey);
  }
  function renderD10(tienda) {
    const d = DATA.d10;
    const el = document.getElementById('sec-d10');
    if (!d) { el.classList.remove('show'); return null; }
    const rows = rowsFor(d, tienda);
    el.classList.add('show');
    if (!rows.length) {
      document.getElementById('badge-d10').textContent = '—';
      document.getElementById('stats-d10').innerHTML = '';
      return null;
    }
    const flex = rows.reduce((s, r) => s + (OXXO.metricsNum(V(r, d.flexKey)) || 0), 0);
    const fecha = V(rows[0], d.fechaKey) || '—';
    document.getElementById('badge-d10').textContent = fecha;
    document.getElementById('stats-d10').innerHTML = statTile(n(flex), 'Colaboradores FLEX');
    return { flex, fecha };
  }

  // ── D11 · Registro y Apego a Horario (foto semanal, por asesor) ──
  function pctVal(v) { const num = OXXO.metricsNum(v); return Number.isFinite(num) ? Math.round(num) : null; }
  function pctTxt(v) { const p = pctVal(v); return p === null ? '—' : p + '%'; }
  function pctTone(p) { if (p === null) return ''; return p >= 90 ? 'verde' : p >= 70 ? 'amarillo' : 'rojo'; }
  async function loadD11() {
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d11);
    if (!raw || !raw.length) { DATA.d11 = null; return; }
    const h = raw[0];
    // Ver nota igual en loadD10(): exacta, no fuzzy, para que si la hoja
    // todavia no existe y gviz devuelve otra por error, no confunda otra
    // columna (ej. CR) con la de Tienda y ensucie el buscador global.
    const tiendaKey = OXXO.metricsFindKeyExact(h, ['Tienda']);
    const asesorKey = K(h, ['Asesor']);
    const fechaKey = K(h, ['Fecha']);
    const entradasKey = K(h, ['% Cumpl Reg Entradas']);
    const salidasKey = K(h, ['% Cumpl Reg Salidas']);
    const totalKey = K(h, ['% Cumpl Reg Total']);
    const edicionKey = K(h, ['% Edicion Registros', '% Edición Registros']);
    const anadidosKey = K(h, ['% Anadidos', '% Añadidos']);
    const sinEditarKey = K(h, ['% Sin Editar']);
    const apegoEjecKey = K(h, ['% Apego Ejecutado']);
    const apegoPubKey = K(h, ['% Apego Publicado']);
    DATA.d11 = { rows: raw, tiendaKey, asesorKey, fechaKey, entradasKey, salidasKey, totalKey, edicionKey, anadidosKey, sinEditarKey, apegoEjecKey, apegoPubKey };
    addTiendas(raw, tiendaKey);
  }
  function renderD11(tienda) {
    const d = DATA.d11;
    const el = document.getElementById('sec-d11');
    if (!d) { el.classList.remove('show'); return null; }
    const rows = rowsFor(d, tienda);
    el.classList.add('show');
    const tbody = document.querySelector('#tbl-d11 tbody');
    if (!rows.length) {
      document.getElementById('badge-d11').textContent = '—';
      document.getElementById('stats-d11').innerHTML = '';
      tbody.innerHTML = emptyRow(9, 'Tu tienda no aparece en Registro y Apego a Horario.');
      return null;
    }
    document.getElementById('badge-d11').textContent = V(rows[0], d.fechaKey) || '—';
    const avg = (key) => {
      const vals = rows.map((r) => pctVal(V(r, key))).filter((v) => v !== null);
      return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
    };
    const cumplTotal = avg(d.totalKey);
    const apegoEjec = avg(d.apegoEjecKey);
    const apegoPub = avg(d.apegoPubKey);
    document.getElementById('stats-d11').innerHTML =
      statTile(cumplTotal === null ? '—' : cumplTotal + '%', 'Cumpl. registro', pctTone(cumplTotal)) +
      statTile(apegoEjec === null ? '—' : apegoEjec + '%', 'Apego ejecutado', pctTone(apegoEjec)) +
      statTile(apegoPub === null ? '—' : apegoPub + '%', 'Apego publicado', pctTone(apegoPub));
    tbody.innerHTML = rows.map((r) => `<tr>
        <td>${esc(OXXO.truncate(String(V(r, d.asesorKey) || '—'), 22))}</td>
        <td class="center">${pctTxt(V(r, d.entradasKey))}</td>
        <td class="center">${pctTxt(V(r, d.salidasKey))}</td>
        <td class="center">${pctTxt(V(r, d.totalKey))}</td>
        <td class="center">${pctTxt(V(r, d.edicionKey))}</td>
        <td class="center">${pctTxt(V(r, d.anadidosKey))}</td>
        <td class="center">${pctTxt(V(r, d.sinEditarKey))}</td>
        <td class="center">${pctTxt(V(r, d.apegoEjecKey))}</td>
        <td class="center">${pctTxt(V(r, d.apegoPubKey))}</td>
      </tr>`).join('');
    return { cumplTotal, apegoEjec, apegoPub };
  }

  // ── Resumen y alertas ──────────────────────────────────
  // Antes habia que leer los 8 paneles para saber si la tienda estaba
  // bien o mal. Estos dos bloques responden eso de una: el resumen trae
  // los titulares de cada dashboard con su semaforo, y las alertas solo
  // listan lo que necesita atencion (si no hay nada, se dice explicito).
  function renderResumen(S) {
    const tiles = [];
    if (S.d1) tiles.push(rkTile(n(S.d1.vacantes), 'Vacantes', toneByCount(S.d1.vacantes)));
    if (S.d2) tiles.push(rkTile(n(S.d2.bajas), 'Bajas del mes', toneByCount(S.d2.bajas)));
    if (S.d3) tiles.push(rkTile(S.d3.ec + '%', 'Equipo completo', tonePct(S.d3.ec, 80, 50),
      S.d3.ecSin !== null && S.d3.ecSin !== undefined ? `sin ausentismo: ${S.d3.ecSin}%` : ''));
    if (S.d4) tiles.push(rkTile(n(S.d4.horas), 'Horas extra', toneByCount(S.d4.horas, 20), S.d4.gasto ? '$' + n(S.d4.gasto) : ''));
    if (S.d6) tiles.push(rkTile(n(S.d6.diasAus), 'Días ausentismo', toneByCount(S.d6.diasAus, 20), S.d6.ausentes ? S.d6.ausentes + ' empleados' : ''));
    if (S.d5) tiles.push(rkTile(n(S.d5.vencidos), 'Vacaciones vencidas', toneByCount(S.d5.vencidos, 2), S.d5.colaboradores ? 'de ' + S.d5.colaboradores : ''));
    if (S.d8) tiles.push(rkTile(S.d8.capPct + '%', 'Capacidades', tonePct(S.d8.capPct, 90, 60)));
    if (S.d10) tiles.push(rkTile(n(S.d10.flex), 'Personal FLEX'));
    if (S.d11 && S.d11.cumplTotal !== null) tiles.push(rkTile(S.d11.cumplTotal + '%', 'Cumpl. registro', tonePct(S.d11.cumplTotal, 90, 70)));
    document.getElementById('ficha-resumen').innerHTML = tiles.join('');
  }
  function renderAlertas(S) {
    const a = [];
    if (S.d1 && S.d1.vacantes) a.push({ t: S.d1.vacantes >= 3 ? 'is-bad' : 'is-warn', txt: `${S.d1.vacantes} vacante${S.d1.vacantes > 1 ? 's' : ''} por cubrir` });
    if (S.d2 && S.d2.bajas) a.push({ t: S.d2.bajas >= 3 ? 'is-bad' : 'is-warn', txt: `${S.d2.bajas} baja${S.d2.bajas > 1 ? 's' : ''} este mes${S.d2.motivo ? ' · ' + OXXO.truncate(S.d2.motivo, 26) : ''}` });
    if (S.d3 && S.d3.criticas) a.push({ t: 'is-bad', txt: `${S.d3.criticas} registro${S.d3.criticas > 1 ? 's' : ''} de estructura crítica` });
    if (S.d4 && S.d4.gasto) a.push({ t: S.d4.horas >= 20 ? 'is-bad' : 'is-warn', txt: `$${n(S.d4.gasto)} en tiempo extra (${n(S.d4.horas)} h)` });
    if (S.d6 && S.d6.faltas) a.push({ t: 'is-bad', txt: `${S.d6.faltas} falta${S.d6.faltas > 1 ? 's' : ''} registrada${S.d6.faltas > 1 ? 's' : ''}` });
    if (S.d5 && S.d5.vencidos) a.push({ t: 'is-warn', txt: `${S.d5.vencidos} con vacaciones ya vencidas` });
    if (S.d5 && S.d5.proximos) a.push({ t: 'is-warn', txt: `${S.d5.proximos} vencen en 0-50 días` });
    if (S.d7 && S.d7.dif) a.push({ t: 'is-info', txt: `TREO: ${S.d7.mov.txt.toLowerCase()} ${Math.abs(S.d7.dif)} posición${Math.abs(S.d7.dif) > 1 ? 'es' : ''}` });
    if (S.d8 && S.d8.capPct < 100) a.push({ t: S.d8.capPct < 60 ? 'is-bad' : 'is-warn', txt: `Capacidades al ${S.d8.capPct}%` });
    if (S.d11 && S.d11.cumplTotal !== null && S.d11.cumplTotal < 90) a.push({ t: S.d11.cumplTotal < 70 ? 'is-bad' : 'is-warn', txt: `Cumplimiento de registro al ${S.d11.cumplTotal}%` });
    document.getElementById('ficha-alertas').innerHTML = chipsHTML(a, 'Sin alertas: tu tienda está en orden');
  }
  function renderIdentidad(tiendaDisplay, S) {
    document.getElementById('ficha-tienda-title').textContent = tiendaDisplay;
    const d7 = S.d7 || {};
    document.getElementById('ficha-meta').innerHTML = metaHTML([
      ['Asesor / AT', d7.asesor],
      ['CR', d7.cr],
      ['Turnos', d7.turnos],
      ['Antigüedad', d7.antiguedad],
      ['Colaboradores', S.d5 && S.d5.colaboradores ? String(S.d5.colaboradores) : ''],
    ]);
    const st = document.getElementById('ficha-status');
    if (d7.mov) {
      st.textContent = d7.mov.cls === 'alineada' ? '✔ Estructura alineada'
        : `${d7.mov.arrow} ${d7.mov.txt} ${Math.abs(d7.dif)}`;
    } else {
      st.textContent = 'Ficha de tienda';
    }
  }

  // ── Orquestacion ───────────────────────────────────────
  function renderFor(tiendaDisplay) {
    if (!tiendaDisplay) return;
    const tienda = tKey(tiendaDisplay);
    document.getElementById('mi-empty').style.display = 'none';
    document.getElementById('mi-content').style.display = 'block';
    const S = {
      d1: renderD1(tienda), d2: renderD2(tienda), d3: renderD3(tienda), d4: renderD4(tienda),
      d5: renderD5(tienda), d6: renderD6(tienda), d7: renderD7(tienda), d8: renderD8(tienda),
      d9: renderD9(tienda), d10: renderD10(tienda), d11: renderD11(tienda),
    };
    renderIdentidad(tiendaDisplay, S);
    renderResumen(S);
    renderAlertas(S);
  }

  async function init() {
    CATALOG = await OXXO.loadAsesorCatalog();
    await Promise.all([loadD1(), loadD2(), loadD3(), loadD4(), loadD5(), loadD6(), loadD7(), loadD8(), loadD9(), loadD10(), loadD11()]);
    document.getElementById('corte-badge').textContent = '⟳ Datos en vivo · Plaza Oaxaca';
    mountSingleSelect('mi-tienda-select', [...TIENDAS.values()], {
      placeholder: 'Busca tu tienda',
      searchId: 'mi-tienda-search',
      searchPlaceholder: 'Buscar tienda...',
      onChange: renderFor,
    });
    OXXO.updateFooterTime('load-time');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
