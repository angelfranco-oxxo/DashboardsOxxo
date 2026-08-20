/* Bitacora compartida de publicaciones del Panel Admin. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  let pendingRestore = null;

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

  function csvCell(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function downloadSnapshot(kind) {
    if (!pendingRestore?.preview?.[kind]?.values) return;
    const values = pendingRestore.preview[kind].values;
    const csv = '\ufeff' + values.map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${pendingRestore.sheet}-${kind === 'current' ? 'estado-actual' : 'respaldo'}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function closeRestoreDialog() {
    const dialog = $('restore-dialog');
    if (dialog?.open) dialog.close();
    $('restore-confirm-input').value = '';
    $('restore-confirm-btn').disabled = true;
    $('restore-error').textContent = '';
    pendingRestore = null;
  }

  function showRestorePreview(preview, button) {
    pendingRestore = { sheet: preview.targetSheet, backup: preview.backupSheet, preview, sourceButton: button };
    $('restore-dialog-title').textContent = `Restaurar ${preview.targetSheet}`;
    $('restore-current-rows').textContent = `${Number(preview.current?.rows || 0).toLocaleString('es-MX')} filas`;
    $('restore-current-columns').textContent = `${Number(preview.current?.columns || 0).toLocaleString('es-MX')} columnas activas`;
    $('restore-backup-rows').textContent = `${Number(preview.backup?.rows || 0).toLocaleString('es-MX')} filas`;
    $('restore-backup-columns').textContent = `${Number(preview.backup?.columns || 0).toLocaleString('es-MX')} columnas guardadas`;
    $('restore-changed-rows').textContent = Number(preview.changedRows || 0).toLocaleString('es-MX');
    $('restore-changed-cells').textContent = Number(preview.changedCells || 0).toLocaleString('es-MX');
    $('restore-created-at').textContent = `Respaldo creado: ${preview.createdAt || 'fecha no disponible'}. El estado actual se guardará automáticamente antes de restaurar.`;
    $('restore-dialog').showModal();
    $('restore-confirm-input').focus();
  }

  async function openRestorePreview(button) {
    const sheet = button.dataset.restoreSheet || '';
    const backup = button.dataset.restoreBackup || '';
    if (!sheet || !backup) return;
    const ctx = window.OXXO_ADMIN_CTX;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Consultando…';
    try {
      const preview = await ctx.postAdminPayload({ action: 'getBackupPreview', adminPassword: ctx.getAdminPassword(), targetSheet: sheet, backupSheet: backup });
      if (preview.compatibilityMode) throw new Error('La versión publicada de Apps Script aún no permite comparar respaldos.');
      showRestorePreview(preview, button);
    } catch (error) {
      console.error('Vista previa de restauración:', error);
      alert('No se pudo consultar el respaldo: ' + (error.message || error));
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  async function confirmRestore() {
    if (!pendingRestore || $('restore-confirm-input').value.trim().toUpperCase() !== 'RESTAURAR') return;
    const ctx = window.OXXO_ADMIN_CTX;
    const button = $('restore-confirm-btn');
    button.disabled = true;
    button.textContent = 'Restaurando…';
    $('restore-error').textContent = '';
    try {
      const result = await ctx.postAdminPayload({ action: 'restoreBackup', adminPassword: ctx.getAdminPassword(), targetSheet: pendingRestore.sheet, backupSheet: pendingRestore.backup, adminUser: 'Administrador' });
      if (result.compatibilityMode) throw new Error('No fue posible confirmar la restauración. Actualiza la bitácora antes de intentar nuevamente.');
      const restoredSheet = pendingRestore.sheet;
      OXXO.clearSheetDataCache(restoredSheet);
      closeRestoreDialog();
      alert(`${restoredSheet} se restauró correctamente con ${Number(result.rows || 0).toLocaleString('es-MX')} fila(s). El estado anterior quedó guardado para deshacer el cambio.`);
      await loadAudit();
    } catch (error) {
      console.error('Restauración administrativa:', error);
      $('restore-error').textContent = 'No se pudo restaurar: ' + (error.message || error);
      button.disabled = false;
      button.textContent = 'Restaurar respaldo';
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
      if (button) openRestorePreview(button);
    });
    $('restore-dialog-close')?.addEventListener('click', closeRestoreDialog);
    $('restore-cancel-btn')?.addEventListener('click', closeRestoreDialog);
    $('restore-dialog')?.addEventListener('cancel', (event) => { event.preventDefault(); closeRestoreDialog(); });
    $('restore-confirm-input')?.addEventListener('input', (event) => {
      $('restore-confirm-btn').disabled = event.target.value.trim().toUpperCase() !== 'RESTAURAR';
      $('restore-error').textContent = '';
    });
    $('restore-confirm-btn')?.addEventListener('click', confirmRestore);
    document.querySelectorAll('[data-restore-download]').forEach((button) => button.addEventListener('click', () => downloadSnapshot(button.dataset.restoreDownload)));
    document.querySelector('.admin-tab[data-tab="bitacora"]')?.addEventListener('click', () => {
      if ($('audit-table-body')?.textContent.includes('Bitácora pendiente')) loadAudit();
    });
  });
})();
