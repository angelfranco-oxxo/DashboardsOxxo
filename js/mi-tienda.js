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

  // ── Medidor semicircular (mismo diseño que "Aprovechamiento por Plaza"
  // de dashboard-3.html) — reutilizable para cualquier % 0-100. ──
  let gaugeSeq = 0;
  function gaugeSVG(value, meta) {
    const v = Math.max(0, Math.min(100, Number(value) || 0));
    const color = meta != null
      ? (v >= meta ? 'verde' : v >= meta - 10 ? 'amarillo' : 'rojo')
      : (v >= 80 ? 'verde' : v >= 50 ? 'amarillo' : 'rojo');
    const c = color === 'verde' ? { main: '#1DB954', dark: '#15943f', txt: '#15803D' }
      : color === 'amarillo' ? { main: '#E8B004', dark: '#C68A00', txt: '#A87400' }
      : { main: '#EF4444', dark: '#C0181F', txt: '#C0181F' };
    const cx = 100, cy = 104, r = 76, sw = 15, len = Math.PI * r;
    const dash = (len * v / 100).toFixed(1);
    const ang = Math.PI * (1 - v / 100);
    const nx = (cx + (r - 6) * Math.cos(ang)).toFixed(1), ny = (cy - (r - 6) * Math.sin(ang)).toFixed(1);
    const gid = 'mtg' + (gaugeSeq++);
    let metaLine = '';
    if (meta != null) {
      const ma = Math.PI * (1 - meta / 100);
      const m1x = (cx + (r - sw / 2 - 1) * Math.cos(ma)).toFixed(1), m1y = (cy - (r - sw / 2 - 1) * Math.sin(ma)).toFixed(1);
      const m2x = (cx + (r + sw / 2 + 3) * Math.cos(ma)).toFixed(1), m2y = (cy - (r + sw / 2 + 3) * Math.sin(ma)).toFixed(1);
      metaLine = `<line x1="${m1x}" y1="${m1y}" x2="${m2x}" y2="${m2y}" stroke="#3B1918" stroke-width="2" opacity=".5"/>`;
    }
    return `<svg viewBox="0 0 200 128" class="mi-gauge">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c.main}"/><stop offset="1" stop-color="${c.dark}"/></linearGradient></defs>
      <path d="M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}" fill="none" stroke="#F2E6DE" stroke-width="${sw}" stroke-linecap="round"/>
      <path d="M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}" fill="none" stroke="url(#${gid})" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${dash} ${len.toFixed(1)}"/>
      ${metaLine}
      <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="#3B1918" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="7" fill="#fff" stroke="#3B1918" stroke-width="2.5"/>
      <text x="${cx}" y="92" text-anchor="middle" class="mi-gauge__text" style="fill:${c.txt}">${v.toFixed(0)}<tspan style="font-size:16px" dy="-1">%</tspan></text>
    </svg>`;
  }
  // Envuelve un medidor + tiles de detalle en una sola fila (usado por
  // Aprovechamiento y Capacidades). label va debajo del medidor.
  function gaugeRowHTML(value, meta, label, tilesHtml) {
    return `<div class="mi-gauge-row">
      <div class="mi-gauge-wrap">
        ${gaugeSVG(value, meta)}
        <div style="text-align:center;font-size:11px;font-weight:800;color:var(--color-gray);text-transform:uppercase;letter-spacing:.04em;margin-top:2px">${esc(label)}</div>
      </div>
      <div class="mi-stats">${tilesHtml}</div>
    </div>`;
  }
  // ── Barras horizontales para desgloses (motivos, puestos, tipos...) ──
  function barListHTML(items, colorClass) {
    const filtered = items.filter((it) => it.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);
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
    if (!d) { el.classList.remove('show'); return; }
    const rows = d.rows.filter((r) => tKey(V(r, d.tiendaKey)) === tienda);
    el.classList.add('show');
    document.getElementById('badge-d1').textContent = OXXO.metricsMesKeyFromDate ? (d.mes || '—') : '—';
    const byPuesto = { Lider: 0, Encargado: 0, Ayudante: 0, Otro: 0 };
    rows.forEach((r) => { byPuesto[OXXO.metricsTipoPuesto(V(r, d.puestoKey))]++; });
    document.getElementById('stats-d1').innerHTML =
      statTile(n(rows.length), 'Vacantes totales', 'rojo') +
      statTile(n(byPuesto.Lider), 'Líder') +
      statTile(n(byPuesto.Encargado), 'Encargado') +
      statTile(n(byPuesto.Ayudante), 'Ayudante');
    document.getElementById('viz-d1').innerHTML = barListHTML([
      { label: 'Líder', value: byPuesto.Lider },
      { label: 'Encargado', value: byPuesto.Encargado },
      { label: 'Ayudante', value: byPuesto.Ayudante },
      { label: 'Otro', value: byPuesto.Otro },
    ]);
    const tbody = document.querySelector('#tbl-d1 tbody');
    tbody.innerHTML = rows.length ? rows.slice(0, 200).map((r) => `<tr>
        <td>${esc(V(r, d.puestoKey) || '—')}</td>
        <td class="center">${d.diasKey ? esc(OXXO.metricsDiasVacantesValue(V(r, d.diasKey))) : '—'}</td>
        <td>${esc(d.fechaKey ? V(r, d.fechaKey) || '—' : '—')}</td>
      </tr>`).join('') : emptyRow(3, 'Sin vacantes activas en el mes vigente. 🎉');
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
    if (!d) { el.classList.remove('show'); return; }
    const rows = d.rows.filter((r) => tKey(V(r, d.tiendaKey)) === tienda);
    el.classList.add('show');
    document.getElementById('badge-d2').textContent = d.mes || '—';
    const porMotivo = {};
    rows.forEach((r) => { const m = V(r, d.detalleKey) || V(r, d.motivoKey) || 'Sin motivo'; porMotivo[m] = (porMotivo[m] || 0) + 1; });
    const topMotivo = Object.entries(porMotivo).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('stats-d2').innerHTML =
      statTile(n(rows.length), 'Bajas del mes', 'rojo') +
      statTile(topMotivo ? OXXO.truncate(topMotivo[0], 22) : '—', 'Motivo más frecuente', 'amarillo');
    document.getElementById('viz-d2').innerHTML = barListHTML(
      Object.entries(porMotivo).map(([label, value]) => ({ label: OXXO.truncate(label, 24), value }))
    );
    const tbody = document.querySelector('#tbl-d2 tbody');
    tbody.innerHTML = rows.length ? rows.slice(0, 200).map((r) => `<tr>
        <td>${esc(V(r, d.puestoKey) || '—')}</td>
        <td>${esc(OXXO.truncate(String(V(r, d.detalleKey) || V(r, d.motivoKey) || '—'), 26))}</td>
        <td>${esc(V(r, d.fechaKey) || '—')}</td>
      </tr>`).join('') : emptyRow(3, 'Sin bajas en el mes vigente. 🎉');
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
    if (!d) { el.classList.remove('show'); return; }
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
    ) : '';
    const tbody = document.querySelector('#tbl-d3 tbody');
    tbody.innerHTML = rows.length ? rows.slice(0, 200).map((r) => `<tr>
        <td>${esc(V(r, d.asesorKey) || '—')}</td>
        <td>${esc(V(r, d.estatusKey) || '—')}</td>
      </tr>`).join('') : emptyRow(2, 'Sin datos de estructura para tu tienda en la semana vigente.');
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
    if (!d) { el.classList.remove('show'); return; }
    const rows = d.rows.filter((r) => tKey(V(r, d.tiendaKey)) === tienda);
    el.classList.add('show');
    document.getElementById('badge-d4').textContent = d.semana ? (/sem/i.test(d.semana) ? d.semana : 'Sem ' + d.semana) : '—';
    const totHoras = rows.reduce((s, r) => s + numParse(V(r, d.horasKey)), 0);
    const totGasto = rows.reduce((s, r) => s + numParse(V(r, d.importeKey)), 0);
    document.getElementById('stats-d4').innerHTML =
      statTile(n(totHoras), 'Horas TE', 'rojo') +
      statTile('$' + n(totGasto), 'Gasto TE', 'naranja') +
      statTile(n(rows.length), 'Registros');
    const porEmpleado = {};
    rows.forEach((r) => { const nom = V(r, d.nombreKey) || 'Sin nombre'; porEmpleado[nom] = (porEmpleado[nom] || 0) + numParse(V(r, d.horasKey)); });
    document.getElementById('viz-d4').innerHTML = barListHTML(
      Object.entries(porEmpleado).map(([label, value]) => ({ label: OXXO.truncate(label, 24), value })), 'naranja'
    );
    const sorted = [...rows].sort((a, b) => numParse(V(b, d.importeKey)) - numParse(V(a, d.importeKey)));
    const tbody = document.querySelector('#tbl-d4 tbody');
    tbody.innerHTML = sorted.length ? sorted.slice(0, 200).map((r) => `<tr>
        <td>${esc(OXXO.truncate(String(V(r, d.nombreKey) || '—'), 30))}</td>
        <td class="center">${n(numParse(V(r, d.horasKey)))}</td>
        <td class="center">$${n(numParse(V(r, d.importeKey)))}</td>
      </tr>`).join('') : emptyRow(3, 'Sin tiempo extra en la semana vigente. 🎉');
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
    if (!d) { el.classList.remove('show'); return; }
    const rows = d.rows.filter((r) => tKey(V(r, d.tiendaKey)) === tienda);
    el.classList.add('show');
    document.getElementById('badge-d5').textContent = `${rows.length} colaboradores`;
    const totDias = rows.reduce((s, r) => s + (Number(V(r, d.diasRestKey)) || 0), 0);
    const vencidos = rows.filter((r) => OXXO.metricsNormText(V(r, d.bucketKey)).includes('VENCIERON')).length;
    const proximos = rows.filter((r) => { const b = OXXO.metricsNormText(V(r, d.bucketKey)); return b.includes('0 A 50') || b.includes('0A50'); }).length;
    document.getElementById('stats-d5').innerHTML =
      statTile(n(totDias), 'Días restantes', 'azul') +
      statTile(n(vencidos), 'Ya vencidos', vencidos > 0 ? 'rojo' : '') +
      statTile(n(proximos), 'Vencen 0-50 días', proximos > 0 ? 'amarillo' : '');
    document.getElementById('viz-d5').innerHTML = barListHTML([
      { label: 'Ya vencidos', value: vencidos },
      { label: 'Vencen 0-50 días', value: proximos },
      { label: 'Resto de colaboradores', value: Math.max(0, rows.length - vencidos - proximos) },
    ], 'azul');
    const tbody = document.querySelector('#tbl-d5 tbody');
    const sorted = [...rows].sort((a, b) => (Number(V(b, d.diasRestKey)) || 0) - (Number(V(a, d.diasRestKey)) || 0));
    tbody.innerHTML = sorted.length ? sorted.slice(0, 200).map((r) => `<tr>
        <td>${esc(OXXO.truncate(String(V(r, d.nombreKey) || '—'), 26))}</td>
        <td class="center">${esc(V(r, d.diasRestKey) || '0')}</td>
        <td>${esc(V(r, d.bucketKey) || '—')}</td>
      </tr>`).join('') : emptyRow(3, 'Sin colaboradores con saldo de vacaciones.');
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
    if (!d) { el.classList.remove('show'); return; }
    const rows = d.rows.filter((r) => tKey(V(r, d.tiendaKey)) === tienda);
    el.classList.add('show');
    document.getElementById('badge-d6').textContent = `${rows.length} registros`;
    const empleados = new Set(rows.map((r) => V(r, d.noPersKey) || V(r, d.nombreKey))).size;
    const totDias = rows.reduce((s, r) => s + (parseFloat(V(r, d.diasKey)) || 0), 0);
    const faltas = rows.filter((r) => OXXO.metricsNormText(V(r, d.tipoKey)).includes('FALTA')).length;
    document.getElementById('stats-d6').innerHTML =
      statTile(n(empleados), 'Empleados ausentes', 'rojo') +
      statTile(n(totDias), 'Días ausentes', 'naranja') +
      statTile(n(faltas), 'Faltas', faltas > 0 ? 'rojo' : '');
    const porTipo = {};
    rows.forEach((r) => { const tipo = V(r, d.tipoKey) || 'Sin tipo'; porTipo[tipo] = (porTipo[tipo] || 0) + (parseFloat(V(r, d.diasKey)) || 0); });
    document.getElementById('viz-d6').innerHTML = barListHTML(
      Object.entries(porTipo).map(([label, value]) => ({ label: OXXO.truncate(label, 24), value }))
    );
    const tbody = document.querySelector('#tbl-d6 tbody');
    tbody.innerHTML = rows.length ? rows.slice(0, 200).map((r) => `<tr>
        <td>${esc(OXXO.truncate(String(V(r, d.nombreKey) || '—'), 26))}</td>
        <td>${esc(V(r, d.tipoKey) || '—')}</td>
        <td class="center">${esc(V(r, d.diasKey) || '—')}</td>
      </tr>`).join('') : emptyRow(3, 'Sin ausentismos registrados. 🎉');
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
  function fichaRow(label, value) {
    if (value === undefined || value === null || String(value).trim() === '') return '';
    return `<div class="ficha-treo__row"><span>${esc(label)}</span><span>${esc(value)}</span></div>`;
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
          ${fichaRow('Asesor / AT', V(r, d.asesorKey))}
          ${fichaRow('CR', d.crKey ? V(r, d.crKey) : '')}
          ${fichaRow('Activos', d.activosKey ? V(r, d.activosKey) : '')}
          ${fichaRow('Vacantes', d.vacantesKey ? V(r, d.vacantesKey) : '')}
          ${fichaRow('Turnos', d.turnosKey ? V(r, d.turnosKey) : '')}
          ${fichaRow('Antigüedad', d.antiguedadKey ? V(r, d.antiguedadKey) : '')}
          ${fichaRow('Accionable sugerido', d.accionableKey ? V(r, d.accionableKey) : '')}
        </div>
      </div>
    </div>`;
  }
  function renderD7(tienda) {
    const d = DATA.d7;
    const el = document.getElementById('sec-d7');
    if (!d) { el.classList.remove('show'); return; }
    const rows = d.rows.filter((r) => tKey(V(r, d.tiendaKey)) === tienda);
    el.classList.add('show');
    document.getElementById('badge-d7').textContent = `${rows.length} registros`;
    const fichaEl = document.getElementById('ficha-d7');
    const statsEl = document.getElementById('stats-d7');
    const tblWrap = document.querySelector('#tbl-d7').closest('.tbl-wrap');
    // Caso normal: la tienda tiene exactamente un registro en TREO -> se
    // muestra la Ficha Tecnica en vez de la tabla generica (que tendria una
    // sola fila, poco util). Si hay 0 o mas de un registro (caso raro) se
    // conserva el comportamiento anterior de KPIs + tabla, sin romper nada.
    if (rows.length === 1) {
      fichaEl.innerHTML = renderFichaTreo(rows[0][d.tiendaKey] || tienda, d, rows[0]);
      fichaEl.style.display = '';
      statsEl.style.display = 'none';
      statsEl.innerHTML = '';
      tblWrap.style.display = 'none';
      document.querySelector('#tbl-d7 tbody').innerHTML = '';
      return;
    }
    fichaEl.style.display = 'none';
    fichaEl.innerHTML = '';
    statsEl.style.display = '';
    tblWrap.style.display = '';
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
    if (!d) { el.classList.remove('show'); return; }
    const rows = d.rows.filter((r) => tKey(V(r, d.unidadKey)) === tienda);
    el.classList.add('show');
    const empleados = new Set(rows.map((r) => V(r, d.noPersKey) || V(r, d.empleadoKey))).size;
    document.getElementById('badge-d8').textContent = `${empleados} empleados`;
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
    document.getElementById('viz-d8').innerHTML = rows.length ? gaugeRowHTML(pctGlobal, null, 'Cumplimiento global', statTile(n(empleados), 'Empleados')) + certBars : '';
    const tbody = document.querySelector('#tbl-d8 tbody');
    tbody.innerHTML = certStats.length ? certStats.map((c) => `<tr>
        <td>${esc(c.label)}</td>
        <td class="center">${n(c.aplic)}</td>
        <td class="center">${n(c.comp)}</td>
        <td class="center">${c.pct === null ? 'N/A' : c.pct + '%'}</td>
      </tr>`).join('') : emptyRow(4, 'Sin datos de certificaciones.');
  }

  // ── Orquestacion ───────────────────────────────────────
  function renderFor(tiendaDisplay) {
    if (!tiendaDisplay) return;
    const tienda = tKey(tiendaDisplay);
    document.getElementById('mi-empty').style.display = 'none';
    document.getElementById('mi-content').style.display = 'block';
    renderD1(tienda); renderD2(tienda); renderD3(tienda); renderD4(tienda);
    renderD5(tienda); renderD6(tienda); renderD7(tienda); renderD8(tienda);
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
