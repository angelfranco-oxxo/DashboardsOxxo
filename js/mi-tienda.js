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

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // ── Combobox de una sola tienda (busca + selecciona una) ──────
  function mountSingleTiendaSelect(rootId, values, { onChange, placeholder } = {}) {
    const root = document.getElementById(rootId);
    if (!root) return null;
    const allValues = [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b), 'es'));
    let selected = '';
    const ph = placeholder || 'Busca tu tienda';

    root.innerHTML = `
      <div class="smart-filter" id="${rootId}-filter">
        <button class="smart-filter__button" type="button" id="${rootId}-button">
          <span class="smart-filter__label" id="${rootId}-label">${esc(ph)}</span>
          <span class="smart-filter__chev">▾</span>
        </button>
        <div class="smart-filter__menu" id="${rootId}-menu">
          <input class="smart-filter__search" id="mi-tienda-search" type="search" placeholder="Buscar tienda..." autocomplete="off">
          <div class="smart-filter__list" id="${rootId}-options"></div>
        </div>
      </div>`;

    const wrap = document.getElementById(`${rootId}-filter`);
    const label = document.getElementById(`${rootId}-label`);
    const button = document.getElementById(`${rootId}-button`);
    const search = document.getElementById('mi-tienda-search');
    const list = document.getElementById(`${rootId}-options`);

    function renderOptions(query = '') {
      const q = String(query || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const filtered = allValues.filter((v) => !q || String(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(q));
      list.innerHTML = filtered.length
        ? filtered.map((v) => `<button type="button" class="smart-filter__option ${v === selected ? 'is-active' : ''}" data-value="${esc(v)}">
            <span class="smart-filter__check"></span><span>${esc(v)}</span>
          </button>`).join('')
        : '<div class="smart-filter__empty">Sin resultados</div>';
    }

    list.addEventListener('click', (e) => {
      const btn = e.target.closest('.smart-filter__option');
      if (!btn) return;
      selected = btn.dataset.value;
      label.textContent = selected;
      wrap.classList.remove('open');
      renderOptions(search.value);
      if (typeof onChange === 'function') onChange(selected);
    });
    search.addEventListener('input', () => renderOptions(search.value));
    button.addEventListener('click', () => {
      const opening = !wrap.classList.contains('open');
      wrap.classList.toggle('open', opening);
      if (opening) { search.value = ''; renderOptions(); search.focus(); }
    });
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) wrap.classList.remove('open'); });

    renderOptions();
    return {
      get value() { return selected; },
      setValue(v) { selected = v || ''; label.textContent = selected || ph; renderOptions(); },
    };
  }

  // ── Utilidades compartidas ────────────────────────────
  const V = (row, key) => OXXO.metricsVal(row, key);
  const K = (row, aliases) => OXXO.metricsFindKey(row, aliases);
  const n = (v) => OXXO.formatNum(Math.round(Number(v) || 0));
  const tKey = (v) => OXXO.normalizeCatalogTienda(v);
  function statTile(value, label, cls) {
    return `<div class="mi-stat ${cls || ''}"><b>${value}</b><span>${esc(label)}</span></div>`;
  }
  function emptyRow(colspan, msg) {
    return `<tr><td colspan="${colspan}"><div class="mi-empty-mini">${esc(msg || 'Sin registros con tu tienda en este periodo.')}</div></td></tr>`;
  }
  // Cuando un panel no tiene registros hay dos lecturas distintas que antes
  // se veian igual (una reja de ceros): "no hay nada que atender" (bueno) y
  // "esta tienda no aparece en esa base" (sin dato). Se separan.
  function clearBox(msg) { return `<div class="mt-clear">✓ ${esc(msg)}</div>`; }
  function noneBox(msg) { return `<div class="mt-none">— ${esc(msg)}</div>`; }
  const plural = (count, sing, plur) => `${count} ${count === 1 ? sing : plur}`;

  // ── Medidor semicircular reutilizable para cualquier % 0-100 ──
  // Sin aguja: a este tamano (120px) la aguja cruzaba por encima del
  // numero y del arco y ensuciaba la lectura, sobre todo en valores
  // bajos. Se sustituye por un punto al final del arco, que marca el
  // avance igual pero no se encima con nada.
  let gaugeSeq = 0;
  function gaugeTone(v, meta) {
    return meta != null
      ? (v >= meta ? 'verde' : v >= meta - 10 ? 'amarillo' : 'rojo')
      : (v >= 80 ? 'verde' : v >= 50 ? 'amarillo' : 'rojo');
  }
  function gaugeSVG(value, meta) {
    const v = Math.max(0, Math.min(100, Number(value) || 0));
    const color = gaugeTone(v, meta);
    const c = color === 'verde' ? { main: '#3ECF6D', dark: '#12813F', txt: '#12813F' }
      : color === 'amarillo' ? { main: '#F2A52B', dark: '#B87400', txt: '#9A6A00' }
      : { main: '#E85A60', dark: '#C0181F', txt: '#C0181F' };
    const cx = 100, cy = 100, r = 74, sw = 16, len = Math.PI * r;
    const dash = (len * v / 100).toFixed(1);
    const ang = Math.PI * (1 - v / 100);
    const px = (cx + r * Math.cos(ang)).toFixed(1), py = (cy - r * Math.sin(ang)).toFixed(1);
    const gid = 'mtg' + (gaugeSeq++);
    let metaLine = '';
    if (meta != null) {
      const ma = Math.PI * (1 - meta / 100);
      const m1x = (cx + (r - sw / 2 - 1) * Math.cos(ma)).toFixed(1), m1y = (cy - (r - sw / 2 - 1) * Math.sin(ma)).toFixed(1);
      const m2x = (cx + (r + sw / 2 + 3) * Math.cos(ma)).toFixed(1), m2y = (cy - (r + sw / 2 + 3) * Math.sin(ma)).toFixed(1);
      metaLine = `<line x1="${m1x}" y1="${m1y}" x2="${m2x}" y2="${m2y}" stroke="#3B1918" stroke-width="2" opacity=".45"/>`;
    }
    return `<svg viewBox="0 0 200 112" class="mi-gauge">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c.main}"/><stop offset="1" stop-color="${c.dark}"/></linearGradient></defs>
      <path d="M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}" fill="none" stroke="rgba(130,54,38,.11)" stroke-width="${sw}" stroke-linecap="round"/>
      <path d="M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}" fill="none" stroke="url(#${gid})" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${dash} ${len.toFixed(1)}"/>
      ${metaLine}
      <circle cx="${px}" cy="${py}" r="5.5" fill="#fff" stroke="${c.dark}" stroke-width="3"/>
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="mi-gauge__text" style="fill:${c.txt}">${v.toFixed(0)}<tspan style="font-size:18px" dy="-2">%</tspan></text>
    </svg>`;
  }
  // Envuelve un medidor + tiles de detalle en una sola fila (usado por
  // Aprovechamiento y Capacidades). label va debajo del medidor.
  function gaugeRowHTML(value, meta, label, tilesHtml) {
    return `<div class="mi-gauge-row">
      <div class="mi-gauge-wrap">
        ${gaugeSVG(value, meta)}
        <div class="mi-gauge__cap">${esc(label)}</div>
      </div>
      <div class="mi-stats">${tilesHtml}</div>
    </div>`;
  }
  // ── Barras horizontales para desgloses (motivos, puestos, tipos...) ──
  function barListHTML(items, colorClass) {
    const filtered = items.filter((it) => it.value > 0).sort((a, b) => b.value - a.value).slice(0, 4);
    if (!filtered.length) return '';
    const max = Math.max(...filtered.map((it) => it.value));
    return `<div class="mi-barlist">${filtered.map((it) => `
      <div class="mi-barlist__row">
        <span class="mi-barlist__label" title="${esc(it.label)}">${esc(it.label)}</span>
        <div class="mi-barlist__track"><div class="mi-barlist__fill ${colorClass || ''}" style="width:${max ? Math.max(4, Math.round(it.value / max * 100)) : 0}%"></div></div>
        <span class="mi-barlist__value">${typeof it.display === 'string' ? esc(it.display) : n(it.value)}</span>
      </div>`).join('')}</div>`;
  }

  // ── Estado global (se carga una sola vez) ─────────────
  let CATALOG = null;
  const TIENDAS = new Map(); // normKey -> nombre a mostrar (canonico del catalogo si existe, si no el nombre crudo)
  const DATA = {};

  function addTiendas(rows, tiendaKey) {
    if (!tiendaKey) return;
    rows.forEach((r) => {
      const raw = String(V(r, tiendaKey) || '').trim();
      if (!raw) return;
      const key = tKey(raw);
      if (!key || TIENDAS.has(key)) return;
      const canon = CATALOG?.byTienda?.get(key)?.tienda;
      TIENDAS.set(key, canon || raw);
    });
  }

  // ── D1 · Vacantes Diarias (mismo pipeline que dashboard-1.html) ──
  async function loadD1() {
    const d1 = await OXXO.metricsD1Rows();
    if (!d1) { DATA.d1 = null; return; }
    const diasKey = d1.rows[0] ? K(d1.rows[0], ['Dias Vacantes', 'Dias_Vacantes']) : null;
    const fechaKey = d1.rows[0] ? K(d1.rows[0], ['Fecha']) : null;
    DATA.d1 = { ...d1, diasKey, fechaKey };
    addTiendas(d1.rows, d1.tiendaKey);
  }
  function renderD1(tienda) {
    const d = DATA.d1;
    const el = document.getElementById('sec-d1');
    if (!d) { el.classList.remove('show'); return null; }
    const rows = d.rows.filter((r) => tKey(V(r, d.tiendaKey)) === tienda);
    el.classList.add('show');
    document.getElementById('badge-d1').textContent = OXXO.metricsMesKeyFromDate ? (d.mes || '—') : '—';
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
    const tbody = document.querySelector('#tbl-d1 tbody');
    tbody.innerHTML = rows.length ? rows.slice(0, 200).map((r) => `<tr>
        <td>${esc(V(r, d.puestoKey) || '—')}</td>
        <td class="center">${d.diasKey ? esc(OXXO.metricsDiasVacantesValue(V(r, d.diasKey))) : '—'}</td>
        <td>${esc(d.fechaKey ? V(r, d.fechaKey) || '—' : '—')}</td>
      </tr>`).join('') : emptyRow(3, 'Sin vacantes activas en el mes vigente. 🎉');
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
    const { mes, rows } = OXXO.metricsFilterLatestMonth(base, (r) => OXXO.metricsRowMonthKeyD2(r, mesKey, fechaKey));
    DATA.d2 = { rows, mes, asesorKey, tiendaKey, puestoKey, motivoKey, detalleKey, fechaKey };
    addTiendas(rows, tiendaKey);
  }
  function renderD2(tienda) {
    const d = DATA.d2;
    const el = document.getElementById('sec-d2');
    if (!d) { el.classList.remove('show'); return null; }
    const rows = d.rows.filter((r) => tKey(V(r, d.tiendaKey)) === tienda);
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
        <td>${esc(V(r, d.puestoKey) || '—')}</td>
        <td>${esc(OXXO.truncate(String(V(r, d.detalleKey) || V(r, d.motivoKey) || '—'), 26))}</td>
        <td>${esc(V(r, d.fechaKey) || '—')}</td>
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
    const semanaKey = K(h, ['Mes Semana', 'Semana', 'Fecha', 'FECHA']);
    raw.forEach((r) => { r[asesorKey] = OXXO.resolveAsesorD1(CATALOG, { cr: V(r, crKey), tienda: V(r, tiendaKey), asesor: V(r, asesorKey) }); });
    const semanas = [...new Set(raw.map((r) => String(V(r, semanaKey) || '').trim()).filter(Boolean))].sort();
    const semana = semanas[semanas.length - 1] || '';
    const rows = semana ? raw.filter((r) => String(V(r, semanaKey) || '').trim() === semana) : raw;
    DATA.d3 = { rows, semana, asesorKey, tiendaKey, estatusKey };
    addTiendas(rows, tiendaKey);
  }
  function renderD3(tienda) {
    const d = DATA.d3;
    const el = document.getElementById('sec-d3');
    if (!d) { el.classList.remove('show'); return null; }
    const rows = d.rows.filter((r) => tKey(V(r, d.tiendaKey)) === tienda);
    el.classList.add('show');
    document.getElementById('badge-d3').textContent = d.semana || '—';
    let completas = 0, incompletas = 0, criticas = 0;
    rows.forEach((r) => {
      const c = OXXO.metricsClasificaAprovechamiento(V(r, d.estatusKey));
      if (c === 'completas') completas++; else if (c === 'incompletas') incompletas++; else if (c === 'criticas') criticas++;
    });
    const ec = rows.length ? Math.round((completas / rows.length) * 100) : 0;
    document.getElementById('stats-d3').innerHTML = '';
    document.getElementById('viz-d3').innerHTML = rows.length ? gaugeRowHTML(ec, null, 'EC · Equipo Completo',
      statTile(n(completas), 'Completas', 'verde') +
      statTile(n(incompletas), 'Incompletas', 'amarillo') +
      statTile(n(criticas), 'Críticas', 'rojo')
    ) : noneBox('Tu tienda no aparece en la semana vigente');
    const tbody = document.querySelector('#tbl-d3 tbody');
    tbody.innerHTML = rows.length ? rows.slice(0, 200).map((r) => `<tr>
        <td>${esc(V(r, d.asesorKey) || '—')}</td>
        <td>${esc(V(r, d.estatusKey) || '—')}</td>
      </tr>`).join('') : emptyRow(2, 'Sin datos de estructura para tu tienda en la semana vigente.');
    return rows.length ? { ec, completas, incompletas, criticas } : null;
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
    const horasKey = K(h, ['Cantidad']);
    const importeKey = K(h, ['Importe']);
    raw.forEach((r) => OXXO.applyAsesorCatalog(r, CATALOG, { asesorKey, tiendaKey, crKey }));
    const semanas = [...new Set(raw.map((r) => String(V(r, semanaKey) || '').trim()).filter(Boolean))];
    semanas.sort((a, b) => semanaRank(b) - semanaRank(a));
    const semana = semanas[0] || '';
    const rows = semana ? raw.filter((r) => String(V(r, semanaKey) || '').trim() === semana) : raw;
    DATA.d4 = { rows, semana, asesorKey, tiendaKey, nombreKey, horasKey, importeKey };
    addTiendas(rows, tiendaKey);
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
    const rows = d.rows.filter((r) => tKey(V(r, d.tiendaKey)) === tienda);
    el.classList.add('show');
    document.getElementById('badge-d4').textContent = d.semana ? (/sem/i.test(d.semana) ? d.semana : 'Sem ' + d.semana) : '—';
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
    const sorted = [...rows].sort((a, b) => numParse(V(b, d.importeKey)) - numParse(V(a, d.importeKey)));
    const tbody = document.querySelector('#tbl-d4 tbody');
    tbody.innerHTML = sorted.length ? sorted.slice(0, 200).map((r) => `<tr>
        <td>${esc(OXXO.truncate(String(V(r, d.nombreKey) || '—'), 30))}</td>
        <td class="center">${n(numParse(V(r, d.horasKey)))}</td>
        <td class="center">$${n(numParse(V(r, d.importeKey)))}</td>
      </tr>`).join('') : emptyRow(3, 'Sin tiempo extra en la semana vigente. 🎉');
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
    raw.forEach((r) => { r[asesorKey] = OXXO.resolveAsesorD1(CATALOG, { asesor: V(r, asesorKey), tienda: V(r, tiendaKey) }); });
    DATA.d5 = { rows: raw, asesorKey, tiendaKey, nombreKey, diasRestKey, bucketKey };
    addTiendas(raw, tiendaKey);
  }
  function renderD5(tienda) {
    const d = DATA.d5;
    const el = document.getElementById('sec-d5');
    if (!d) { el.classList.remove('show'); return null; }
    const rows = d.rows.filter((r) => tKey(V(r, d.tiendaKey)) === tienda);
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
        <td class="center">${esc(V(r, d.diasRestKey) || '0')}</td>
        <td>${esc(V(r, d.bucketKey) || '—')}</td>
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
    addTiendas(raw, tiendaKey);
  }
  function renderD6(tienda) {
    const d = DATA.d6;
    const el = document.getElementById('sec-d6');
    if (!d) { el.classList.remove('show'); return null; }
    const rows = d.rows.filter((r) => tKey(V(r, d.tiendaKey)) === tienda);
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
        <td>${esc(OXXO.truncate(String(V(r, d.nombreKey) || '—'), 26))}</td>
        <td>${esc(V(r, d.tipoKey) || '—')}</td>
        <td class="center">${esc(V(r, d.diasKey) || '—')}</td>
      </tr>`).join('') : emptyRow(3, 'Sin ausentismos registrados. 🎉');
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
    addTiendas(d7.rows, d7.tiendaKey);
  }
  function movInfo(dif) {
    if (dif === 0) return { cls: 'alineada', arrow: '✔', txt: 'Alineada' };
    return dif > 0 ? { cls: 'subir', arrow: '↑', txt: 'Subir' } : { cls: 'bajar', arrow: '↓', txt: 'Bajar' };
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
    const rows = d.rows.filter((r) => tKey(V(r, d.tiendaKey)) === tienda);
    el.classList.add('show');
    document.getElementById('badge-d7').textContent = plural(rows.length, 'registro', 'registros');
    const fichaEl = document.getElementById('ficha-d7');
    const statsEl = document.getElementById('stats-d7');
    const detailEl = document.querySelector('#tbl-d7').closest('.mi-detail');
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
      detailEl.open = false;
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
    DATA.d8 = { rows: raw, asesorKey, unidadKey, noPersKey, empleadoKey, certRealKeys };
    addTiendas(raw, unidadKey);
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
    const rows = d.rows.filter((r) => tKey(V(r, d.unidadKey)) === tienda);
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

  // ── Resumen y alertas ──────────────────────────────────
  // Antes habia que leer los 8 paneles para saber si la tienda estaba
  // bien o mal. Estos dos bloques responden eso de una: el resumen trae
  // los titulares de cada dashboard con su semaforo, y las alertas solo
  // listan lo que necesita atencion (si no hay nada, se dice explicito).
  function rkTile(value, label, tone, hint) {
    return `<div class="rk ${tone || ''}">
      <b>${value}</b><span>${esc(label)}</span>${hint ? `<i>${esc(hint)}</i>` : ''}
    </div>`;
  }
  function toneByCount(count, warnAt) {
    if (!count) return 'is-ok';
    return count >= (warnAt || 3) ? 'is-bad' : 'is-warn';
  }
  function tonePct(pct, okAt, warnAt) {
    if (pct >= okAt) return 'is-ok';
    return pct >= warnAt ? 'is-warn' : 'is-bad';
  }
  function renderResumen(S) {
    const tiles = [];
    if (S.d1) tiles.push(rkTile(n(S.d1.vacantes), 'Vacantes', toneByCount(S.d1.vacantes)));
    if (S.d2) tiles.push(rkTile(n(S.d2.bajas), 'Bajas del mes', toneByCount(S.d2.bajas)));
    if (S.d3) tiles.push(rkTile(S.d3.ec + '%', 'Equipo completo', tonePct(S.d3.ec, 80, 50)));
    if (S.d4) tiles.push(rkTile(n(S.d4.horas), 'Horas extra', toneByCount(S.d4.horas, 20), S.d4.gasto ? '$' + n(S.d4.gasto) : ''));
    if (S.d6) tiles.push(rkTile(n(S.d6.diasAus), 'Días ausentismo', toneByCount(S.d6.diasAus, 20), S.d6.ausentes ? S.d6.ausentes + ' empleados' : ''));
    if (S.d5) tiles.push(rkTile(n(S.d5.vencidos), 'Vacaciones vencidas', toneByCount(S.d5.vencidos, 2), S.d5.colaboradores ? 'de ' + S.d5.colaboradores : ''));
    if (S.d8) tiles.push(rkTile(S.d8.capPct + '%', 'Capacidades', tonePct(S.d8.capPct, 90, 60)));
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
    const el = document.getElementById('ficha-alertas');
    el.innerHTML = a.length
      ? a.map((x) => `<span class="chip ${x.t}">${esc(x.txt)}</span>`).join('')
      : '<span class="chip is-ok">✓ Sin alertas: tu tienda está en orden</span>';
  }
  function renderIdentidad(tiendaDisplay, S) {
    document.getElementById('ficha-tienda-title').textContent = tiendaDisplay;
    const d7 = S.d7 || {};
    const meta = [
      ['Asesor / AT', d7.asesor],
      ['CR', d7.cr],
      ['Turnos', d7.turnos],
      ['Antigüedad', d7.antiguedad],
      ['Colaboradores', S.d5 && S.d5.colaboradores ? String(S.d5.colaboradores) : ''],
    ].filter(([, v]) => String(v || '').trim() !== '');
    document.getElementById('ficha-meta').innerHTML = meta
      .map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
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
    };
    renderIdentidad(tiendaDisplay, S);
    renderResumen(S);
    renderAlertas(S);
  }

  async function init() {
    CATALOG = await OXXO.loadAsesorCatalog();
    await Promise.all([loadD1(), loadD2(), loadD3(), loadD4(), loadD5(), loadD6(), loadD7(), loadD8()]);
    document.getElementById('corte-badge').textContent = '⟳ Datos en vivo · Plaza Oaxaca';
    mountSingleTiendaSelect('mi-tienda-select', [...TIENDAS.values()], {
      placeholder: 'Busca tu tienda',
      onChange: renderFor,
    });
    OXXO.updateFooterTime('load-time');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
