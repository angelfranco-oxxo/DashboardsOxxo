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
  function addRow() {
    const tbody = $('reas-table')?.querySelector('tbody');
    if (!tbody) return;
    tbody.insertAdjacentHTML('beforeend', rowHTML(null));
  }
  function setStatus(msg) {
    const el = $('reas-status');
    if (el) el.textContent = msg;
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

      currentRows = await fetchCurrentRows();
      renderRows(currentRows);
      const plural = currentRows.length === 1 ? 'reasignación activa' : 'reasignaciones activas';
      setStatus(currentRows.length
        ? `${currentRows.length} ${plural}. Agrega, edita o quita filas y publica para actualizar.`
        : 'Sin reasignaciones activas todavía. Si es la primera vez que usas esta pantalla, al publicar se crea la fila inicial (o la pestaña "Reasignaciones" del Sheet, si tu Apps Script la crea sola; si no, créala una vez a mano con encabezados: CR, Tienda, Asesor_Entrante, Nota).');
    } catch (err) {
      console.error(err);
      renderRows([]);
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
      const plural = rows.length === 1 ? 'reasignación publicada' : 'reasignaciones publicadas';
      setStatus(result.compatibilityMode
        ? `Solicitud enviada en modo compatible. Espera unos segundos y recarga esta pestaña para confirmar.`
        : `${rows.length} ${plural}. Ya están vivas en todos los dashboards.`);
    } catch (error) {
      console.error(error);
      alert('No se pudo publicar: ' + error.message + '\n\nSi la pestaña "Reasignaciones" todavía no existe en el Sheet, créala una vez a mano con encabezados: CR, Tienda, Asesor_Entrante, Nota.');
    } finally {
      btn.disabled = false; btn.textContent = 'Publicar';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!$('reas-table')) return;
    $('reas-add-row').addEventListener('click', addRow);
    $('reas-publish-btn').addEventListener('click', publish);
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('reas-row-remove')) {
        const tr = e.target.closest('tr');
        tr?.remove();
      }
    });
    init();
  });
})();
