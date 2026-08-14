/* ==========================================================
   ADMIN · REASIGNACIONES
   Cuando un asesor deja la empresa (el caso "Anadelia" de este
   proyecto), sus tiendas quedan "Sin Asesor Asignado" en el
   catalogo hasta que se les asigne un AT nuevo. Antes, ese
   traspaso se resolvia editando codigo (una lista fija en
   core.js); esta pantalla lo vuelve una tarea de negocio: el
   admin agrega "esta tienda ahora la cubre Fulano" y se publica
   a la pestana Reasignaciones del Sheet, que resolveAsesorD1 lee
   en vivo (ver js/core.js, loadReasignaciones/lookupReasignacion).

   Si la pestana Reasignaciones todavia no existe en el Sheet, la
   carga inicial simplemente viene vacia (fetchSheetData ya maneja
   ese error sin tronar) -- el aviso de abajo se lo dice al admin.
   ========================================================== */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  let CATALOG = null;
  let ASESORES = [];
  let currentRows = []; // filas ya publicadas, precargadas al abrir la pestana

  function rowHTML(row) {
    row = row || { tienda: '', asesor: '', nota: '' };
    const opts = ['<option value="">Selecciona…</option>']
      .concat(ASESORES.map((a) => `<option value="${esc(a)}" ${a === row.asesor ? 'selected' : ''}>${esc(a)}</option>`))
      .join('');
    return `<tr class="reas-row">
      <td><input class="admin-input" type="text" list="reas-tiendas-list" data-field="tienda" placeholder="Nombre de la tienda" value="${esc(row.tienda)}" /></td>
      <td><select class="admin-input" data-field="asesor">${opts}</select></td>
      <td><input class="admin-input" type="text" data-field="nota" placeholder="ej. Fulano dejó la empresa" value="${esc(row.nota)}" /></td>
      <td><button type="button" class="admin-btn reas-row-remove" title="Quitar" style="padding:6px 12px">Quitar</button></td>
    </tr>`;
  }
  function renderRows(rows) {
    const tbody = $('reas-table')?.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = (rows.length ? rows : [null]).map(rowHTML).join('');
  }
  function addRow(prefill) {
    const tbody = $('reas-table')?.querySelector('tbody');
    if (!tbody) return;
    // La fila vacia que queda cuando no hay nada (rowHTML(null) via
    // renderRows) no cuenta como "real": si es lo unico que hay, se
    // reemplaza en vez de apilarse encima.
    const soloVacia = tbody.children.length === 1 && !tbody.querySelector('[data-field="tienda"]').value.trim();
    const html = rowHTML(prefill || null);
    if (soloVacia) tbody.innerHTML = html; else tbody.insertAdjacentHTML('beforeend', html);
  }
  function setStatus(msg) {
    const el = $('reas-status');
    if (el) el.textContent = msg;
  }

  // ── Deteccion masiva: tiendas que el catalogo YA marca sin AT vigente ──
  // El catalogo es la misma fuente que usa resolveAsesorD1, asi que esta
  // lista es exactamente "que se veria afectado hoy" -- no hace falta
  // escanear los 8 dashboards por separado. Se excluyen las que ya tienen
  // fila en la tabla de abajo (currentRows), para no duplicar.
  let huerfanas = [];
  function computeHuerfanas() {
    const yaCubiertas = new Set(currentRows.map((r) => OXXO.normalizeCatalogTienda(r.tienda)));
    const vistas = new Set();
    return (CATALOG.rows || [])
      .filter((r) => {
        const tienda = String(r.tienda || '').trim();
        if (!tienda) return false;
        if (!/sin asesor/i.test(String(r.asesor || '').trim()) && String(r.asesor || '').trim()) return false;
        if (OXXO.metricsIsTiendaEntrenamientoOperacionesD2(tienda)) return false;
        const key = OXXO.normalizeCatalogTienda(tienda);
        if (yaCubiertas.has(key) || vistas.has(key)) return false;
        vistas.add(key);
        return true;
      })
      .map((r) => ({ tienda: r.tienda, cr: r.cr }))
      .sort((a, b) => a.tienda.localeCompare(b.tienda, 'es'));
  }
  function renderHuerfanas() {
    const tbody = $('reas-huerfanas-list');
    if (!tbody) return;
    tbody.innerHTML = huerfanas.length
      ? huerfanas.map((h, i) => `<tr>
          <td><input type="checkbox" class="reas-huerfana-check" data-i="${i}" /></td>
          <td>${esc(h.tienda)}</td>
          <td>${esc(h.cr || '—')}</td>
        </tr>`).join('')
      : '<tr><td colspan="3" style="padding:16px;text-align:center;color:#9b6b60">Sin tiendas huérfanas pendientes ahora mismo 🎉</td></tr>';
  }
  function bulkAdd() {
    const asesor = $('reas-bulk-asesor').value.trim();
    if (!asesor) { alert('Selecciona el asesor entrante para las tiendas marcadas.'); return; }
    const nota = $('reas-bulk-nota').value.trim();
    const checks = [...document.querySelectorAll('.reas-huerfana-check:checked')];
    if (!checks.length) { alert('Marca al menos una tienda.'); return; }
    const indices = checks.map((c) => Number(c.dataset.i));
    indices.forEach((i) => addRow({ tienda: huerfanas[i].tienda, asesor, nota }));
    huerfanas = huerfanas.filter((_, i) => !indices.includes(i));
    renderHuerfanas();
    $('reas-bulk-nota').value = '';
    setStatus(`${indices.length} tienda${indices.length === 1 ? '' : 's'} agregada${indices.length === 1 ? '' : 's'} a la tabla de abajo. Revisa y da Publicar para que apliquen.`);
  }

  // Trae las reasignaciones YA publicadas (lectura directa de la hoja, no
  // pasa por el cache de OXXO.loadReasignaciones -- asi la pantalla siempre
  // ve el estado mas fresco al abrirla, aunque otra pestana del navegador
  // ya lo haya cacheado).
  async function fetchCurrentRows() {
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.REASIGNACIONES_SHEET || 'Reasignaciones');
    if (!raw || !raw.length) return [];
    const h = raw[0];
    const K = (aliases) => OXXO.metricsFindKey(h, aliases);
    const tiendaKey = K(['Tienda']);
    const asesorKey = K(['Asesor_Entrante', 'Asesor Entrante', 'Nuevo Asesor', 'Hereda']);
    const notaKey = K(['Nota', 'Asesor_Saliente', 'Asesor Saliente']);
    if (!asesorKey) return [];
    return raw
      .map((r) => ({
        tienda: tiendaKey ? String(OXXO.metricsVal(r, tiendaKey) || '').trim() : '',
        asesor: String(OXXO.metricsVal(r, asesorKey) || '').trim(),
        nota: notaKey ? String(OXXO.metricsVal(r, notaKey) || '').trim() : '',
      }))
      .filter((r) => r.tienda || r.asesor);
  }

  async function init() {
    try {
      CATALOG = await OXXO.loadAsesorCatalog();
      const nombres = new Set();
      (CATALOG.rows || []).forEach((r) => {
        const a = String(r.asesor || '').trim();
        if (a && !/sin asesor/i.test(a)) nombres.add(a);
      });
      ASESORES = [...nombres].sort((a, b) => a.localeCompare(b, 'es'));
      const tiendas = [...CATALOG.byTienda.values()].map((v) => v.tienda).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
      $('reas-tiendas-list').innerHTML = tiendas.map((t) => `<option value="${esc(t)}"></option>`).join('');
      $('reas-bulk-asesor').innerHTML = ['<option value="">Asesor entrante…</option>']
        .concat(ASESORES.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`)).join('');

      currentRows = await fetchCurrentRows();
      renderRows(currentRows);
      huerfanas = computeHuerfanas();
      renderHuerfanas();
      const plural = currentRows.length === 1 ? 'reasignación activa' : 'reasignaciones activas';
      setStatus(currentRows.length
        ? `${currentRows.length} ${plural}. Agrega, edita o quita filas y publica para actualizar.`
        : 'Sin reasignaciones activas todavía. La pestaña "Reasignaciones" se crea sola en el Sheet la primera vez que publiques (si tu Apps Script tiene "Reasignaciones" agregado a ALLOWED_SHEETS).');
    } catch (err) {
      console.error(err);
      renderRows([]);
      renderHuerfanas();
      setStatus('No se pudo leer el estado actual de Reasignaciones. Puedes seguir agregando filas y publicar de todos modos.');
    }
  }

  function collectRows() {
    const trs = [...($('reas-table')?.querySelectorAll('tbody tr') || [])];
    const sinMatch = [];
    const rows = trs.map((tr) => {
      const get = (f) => tr.querySelector(`[data-field="${f}"]`)?.value.trim() || '';
      const tienda = get('tienda'), asesor = get('asesor'), nota = get('nota');
      if (!tienda || !asesor) return null;
      const hit = CATALOG?.byTienda?.get(OXXO.normalizeCatalogTienda(tienda));
      if (!hit) sinMatch.push(tienda);
      return {
        CR: hit ? hit.cr : '',
        Tienda: hit ? hit.tienda : tienda,
        Asesor_Entrante: asesor,
        Nota: nota,
        Fecha: OXXO_ADMIN_CTX.isoDate(new Date()),
      };
    }).filter(Boolean);
    return { rows, sinMatch };
  }

  async function publish() {
    const url = OXXO_ADMIN_CTX.publishUrl();
    if (!url) { alert('Falta configurar Apps Script (pestaña "Cargar y Publicar Bases").'); return; }
    const { rows, sinMatch } = collectRows();
    if (sinMatch.length) {
      const seguir = confirm(`Estas tiendas no coinciden exactamente con el catálogo, se publicarán solo con el nombre escrito (sin CR): ${sinMatch.join(', ')}.\n\n¿Publicar de todos modos?`);
      if (!seguir) return;
    }
    const btn = $('reas-publish-btn');
    btn.disabled = true; btn.textContent = 'Publicando...';
    try {
      const payload = {
        adminPassword: OXXO_ADMIN_CTX.getAdminPassword(),
        targetSheet: OXXO.SHEETS_CONFIG.REASIGNACIONES_SHEET || 'Reasignaciones',
        rows,
        source: 'DashboardsOxxo Admin - Reasignaciones',
        updateMode: 'replaceAll',
      };
      const result = await OXXO_ADMIN_CTX.postAdminPayload(payload);
      currentRows = rows.map((r) => ({ tienda: r.Tienda, asesor: r.Asesor_Entrante, nota: r.Nota }));
      huerfanas = computeHuerfanas();
      renderHuerfanas();
      const plural = rows.length === 1 ? 'reasignación publicada' : 'reasignaciones publicadas';
      setStatus(result.compatibilityMode
        ? `Solicitud enviada en modo compatible. Espera unos segundos y recarga esta pestaña para confirmar.`
        : `${rows.length} ${plural}. Ya están vivas en todos los dashboards.`);
    } catch (error) {
      console.error(error);
      // El Apps Script (fuera de este repo) valida targetSheet contra una
      // lista blanca (ALLOWED_SHEETS) antes de crear la hoja -- si
      // "Reasignaciones" no esta ahi, rechaza el publish aunque la pestana
      // ya exista o el Apps Script la pudiera crear solo. Es un ajuste de
      // una linea en el Apps Script, no algo que se arregle desde aqui.
      const esRechazoPermiso = /no permitido/i.test(error.message || '');
      alert(esRechazoPermiso
        ? 'Tu Apps Script todavía no acepta la pestaña "Reasignaciones".\n\nAgrega \'Reasignaciones\' a la lista ALLOWED_SHEETS en el Apps Script (Extensiones > Apps Script en tu Google Sheet), guarda y crea una nueva versión del deployment (Implementar > Administrar implementaciones > Editar > Versión: Nueva versión). No hace falta crear la pestaña a mano: el script la crea solo en el primer publish.'
        : 'No se pudo publicar: ' + error.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Publicar';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!$('reas-table')) return;
    $('reas-add-row').addEventListener('click', () => addRow());
    $('reas-publish-btn').addEventListener('click', publish);
    $('reas-bulk-add').addEventListener('click', bulkAdd);
    $('reas-bulk-select-all').addEventListener('click', () => document.querySelectorAll('.reas-huerfana-check').forEach((c) => { c.checked = true; }));
    $('reas-bulk-select-none').addEventListener('click', () => document.querySelectorAll('.reas-huerfana-check').forEach((c) => { c.checked = false; }));
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('reas-row-remove')) {
        const tr = e.target.closest('tr');
        tr?.remove();
      }
    });
    init();
  });
})();
