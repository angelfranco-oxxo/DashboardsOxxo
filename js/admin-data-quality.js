/* ==========================================================
   PANEL ADMIN · CALIDAD DE DATOS
   Diagnostico de solo lectura sobre las fuentes publicadas.
   ========================================================== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const norm = (value) => String(OXXO.fixMojibake ? OXXO.fixMojibake(value || '') : value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();
  const tabs = () => OXXO.SHEETS_CONFIG.TABS;
  const sources = () => [
    { area: 'RH', name: 'Vacantes Diarias', tab: tabs().d1, required: [['tienda'], ['puesto', 'tipo puesto', 'posicion']], dates: ['Fecha', 'Mes'] },
    { area: 'RH', name: 'Bajas Diarias', tab: tabs().d2, required: [['tienda'], ['asesor'], ['fecha', 'mes']], dates: ['Fecha', 'F.Crea', 'Mes'] },
    { area: 'RH', name: 'Aprovechamiento', tab: tabs().d3, required: [['tienda'], ['asesor'], ['aprovechamiento estructura']], dates: ['FECHA', 'Fecha'] },
    { area: 'RH', name: 'Tiempo Extra', tab: tabs().s4, required: [['texto breve de unidad organizativa'], ['cantidad'], ['importe']], monthParts: true },
    { area: 'RH', name: 'Vacaciones', tab: tabs().s5, required: [['tienda'], ['nombre'], ['dias restantes']] },
    { area: 'RH', name: 'Ausentismos', tab: tabs().s6, required: [['tienda'], ['denominacion'], ['dias']], monthParts: true },
    { area: 'RH', name: 'TREO', tab: tabs().s7, required: [['tienda'], ['asesor'], ['estructura sap']] },
    { area: 'RH', name: 'Capacidades', tab: tabs().d8, required: [['unidad org'], ['empleados'], ['asesor correcto', 'asesor']] },
    { area: 'RH', name: 'Personal FLEX', tab: tabs().d10, required: [['tienda'], ['asesor'], ['fecha']], dates: ['Fecha'] },
    { area: 'RH', name: 'Registro y Apego', tab: tabs().d11, required: [['tienda'], ['asesor'], ['fecha']], dates: ['Fecha'] },
    { area: 'Administrativo', name: 'Faltantes y Sobrantes', tab: tabs().s9, required: [['cr'], ['fecha'], ['importe']], dates: ['Fecha'] },
    { area: 'Administrativo', name: 'Inventarios', tab: tabs().inventories, required: [['cr'], ['tienda'], ['fecha de inventario']], dates: ['Fecha de Inventario', 'Periodo'] },
    { area: 'Comercial', name: 'PromosD100', tab: tabs().promos, required: [['titulo', 'promocion'], ['imagen', 'imagen url', 'url']], dates: ['Fecha fin', 'Fin', 'Vigencia hasta'] },
  ].filter((source) => source.tab);

  function headerMap(row) {
    const map = new Map();
    Object.keys(row || {}).forEach((key) => map.set(norm(key), key));
    return map;
  }
  function findHeader(map, aliases) {
    const normalized = aliases.map(norm);
    for (const [key, original] of map) {
      if (normalized.some((alias) => key === alias || key.includes(alias))) return original;
    }
    return '';
  }
  function parseDate(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    const iso = text.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?/);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3] || 1));
    const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (dmy) return new Date(Number(dmy[3]) < 100 ? 2000 + Number(dmy[3]) : Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const es = norm(text).match(/(\d{1,2}) de ([a-z]+) de (\d{4})/);
    if (es && months.includes(es[2])) return new Date(Number(es[3]), months.indexOf(es[2]), Number(es[1]));
    const monthKey = OXXO.metricsNormalizeMonthKey ? OXXO.metricsNormalizeMonthKey(text) : '';
    if (monthKey) {
      const parts = monthKey.split('-');
      return new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    }
    const native = new Date(text);
    return Number.isNaN(native.getTime()) ? null : native;
  }
  function latestDate(rows, source, map) {
    const candidates = [];
    (source.dates || []).forEach((alias) => {
      const key = findHeader(map, [alias]);
      if (key) rows.forEach((row) => { const date = parseDate(row[key]); if (date && !Number.isNaN(date.getTime())) candidates.push(date); });
    });
    if (source.monthParts) {
      const mesKey = findHeader(map, ['Mes']);
      const anoKey = findHeader(map, ['Ano', 'Año']);
      if (mesKey && anoKey) rows.forEach((row) => {
        const month = String(row[mesKey] || '').match(/(\d{1,2})/);
        const year = String(row[anoKey] || '').match(/(\d{4})/);
        if (month && year) candidates.push(new Date(Number(year[1]), Number(month[1]) - 1, 1));
      });
    }
    return candidates.sort((a, b) => b - a)[0] || null;
  }
  function dateLabel(date) {
    return date ? date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No informado';
  }
  async function inspect(source) {
    const rows = await OXXO.fetchSheetData(source.tab, { fresh: true, allowStale: false });
    if (!Array.isArray(rows)) return { ...source, status: 'bad', rows: 0, cut: null, note: 'La fuente no respondió.' };
    if (!rows.length) return { ...source, status: 'bad', rows: 0, cut: null, note: 'La pestaña está vacía.' };
    const map = headerMap(rows[0]);
    const missing = source.required.filter((group) => !findHeader(map, group)).map((group) => group[0]);
    const cut = latestDate(rows, source, map);
    const age = cut ? Math.floor((Date.now() - cut.getTime()) / 86400000) : null;
    let status = missing.length ? 'bad' : (!cut ? 'warn' : age < -7 ? 'warn' : age > 45 ? 'bad' : age > 14 ? 'warn' : 'ok');
    let note = missing.length ? `Faltan encabezados: ${missing.join(', ')}.` : !cut ? 'La fuente no incluye un corte identificable.' : age < -7 ? 'El corte más reciente parece estar fechado en el futuro.' : age > 45 ? `Corte atrasado por ${age} días.` : age > 14 ? `Revisar vigencia: ${age} días desde el corte.` : 'Encabezados y vigencia correctos.';
    return { ...source, status, rows: rows.length, cut, note };
  }
  function render(results) {
    const count = (status) => results.filter((result) => result.status === status).length;
    $('quality-summary').innerHTML = `
      <div class="quality-kpi"><span>Fuentes</span><strong>${results.length}</strong></div>
      <div class="quality-kpi ok"><span>Correctas</span><strong>${count('ok')}</strong></div>
      <div class="quality-kpi warn"><span>Atención</span><strong>${count('warn')}</strong></div>
      <div class="quality-kpi bad"><span>Errores</span><strong>${count('bad')}</strong></div>`;
    $('quality-table-body').innerHTML = results.map((result) => `<tr>
      <td><span class="quality-source">${esc(result.name)}</span><small>${esc(result.area)} · ${esc(result.tab)}</small></td>
      <td><span class="quality-status ${result.status}">${result.status === 'ok' ? 'Correcta' : result.status === 'warn' ? 'Atención' : 'Error'}</span></td>
      <td>${result.rows.toLocaleString('es-MX')}</td><td>${esc(dateLabel(result.cut))}</td><td>${esc(result.note)}</td>
    </tr>`).join('');
    const issues = count('warn') + count('bad');
    $('quality-guidance').textContent = issues ? `${issues} fuente${issues > 1 ? 's requieren' : ' requiere'} revisión. Abre la base correspondiente antes de publicar una actualización.` : 'Todas las fuentes revisadas tienen estructura y vigencia correctas.';
  }
  async function run() {
    const button = $('quality-refresh-btn');
    if (!button || button.disabled) return;
    button.disabled = true;
    button.textContent = 'Revisando fuentes…';
    $('quality-table-body').innerHTML = '<tr><td colspan="5" class="quality-empty">Consultando Google Sheets…</td></tr>';
    try {
      const results = await Promise.all(sources().map(inspect));
      render(results);
    } catch (error) {
      console.error('Diagnóstico de calidad:', error);
      $('quality-guidance').textContent = 'No fue posible completar el diagnóstico. Revisa la conexión e inténtalo nuevamente.';
      $('quality-table-body').innerHTML = '<tr><td colspan="5" class="quality-empty">El diagnóstico no pudo completarse.</td></tr>';
    } finally {
      button.disabled = false;
      button.textContent = 'Actualizar diagnóstico';
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    $('quality-refresh-btn')?.addEventListener('click', run);
    document.querySelector('.admin-tab[data-tab="calidad"]')?.addEventListener('click', () => {
      if ($('quality-table-body')?.textContent.includes('Diagnóstico pendiente')) run();
    });
  });
})();
