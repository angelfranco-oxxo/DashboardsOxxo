/* ==========================================================
   MI DASHBOARD — vista personal por asesor
   Un asesor elige su nombre y ve, en una sola ficha, sus datos
   de los 8 dashboards (Vacantes, Bajas, Aprovechamiento, Tiempo
   Extra, Vacaciones, Ausentismos, TREO y Capacidades), usando la
   MISMA logica de resolucion de asesor (OXXO.resolveAsesorD1 /
   OXXO.applyAsesorCatalog) que ya usa cada dashboard real, para
   que los numeros aqui coincidan con los que se ven alla.

   Es la hermana de js/mi-tienda.js: misma ficha (cabecera de
   identidad, resumen con semaforo, alertas y un panel por
   dashboard) agrupando por asesor en vez de por tienda. Las
   piezas visuales salen de js/mi-ficha-ui.js para que las dos
   paginas no se desincronicen.
   ========================================================== */
(function () {
  'use strict';

  // ── Utilidades compartidas ────────────────────────────
  const {
    esc, plural, statTile, emptyRow, clearBox, noneBox,
    gaugeRowHTML, barListHTML, pctBarsHTML,
    movInfo, movPill, estatusCell, rkTile, toneByCount, tonePct,
    chipsHTML, metaHTML, mountSingleSelect,
  } = window.OXXO_FICHA;
  const V = (row, key) => OXXO.metricsVal(row, key);
  const K = (row, aliases) => OXXO.metricsFindKey(row, aliases);
  const n = (v) => OXXO.formatNum(Math.round(Number(v) || 0));
  const tName = (v, len) => OXXO.truncate(String(v || '—'), len || 24);

  function semanaRank(value) {
    const v = String(value || '').trim();
    const sem = v.match(/(?:sem|semana)\s*(\d{1,2})/i);
    if (sem) return Number(sem[1]);
    if (/^\d{1,2}$/.test(v)) return Number(v);
    const nums = v.match(/\d+/g);
    return nums ? Number(nums[nums.length - 1]) : -1;
  }
  function numParse(v) { const x = parseFloat(String(v ?? '').replace(/,/g, '')); return isNaN(x) ? 0 : x; }

  // ── Estado global (se carga una sola vez) ─────────────
  let CATALOG = null;
  const ASESORES = new Set();
  const DATA = {};

  function addAsesores(names) {
    names.forEach((a) => {
      const t = String(a || '').trim();
      if (!t || /sin asesor/i.test(t)) return;
      ASESORES.add(t);
    });
  }
  function rowsFor(d, asesor) {
    return d.rows.filter((r) => V(r, d.asesorKey) === asesor);
  }

  // ── D1 · Vacantes Diarias (mismo pipeline que dashboard-1.html) ──
  async function loadD1() {
    const d1 = await OXXO.metricsD1Rows();
    if (!d1) { DATA.d1 = null; return; }
    const diasKey = d1.rows[0] ? K(d1.rows[0], ['Dias Vacantes', 'Dias_Vacantes']) : null;
    const fechaKey = d1.rows[0] ? K(d1.rows[0], ['Fecha']) : null;
    DATA.d1 = { ...d1, diasKey, fechaKey };
    addAsesores(d1.rows.map((r) => V(r, d1.asesorKey)));
  }
  function renderD1(asesor) {
    const d = DATA.d1;
    const el = document.getElementById('sec-d1');
    if (!d) { el.classList.remove('show'); return null; }
    const rows = rowsFor(d, asesor);
    el.classList.add('show');
    document.getElementById('badge-d1').textContent = d.mes || '—';
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
      // Por tienda: a un asesor le sirve mas saber DONDE estan sus vacantes
      // que el desglose por puesto, que ya viene en los tiles de arriba.
      const porTienda = {};
      rows.forEach((r) => { const t = V(r, d.tiendaKey) || 'Sin tienda'; porTienda[t] = (porTienda[t] || 0) + 1; });
      document.getElementById('viz-d1').innerHTML = barListHTML(
        Object.entries(porTienda).map(([label, value]) => ({ label: tName(label, 22), value }))
      );
    }
    const tbody = document.querySelector('#tbl-d1 tbody');
    tbody.innerHTML = rows.length ? rows.slice(0, 200).map((r) => `<tr>
        <td>${esc(tName(V(r, d.tiendaKey), 26))}</td>
        <td>${esc(V(r, d.puestoKey) || '—')}</td>
        <td class="center">${d.diasKey ? esc(OXXO.metricsDiasVacantesValue(V(r, d.diasKey))) : '—'}</td>
      </tr>`).join('') : emptyRow(3, 'Sin vacantes activas en el mes vigente. 🎉');
    return { vacantes: rows.length, tiendasConVacante: new Set(rows.map((r) => V(r, d.tiendaKey))).size };
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
    const { mes, rows } = OXXO.metricsFilterLatestMonth(base, (r) => OXXO.metricsRowMonthKeyD2(r, mesKey, fechaKey));
    DATA.d2 = { rows, mes, asesorKey, tiendaKey, puestoKey, motivoKey, detalleKey, fechaKey };
    addAsesores(rows.map((r) => V(r, asesorKey)));
  }
  function renderD2(asesor) {
    const d = DATA.d2;
    const el = document.getElementById('sec-d2');
    if (!d) { el.classList.remove('show'); return null; }
    const rows = rowsFor(d, asesor);
    el.classList.add('show');
    document.getElementById('badge-d2').textContent = d.mes || '—';
    const porMotivo = {};
    rows.forEach((r) => { const m = V(r, d.detalleKey) || V(r, d.motivoKey) || 'Sin motivo'; porMotivo[m] = (porMotivo[m] || 0) + 1; });
    const topMotivo = Object.entries(porMotivo).sort((a, b) => b[1] - a[1])[0];
    if (!rows.length) {
      document.getElementById('stats-d2').innerHTML = '';
      document.getElementById('viz-d2').innerHTML = clearBox('Sin bajas este mes');
    } else {
      document.getElementById('stats-d2').innerHTML =
        statTile(n(rows.length), 'Bajas del mes', 'rojo') +
        statTile(topMotivo ? OXXO.truncate(topMotivo[0], 22) : '—', 'Motivo más frecuente', 'amarillo txt');
      document.getElementById('viz-d2').innerHTML = barListHTML(
        Object.entries(porMotivo).map(([label, value]) => ({ label: OXXO.truncate(label, 24), value }))
      );
    }
    const tbody = document.querySelector('#tbl-d2 tbody');
    tbody.innerHTML = rows.length ? rows.slice(0, 200).map((r) => `<tr>
        <td>${esc(tName(V(r, d.tiendaKey), 22))}</td>
        <td>${esc(V(r, d.puestoKey) || '—')}</td>
        <td>${esc(OXXO.truncate(String(V(r, d.detalleKey) || V(r, d.motivoKey) || '—'), 22))}</td>
      </tr>`).join('') : emptyRow(3, 'Sin bajas en el mes vigente. 🎉');
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
    // Misma columna que usa la ficha de dashboard-3.html: el estatus
    // recalculado descontando ausentismos, con el mismo vocabulario.
    const ecSinAusKey = K(h, ['EC SIN AUSENTISMO', 'EC sin ausentismo', 'EC Sin Ausentismo']);
    const semanaKey = K(h, ['Mes Semana', 'Semana', 'Fecha', 'FECHA']);
    raw.forEach((r) => { r[asesorKey] = OXXO.resolveAsesorD1(CATALOG, { cr: V(r, crKey), tienda: V(r, tiendaKey), asesor: V(r, asesorKey) }); });
    const semanas = [...new Set(raw.map((r) => String(V(r, semanaKey) || '').trim()).filter(Boolean))].sort();
    const semana = semanas[semanas.length - 1] || '';
    const rows = semana ? raw.filter((r) => String(V(r, semanaKey) || '').trim() === semana) : raw;
    DATA.d3 = { rows, semana, asesorKey, tiendaKey, estatusKey, ecSinAusKey };
    addAsesores(rows.map((r) => V(r, asesorKey)));
  }
  function renderD3(asesor) {
    const d = DATA.d3;
    const el = document.getElementById('sec-d3');
    if (!d) { el.classList.remove('show'); return null; }
    const rows = rowsFor(d, asesor);
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
      : noneBox('Sin tiendas asignadas en la semana vigente');
    const tbody = document.querySelector('#tbl-d3 tbody');
    tbody.innerHTML = rows.length ? rows.slice(0, 200).map((r) => `<tr>
        <td>${esc(tName(V(r, d.tiendaKey), 24))}</td>
        ${estatusCell(V(r, d.estatusKey))}
        ${estatusCell(d.ecSinAusKey ? V(r, d.ecSinAusKey) : '')}
      </tr>`).join('') : emptyRow(3, 'Sin tiendas asignadas en la semana vigente.');
    return rows.length ? { ec, ecSin, completas, incompletas, criticas, tiendas: rows.length } : null;
  }

  // ── D4 · Tiempo Extra (mismo pipeline que dashboard-4.html) ──
  async function loadD4() {
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.s4);
    if (!raw || !raw.length) { DATA.d4 = null; return; }
    const h = raw[0];
    const asesorKey = K(h, ['Asesor']);
    const tiendaKey = K(h, ['Texto breve de unidad organizativa']);
    const crKey = K(h, ['Cr de Tienda', 'CR de Tienda']);
    const semanaKey = K(h, ['Semana']);
    const horasKey = K(h, ['Cantidad']);
    const importeKey = K(h, ['Importe']);
    raw.forEach((r) => OXXO.applyAsesorCatalog(r, CATALOG, { asesorKey, tiendaKey, crKey }));
    const semanas = [...new Set(raw.map((r) => String(V(r, semanaKey) || '').trim()).filter(Boolean))];
    semanas.sort((a, b) => semanaRank(b) - semanaRank(a));
    const semana = semanas[0] || '';
    const rows = semana ? raw.filter((r) => String(V(r, semanaKey) || '').trim() === semana) : raw;
    DATA.d4 = { rows, semana, asesorKey, tiendaKey, horasKey, importeKey };
    addAsesores(rows.map((r) => V(r, asesorKey)));
  }
  function renderD4(asesor) {
    const d = DATA.d4;
    const el = document.getElementById('sec-d4');
    if (!d) { el.classList.remove('show'); return null; }
    const rows = rowsFor(d, asesor);
    el.classList.add('show');
    document.getElementById('badge-d4').textContent = d.semana ? (/sem/i.test(d.semana) ? d.semana : 'Sem ' + d.semana) : '—';
    const totHoras = rows.reduce((s, r) => s + numParse(V(r, d.horasKey)), 0);
    const totGasto = rows.reduce((s, r) => s + numParse(V(r, d.importeKey)), 0);
    const porTienda = {};
    rows.forEach((r) => {
      const t = V(r, d.tiendaKey) || 'Sin tienda';
      if (!porTienda[t]) porTienda[t] = { horas: 0, gasto: 0 };
      porTienda[t].horas += numParse(V(r, d.horasKey));
      porTienda[t].gasto += numParse(V(r, d.importeKey));
    });
    const tiendas = Object.entries(porTienda).sort((a, b) => b[1].gasto - a[1].gasto);
    if (!rows.length) {
      document.getElementById('stats-d4').innerHTML = '';
      document.getElementById('viz-d4').innerHTML = clearBox('Sin tiempo extra esta semana');
    } else {
      document.getElementById('stats-d4').innerHTML =
        statTile(n(totHoras), 'Horas TE', 'amarillo') +
        statTile('$' + n(totGasto), 'Gasto TE', 'rojo') +
        statTile(n(tiendas.length), 'Tiendas');
      document.getElementById('viz-d4').innerHTML = barListHTML(
        tiendas.map(([label, v]) => ({ label: tName(label, 22), value: v.horas })), 'naranja'
      );
    }
    const tbody = document.querySelector('#tbl-d4 tbody');
    tbody.innerHTML = tiendas.length ? tiendas.map(([t, v]) => `<tr>
        <td>${esc(tName(t, 24))}</td>
        <td class="center">${n(v.horas)}</td>
        <td class="center">$${n(v.gasto)}</td>
      </tr>`).join('') : emptyRow(3, 'Sin tiempo extra en la semana vigente. 🎉');
    return { horas: totHoras, gasto: totGasto, tiendasConTE: tiendas.length };
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
    raw.forEach((r) => { r[asesorKey] = OXXO.resolveAsesorD1(CATALOG, { asesor: V(r, asesorKey), tienda: V(r, tiendaKey) }); });
    DATA.d5 = { rows: raw, asesorKey, tiendaKey, nombreKey, diasRestKey, bucketKey };
    addAsesores(raw.map((r) => V(r, asesorKey)));
  }
  function renderD5(asesor) {
    const d = DATA.d5;
    const el = document.getElementById('sec-d5');
    if (!d) { el.classList.remove('show'); return null; }
    const rows = rowsFor(d, asesor);
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
        <td>${esc(OXXO.truncate(String(V(r, d.nombreKey) || '—'), 22))}</td>
        <td>${esc(tName(V(r, d.tiendaKey), 20))}</td>
        <td class="center">${esc(V(r, d.diasRestKey) || '0')}</td>
      </tr>`).join('') : emptyRow(3, 'Sin colaboradores con saldo de vacaciones.');
    return { colaboradores: rows.length, diasVac: totDias, vencidos, proximos };
  }

  // ── D6 · Ausentismos (mismo pipeline que dashboard-6.html; sin filtro de semana por defecto) ──
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
    raw.forEach((r) => OXXO.applyAsesorCatalog(r, CATALOG, { asesorKey, tiendaKey, crKey }));
    DATA.d6 = { rows: raw, asesorKey, tiendaKey, tipoKey, diasKey, nombreKey, noPersKey };
    addAsesores(raw.map((r) => V(r, asesorKey)));
  }
  function renderD6(asesor) {
    const d = DATA.d6;
    const el = document.getElementById('sec-d6');
    if (!d) { el.classList.remove('show'); return null; }
    const rows = rowsFor(d, asesor);
    el.classList.add('show');
    document.getElementById('badge-d6').textContent = plural(rows.length, 'registro', 'registros');
    const empleados = new Set(rows.map((r) => V(r, d.noPersKey) || V(r, d.nombreKey))).size;
    const totDias = rows.reduce((s, r) => s + (parseFloat(V(r, d.diasKey)) || 0), 0);
    const faltas = rows.filter((r) => OXXO.metricsNormText(V(r, d.tipoKey)).includes('FALTA')).length;
    const porTipo = {};
    rows.forEach((r) => { const tipo = V(r, d.tipoKey) || 'Sin tipo'; porTipo[tipo] = (porTipo[tipo] || 0) + (parseFloat(V(r, d.diasKey)) || 0); });
    if (!rows.length) {
      document.getElementById('stats-d6').innerHTML = '';
      document.getElementById('viz-d6').innerHTML = clearBox('Sin ausentismos registrados');
    } else {
      document.getElementById('stats-d6').innerHTML =
        statTile(n(empleados), 'Empleados', 'rojo') +
        statTile(n(totDias), 'Días ausentes', 'amarillo') +
        statTile(n(faltas), 'Faltas', faltas > 0 ? 'rojo' : 'verde');
      document.getElementById('viz-d6').innerHTML = barListHTML(
        Object.entries(porTipo).map(([label, value]) => ({ label: OXXO.truncate(label, 24), value }))
      );
    }
    const tbody = document.querySelector('#tbl-d6 tbody');
    tbody.innerHTML = rows.length ? rows.slice(0, 200).map((r) => `<tr>
        <td>${esc(OXXO.truncate(String(V(r, d.nombreKey) || '—'), 22))}</td>
        <td>${esc(tName(V(r, d.tiendaKey), 20))}</td>
        <td class="center">${esc(V(r, d.diasKey) || '—')}</td>
      </tr>`).join('') : emptyRow(3, 'Sin ausentismos registrados. 🎉');
    return { ausentes: empleados, diasAus: totDias, faltas };
  }

  // ── D7 · TREO (mismo pipeline que dashboard-7.html) ──
  async function loadD7() {
    const d7 = await OXXO.metricsD7Rows();
    if (!d7) { DATA.d7 = null; return; }
    d7.rows.forEach((r) => { r[d7.asesorKey] = OXXO.resolveAsesorD1(CATALOG, { tienda: V(r, d7.tiendaKey), asesor: V(r, d7.asesorKey) }); });
    DATA.d7 = d7;
    addAsesores(d7.rows.map((r) => V(r, d7.asesorKey)));
  }
  function renderD7(asesor) {
    const d = DATA.d7;
    const el = document.getElementById('sec-d7');
    if (!d) { el.classList.remove('show'); return null; }
    const rows = rowsFor(d, asesor);
    el.classList.add('show');
    document.getElementById('badge-d7').textContent = plural(rows.length, 'tienda', 'tiendas');
    if (!rows.length) {
      document.getElementById('stats-d7').innerHTML = '';
      document.getElementById('viz-d7').innerHTML = noneBox('No tienes tiendas en TREO');
      document.querySelector('#tbl-d7 tbody').innerHTML = emptyRow(5, 'No tienes tiendas asignadas en TREO.');
      return null;
    }
    const sumSap = rows.reduce((s, r) => s + (OXXO.metricsNum(V(r, d.sapKey)) || 0), 0);
    const sumTreo = rows.reduce((s, r) => s + (OXXO.metricsNum(V(r, d.treoKey)) || 0), 0);
    const sumAct = rows.reduce((s, r) => s + (OXXO.metricsNum(V(r, d.activosKey)) || 0), 0);
    const cobertura = sumTreo > 0 ? Math.round((sumAct / sumTreo) * 100) : 0;
    let subir = 0, bajar = 0, alineadas = 0;
    rows.forEach((r) => {
      const dif = OXXO.metricsNum(V(r, d.difKey));
      if (dif > 0) subir++; else if (dif < 0) bajar++; else alineadas++;
    });
    document.getElementById('viz-d7').innerHTML = gaugeRowHTML(cobertura, null, 'Cobertura TREO',
      statTile(n(alineadas), 'Alineadas', 'verde') +
      statTile(n(subir), 'A subir', subir > 0 ? 'amarillo' : 'verde') +
      statTile(n(bajar), 'A bajar', bajar > 0 ? 'rojo' : 'verde')
    );
    document.getElementById('stats-d7').innerHTML =
      statTile(n(sumSap), 'SAP') +
      statTile(n(sumTreo), 'TREO', 'azul') +
      statTile(n(sumAct), 'Activos', 'verde');
    const tbody = document.querySelector('#tbl-d7 tbody');
    tbody.innerHTML = rows.map((r) => `<tr>
        <td>${esc(tName(V(r, d.tiendaKey), 22))}</td>
        <td class="center">${esc(V(r, d.sapKey) || '0')}</td>
        <td class="center">${esc(V(r, d.treoKey) || '0')}</td>
        <td class="center">${esc(V(r, d.activosKey) || '0')}</td>
        <td class="center">${movPill(OXXO.metricsNum(V(r, d.difKey)))}</td>
      </tr>`).join('');
    return { tiendas: rows.length, sap: sumSap, treo: sumTreo, activos: sumAct, cobertura, subir, bajar, alineadas };
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
    DATA.d8 = { rows: raw, asesorKey, unidadKey, noPersKey, empleadoKey, certRealKeys };
    addAsesores(raw.map((r) => V(r, asesorKey)));
  }
  function capValue(row, certKey, certRealKeys) {
    const raw = row[certRealKeys[certKey]];
    if (raw === undefined || raw === null || String(raw).trim() === '') return null;
    const num = OXXO.metricsNum(raw);
    return Number.isFinite(num) ? num : null;
  }
  function renderD8(asesor) {
    const d = DATA.d8;
    const el = document.getElementById('sec-d8');
    if (!d) { el.classList.remove('show'); return null; }
    const rows = rowsFor(d, asesor);
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
      : noneBox('No apareces en capacidades');
    const tbody = document.querySelector('#tbl-d8 tbody');
    tbody.innerHTML = certStats.length ? certStats.map((c) => `<tr>
        <td>${esc(c.label)}</td>
        <td class="center">${n(c.aplic)}</td>
        <td class="center">${n(c.comp)}</td>
        <td class="center">${c.pct === null ? 'N/A' : c.pct + '%'}</td>
      </tr>`).join('') : emptyRow(4, 'Sin datos de certificaciones.');
    return rows.length ? { capPct: pctGlobal, empleados } : null;
  }

  // ── Resumen y alertas ──────────────────────────────────
  // Antes habia que leer los 8 paneles para saber como venia el asesor.
  // El resumen trae los titulares con su semaforo y las alertas listan
  // solo lo que necesita atencion (si no hay nada, se dice explicito).
  function renderResumen(S) {
    const tiles = [];
    if (S.d1) tiles.push(rkTile(n(S.d1.vacantes), 'Vacantes', toneByCount(S.d1.vacantes, 5),
      S.d1.tiendasConVacante ? `en ${plural(S.d1.tiendasConVacante, 'tienda', 'tiendas')}` : ''));
    if (S.d2) tiles.push(rkTile(n(S.d2.bajas), 'Bajas del mes', toneByCount(S.d2.bajas, 5)));
    if (S.d3) tiles.push(rkTile(S.d3.ec + '%', 'Equipo completo', tonePct(S.d3.ec, 80, 50),
      S.d3.ecSin !== null && S.d3.ecSin !== undefined ? `sin ausentismo: ${S.d3.ecSin}%` : ''));
    if (S.d4) tiles.push(rkTile(n(S.d4.horas), 'Horas extra', toneByCount(S.d4.horas, 40), S.d4.gasto ? '$' + n(S.d4.gasto) : ''));
    if (S.d6) tiles.push(rkTile(n(S.d6.diasAus), 'Días ausentismo', toneByCount(S.d6.diasAus, 40),
      S.d6.ausentes ? `${S.d6.ausentes} empleados` : ''));
    if (S.d5) tiles.push(rkTile(n(S.d5.vencidos), 'Vacaciones vencidas', toneByCount(S.d5.vencidos, 3),
      S.d5.colaboradores ? 'de ' + S.d5.colaboradores : ''));
    if (S.d7) tiles.push(rkTile(S.d7.cobertura + '%', 'Cobertura TREO', tonePct(S.d7.cobertura, 98, 90),
      `${S.d7.tiendas} tiendas`));
    if (S.d8) tiles.push(rkTile(S.d8.capPct + '%', 'Capacidades', tonePct(S.d8.capPct, 90, 60)));
    document.getElementById('ficha-resumen').innerHTML = tiles.join('');
  }
  function renderAlertas(S) {
    const a = [];
    if (S.d1 && S.d1.vacantes) a.push({ t: S.d1.vacantes >= 5 ? 'is-bad' : 'is-warn', txt: `${S.d1.vacantes} vacante${S.d1.vacantes > 1 ? 's' : ''} por cubrir` });
    if (S.d2 && S.d2.bajas) a.push({ t: S.d2.bajas >= 5 ? 'is-bad' : 'is-warn', txt: `${S.d2.bajas} baja${S.d2.bajas > 1 ? 's' : ''} este mes${S.d2.motivo ? ' · ' + OXXO.truncate(S.d2.motivo, 24) : ''}` });
    if (S.d3 && S.d3.criticas) a.push({ t: 'is-bad', txt: `${S.d3.criticas} tienda${S.d3.criticas > 1 ? 's' : ''} en estructura crítica` });
    if (S.d3 && S.d3.incompletas) a.push({ t: 'is-warn', txt: `${S.d3.incompletas} con equipo incompleto` });
    if (S.d4 && S.d4.gasto) a.push({ t: S.d4.horas >= 40 ? 'is-bad' : 'is-warn', txt: `$${n(S.d4.gasto)} en tiempo extra (${n(S.d4.horas)} h)` });
    if (S.d6 && S.d6.faltas) a.push({ t: 'is-bad', txt: `${S.d6.faltas} falta${S.d6.faltas > 1 ? 's' : ''} registrada${S.d6.faltas > 1 ? 's' : ''}` });
    if (S.d5 && S.d5.vencidos) a.push({ t: 'is-warn', txt: `${S.d5.vencidos} con vacaciones ya vencidas` });
    if (S.d7 && (S.d7.subir || S.d7.bajar)) {
      const partes = [];
      if (S.d7.subir) partes.push(`subir en ${S.d7.subir}`);
      if (S.d7.bajar) partes.push(`bajar en ${S.d7.bajar}`);
      a.push({ t: 'is-info', txt: `TREO: ${partes.join(' y ')}` });
    }
    if (S.d8 && S.d8.capPct < 100) a.push({ t: S.d8.capPct < 60 ? 'is-bad' : 'is-warn', txt: `Capacidades al ${S.d8.capPct}%` });
    document.getElementById('ficha-alertas').innerHTML = chipsHTML(a, 'Sin alertas: tus tiendas están en orden');
  }
  function renderIdentidad(asesor, S) {
    document.getElementById('ficha-asesor-title').textContent = asesor;
    document.getElementById('ficha-meta').innerHTML = metaHTML([
      ['Tiendas', S.d7 && S.d7.tiendas ? String(S.d7.tiendas) : (S.d3 && S.d3.tiendas ? String(S.d3.tiendas) : '')],
      ['Colaboradores', S.d5 && S.d5.colaboradores ? String(S.d5.colaboradores) : ''],
      ['Estructura SAP', S.d7 && S.d7.sap ? String(S.d7.sap) : ''],
      ['Activos', S.d7 && S.d7.activos ? String(S.d7.activos) : ''],
    ]);
    const st = document.getElementById('ficha-status');
    if (S.d7) {
      const pend = S.d7.subir + S.d7.bajar;
      st.textContent = pend === 0
        ? '✔ Estructura alineada'
        : `${S.d7.alineadas} de ${S.d7.tiendas} alineadas`;
    } else {
      st.textContent = 'Ficha del asesor';
    }
  }

  // ── Orquestacion ───────────────────────────────────────
  function renderFor(asesor) {
    if (!asesor) return;
    document.getElementById('mi-empty').style.display = 'none';
    document.getElementById('mi-content').style.display = 'block';
    const S = {
      d1: renderD1(asesor), d2: renderD2(asesor), d3: renderD3(asesor), d4: renderD4(asesor),
      d5: renderD5(asesor), d6: renderD6(asesor), d7: renderD7(asesor), d8: renderD8(asesor),
    };
    renderIdentidad(asesor, S);
    renderResumen(S);
    renderAlertas(S);
  }

  async function init() {
    CATALOG = await OXXO.loadAsesorCatalog();
    await Promise.all([loadD1(), loadD2(), loadD3(), loadD4(), loadD5(), loadD6(), loadD7(), loadD8()]);
    document.getElementById('corte-badge').textContent = '⟳ Datos en vivo · Plaza Oaxaca';
    mountSingleSelect('mi-asesor-select', [...ASESORES], {
      placeholder: 'Selecciona tu nombre',
      searchId: 'mi-asesor-search',
      searchPlaceholder: 'Buscar tu nombre...',
      onChange: renderFor,
    });
    OXXO.updateFooterTime('load-time');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
