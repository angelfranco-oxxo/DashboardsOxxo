/* Consola operativa y avisos globales del Panel Admin. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  let notices = [];
  let loaded = false;

  const SOURCE_META = {
    Dashboard_1_Diario: ['RH', 'Vacantes'], Dashboard_2_Diario: ['RH', 'Bajas'],
    Dashboard_2_Otras_Plazas: ['RH', 'Bajas · otras plazas'], Denominaciones_Dashboard_2_Diario: ['RH', 'Catálogo de bajas'],
    Dashboard_2_Plan_Accion: ['RH', 'Plan de acción de bajas'], Dashboard_3_Diario: ['RH', 'Aprovechamiento'],
    Dashboard_3_Otras_Plazas: ['RH', 'Aprovechamiento · otras plazas'], Dashboard_4_Semanal: ['RH', 'Tiempo extra'],
    Dashboard_5_Semanal: ['RH', 'Vacaciones'], Dashboard_6_Semanal: ['RH', 'Ausentismos'],
    Dashboard_7_Semanal: ['RH', 'TREO'], Dashboard_8_Diario: ['RH', 'Capacidades'],
    Dashboard_10_FLEX: ['RH', 'Personal FLEX'], Dashboard_11_Semanal: ['RH', 'Registro y apego'],
    Dashboard_12_Mensual: ['RH', 'Alineación global'], Dashboard_13_Ausentismo: ['RH', 'Control de ausentismo'],
    Dashboard_14_Comercial: ['Comercial', 'Avance comercial'], Promociones: ['Comercial', 'PromosD100'],
    Dashboard_9_Semanal: ['Administrativo', 'Faltantes y sobrantes'], Inventarios: ['Administrativo', 'Resultados de inventario']
  };

  function ctx() {
    if (!window.OXXO_ADMIN_CTX) throw new Error('El panel todavía no terminó de iniciar.');
    return window.OXXO_ADMIN_CTX;
  }

  function setStatus(message, kind = '') {
    const el = $('console-status');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('ok', 'bad');
    if (kind) el.classList.add(kind);
  }

  function friendlyTarget(target) {
    const labels = { global: 'Todo el portal', 'area:rh': 'Área RH', 'area:comercial': 'Área Comercial', 'area:administrativo': 'Área Administrativa' };
    if (labels[target]) return labels[target];
    const option = [...$('console-notice-target').options].find((item) => item.value === target);
    return option?.textContent || target;
  }

  function formatDate(value) {
    if (!value) return 'Sin límite';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Sin límite' : date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function toLocalInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function renderHealth(sources) {
    const relevant = (Array.isArray(sources) ? sources : []).filter((source) => SOURCE_META[source.sheet]);
    const counts = relevant.reduce((acc, source) => { const key = ['ok', 'warn', 'bad'].includes(source.health) ? source.health : 'warn'; acc[key] += 1; return acc; }, { ok: 0, warn: 0, bad: 0 });
    $('console-summary').innerHTML = `<div class="console-kpi"><span>Fuentes</span><strong>${relevant.length}</strong></div><div class="console-kpi ok"><span>Correctas</span><strong>${counts.ok}</strong></div><div class="console-kpi warn"><span>Atención</span><strong>${counts.warn}</strong></div><div class="console-kpi bad"><span>Críticas</span><strong>${counts.bad}</strong></div>`;
    $('console-health-body').innerHTML = relevant.length ? relevant.map((source) => {
      const meta = SOURCE_META[source.sheet];
      return `<tr class="console-source"><td><strong>${esc(meta[1])}</strong><small>${esc(meta[0])} · ${esc(source.sheet)}</small></td><td><span class="overview-health ${esc(source.health || 'warn')}">${esc(source.healthLabel || 'Por revisar')}</span></td><td>${esc(source.publishedAt || 'Sin publicación')}<small>${source.ageDays == null ? 'Sin fecha registrada' : `Hace ${Number(source.ageDays).toLocaleString('es-MX')} día${Number(source.ageDays) === 1 ? '' : 's'}`}</small></td><td>${Number(source.publishedRows || 0).toLocaleString('es-MX')}</td></tr>`;
    }).join('') : '<tr><td colspan="4" class="quality-empty">No se encontraron fuentes operativas.</td></tr>';
  }

  function renderNotices() {
    const host = $('console-notices');
    host.innerHTML = notices.length ? notices.map((notice) => `<article class="console-notice ${esc(notice.type)} ${notice.active ? '' : 'inactive'}" data-notice-id="${esc(notice.id)}"><div class="console-notice__head"><strong>${esc(notice.title)}</strong><span>${notice.active ? 'Activo' : 'Inactivo'} · ${esc(friendlyTarget(notice.target))}</span></div><p>${esc(notice.message)}</p><small>Desde: ${esc(formatDate(notice.startsAt))} · Hasta: ${esc(formatDate(notice.endsAt))}</small><div class="console-notice__actions"><button class="console-mini-btn" type="button" data-notice-edit="${esc(notice.id)}">Editar</button><button class="console-mini-btn" type="button" data-notice-toggle="${esc(notice.id)}">${notice.active ? 'Desactivar' : 'Activar'}</button></div></article>`).join('') : '<div class="backup-empty">No hay avisos publicados. Puedes crear el primero arriba.</div>';
  }

  async function loadConsole() {
    const refresh = $('console-refresh-btn');
    refresh.disabled = true;
    setStatus('Consultando estado y avisos…');
    try {
      const adminPassword = ctx().getAdminPassword();
      const [overview, noticeResult] = await Promise.all([
        ctx().postAdminPayload({ action: 'getAdminOverview', adminPassword, limit: 40 }),
        ctx().postAdminPayload({ action: 'getSystemNotices', adminPassword })
      ]);
      renderHealth(overview.sources);
      notices = Array.isArray(noticeResult.notices) ? noticeResult.notices : [];
      renderNotices();
      loaded = true;
      setStatus(`Estado actualizado. ${notices.filter((notice) => notice.active).length} aviso(s) activo(s).`, 'ok');
    } catch (error) {
      setStatus(`No fue posible consultar la consola: ${error.message || error}`, 'bad');
    } finally {
      refresh.disabled = false;
    }
  }

  function resetForm() {
    $('console-notice-form').reset();
    $('console-notice-id').value = '';
    $('console-notice-type').value = 'info';
    $('console-notice-target').value = 'global';
    $('console-notice-active').checked = true;
    $('console-notice-save').textContent = 'Publicar aviso';
    $('console-notice-cancel').classList.add('hidden');
  }

  function editNotice(id) {
    const notice = notices.find((item) => item.id === id);
    if (!notice) return;
    $('console-notice-id').value = notice.id;
    $('console-notice-type').value = notice.type || 'info';
    $('console-notice-target').value = notice.target || 'global';
    $('console-notice-title').value = notice.title || '';
    $('console-notice-message').value = notice.message || '';
    $('console-notice-start').value = toLocalInput(notice.startsAt);
    $('console-notice-end').value = toLocalInput(notice.endsAt);
    $('console-notice-active').checked = Boolean(notice.active);
    $('console-notice-save').textContent = 'Guardar cambios';
    $('console-notice-cancel').classList.remove('hidden');
    $('console-notice-title').focus();
  }

  async function saveNotice(event) {
    event.preventDefault();
    const button = $('console-notice-save');
    button.disabled = true;
    setStatus('Guardando aviso…');
    try {
      await ctx().postAdminPayload({
        action: 'saveSystemNotice', adminPassword: ctx().getAdminPassword(),
        id: $('console-notice-id').value, type: $('console-notice-type').value,
        target: $('console-notice-target').value, title: $('console-notice-title').value,
        message: $('console-notice-message').value, startsAt: $('console-notice-start').value,
        endsAt: $('console-notice-end').value, active: $('console-notice-active').checked
      });
      resetForm();
      await loadConsole();
      setStatus('Aviso guardado. Los dashboards lo recibirán en menos de un minuto.', 'ok');
    } catch (error) {
      setStatus(`No se pudo guardar el aviso: ${error.message || error}`, 'bad');
    } finally {
      button.disabled = false;
    }
  }

  async function toggleNotice(id) {
    const notice = notices.find((item) => item.id === id);
    if (!notice) return;
    setStatus(`${notice.active ? 'Desactivando' : 'Activando'} aviso…`);
    try {
      await ctx().postAdminPayload({ action: 'setSystemNoticeStatus', adminPassword: ctx().getAdminPassword(), id, active: !notice.active });
      await loadConsole();
      setStatus(`Aviso ${notice.active ? 'desactivado' : 'activado'} correctamente.`, 'ok');
    } catch (error) {
      setStatus(`No se pudo cambiar el aviso: ${error.message || error}`, 'bad');
    }
  }

  function bind() {
    $('console-refresh-btn')?.addEventListener('click', loadConsole);
    $('console-notice-form')?.addEventListener('submit', saveNotice);
    $('console-notice-cancel')?.addEventListener('click', resetForm);
    $('console-notices')?.addEventListener('click', (event) => {
      const edit = event.target.closest('[data-notice-edit]');
      const toggle = event.target.closest('[data-notice-toggle]');
      if (edit) editNotice(edit.dataset.noticeEdit);
      if (toggle) void toggleNotice(toggle.dataset.noticeToggle);
    });
    document.querySelector('[data-tab="consola"]')?.addEventListener('click', () => { if (!loaded) void loadConsole(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
