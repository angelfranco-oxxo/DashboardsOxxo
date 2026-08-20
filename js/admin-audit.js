/* Bitacora compartida de publicaciones del Panel Admin. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  function render(rows) {
    $('audit-summary').textContent = rows.length ? `${rows.length} operación${rows.length === 1 ? '' : 'es'} reciente${rows.length === 1 ? '' : 's'} · los respaldos se conservan ocultos dentro del Google Sheets.` : 'Aún no hay publicaciones registradas en la nueva bitácora.';
    const restoreAvailable = new Set();
    $('audit-table-body').innerHTML = rows.length ? rows.map((row) => {
      const ok = ['correcta', 'restaurada'].includes(String(row.Estado || '').toLowerCase());
      const sheet = String(row.Hoja || '');
      const canRestore = Boolean(sheet && row.Respaldo && !restoreAvailable.has(sheet));
      if (canRestore) restoreAvailable.add(sheet);
      return `<tr><td><strong>${esc(row.Fecha || '—')}</strong></td><td><strong>${esc(sheet || '—')}</strong><small>${esc(row.Archivo || row.Origen || 'Sin archivo informado')}</small></td><td>${esc(row['Filas publicadas'] || '0')} filas<small>${esc(row.Modo || '—')}${row['Filas conservadas'] ? ` · ${esc(row['Filas conservadas'])} conservadas` : ''}</small></td><td>${esc(row.Usuario || 'Administrador')}</td><td><span class="audit-status ${ok ? 'ok' : 'bad'}">${esc(row.Estado || '—')}</span>${row.Detalle ? `<small>${esc(row.Detalle)}</small>` : ''}</td><td><span class="audit-backup">${esc(row.Respaldo || '—')}</span>${canRestore ? `<button type="button" class="audit-restore" data-restore-sheet="${esc(sheet)}" data-restore-backup="${esc(row.Respaldo)}">Restaurar último respaldo</button>` : ''}</td></tr>`;
    }).join('') : '<tr><td colspan="6" class="quality-empty">No hay operaciones registradas.</td></tr>';
  }

  async function restoreBackup(button) {
    const sheet = button.dataset.restoreSheet || '';
    const backup = button.dataset.restoreBackup || '';
    if (!sheet || !backup) return;
    const accepted = window.confirm(`Vas a restaurar el ultimo respaldo de ${sheet}.\n\nEl estado actual se guardara automaticamente para que puedas deshacer esta restauracion. La operacion quedara registrada en la bitacora.\n\n¿Deseas continuar?`);
    if (!accepted) return;
    const ctx = window.OXXO_ADMIN_CTX;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Restaurando…';
    try {
      const result = await ctx.postAdminPayload({ action: 'restoreBackup', adminPassword: ctx.getAdminPassword(), targetSheet: sheet, backupSheet: backup, adminUser: 'Administrador' });
      if (result.compatibilityMode) throw new Error('No fue posible confirmar la restauración. Actualiza la bitácora antes de intentar nuevamente.');
      OXXO.clearSheetDataCache(sheet);
      alert(`${sheet} se restauró correctamente con ${Number(result.rows || 0).toLocaleString('es-MX')} fila(s). El estado anterior quedó guardado para deshacer el cambio.`);
      await loadAudit();
    } catch (error) {
      console.error('Restauración administrativa:', error);
      alert('No se pudo restaurar el respaldo: ' + (error.message || error));
      button.disabled = false;
      button.textContent = original;
    }
  }

  async function loadAudit() {
    const button = $('audit-refresh-btn');
    if (!button || button.disabled) return;
    const ctx = window.OXXO_ADMIN_CTX;
    if (!ctx?.postAdminPayload) return;
    button.disabled = true;
    button.textContent = 'Consultando…';
    $('audit-table-body').innerHTML = '<tr><td colspan="6" class="quality-empty">Consultando bitácora…</td></tr>';
    try {
      const result = await ctx.postAdminPayload({ action: 'getAudit', adminPassword: ctx.getAdminPassword(), limit: 100 });
      if (result.compatibilityMode) throw new Error('La versión publicada de Apps Script aún no permite consultar la bitácora.');
      render(Array.isArray(result.rows) ? result.rows : []);
    } catch (error) {
      console.error('Bitácora administrativa:', error);
      $('audit-summary').textContent = error.message || 'No fue posible consultar la bitácora.';
      $('audit-table-body').innerHTML = '<tr><td colspan="6" class="quality-empty">No se pudo cargar la bitácora.</td></tr>';
    } finally {
      button.disabled = false;
      button.textContent = 'Actualizar bitácora';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('audit-refresh-btn')?.addEventListener('click', loadAudit);
    $('audit-table-body')?.addEventListener('click', (event) => {
      const button = event.target.closest('.audit-restore');
      if (button) restoreBackup(button);
    });
    document.querySelector('.admin-tab[data-tab="bitacora"]')?.addEventListener('click', () => {
      if ($('audit-table-body')?.textContent.includes('Bitácora pendiente')) loadAudit();
    });
  });
})();
