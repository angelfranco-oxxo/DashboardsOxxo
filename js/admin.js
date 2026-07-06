(function(){
  const ADMIN_CONFIG_KEY = 'oxxo_admin_apps_script_url';
  const dashboards = [
    { key:'d1', label:'Dashboard 1 - Vacantes diarias', tab:OXXO.SHEETS_CONFIG.TABS.d1, required:['Plaza','Asesor','Unidad org','ID posiciones','Descripción de Posición','Status ocupación','Fecha','Días Vacantes','Mes'] },
    { key:'d2', label:'Dashboard 2 - Bajas diarias', tab:OXXO.SHEETS_CONFIG.TABS.d2, required:['Asesor','Plaza','Temporalidad','Puesto','Mes','Semana','Rot_Temp','Fecha'] },
    { key:'d2denom', label:'Dashboard 2 - Denominaciones', tab:OXXO.SHEETS_CONFIG.TABS.d2denom, required:['Asesor','Nombre del empleado','Denominación Posición Anterior','Denominación Posición Actual','F.Crea'] },
    { key:'d3', label:'Dashboard 3 - Estructura', tab:OXXO.SHEETS_CONFIG.TABS.d3, required:['Asesor','Tienda','CR TIENDA','Plaza','% Aprovechamiento','Clas Aprov','Mes Semana'] },
    { key:'s4', label:'Dashboard 4 - Tiempo extra', tab:OXXO.SHEETS_CONFIG.TABS.s4, required:['Plaza','Asesor','Nombre del empleado o candidato','Textos homologados','Texto breve de unidad organizativa','Cantidad','Importe','Semana'] },
    { key:'s5', label:'Dashboard 5 - Vacaciones', tab:OXXO.SHEETS_CONFIG.TABS.s5, required:['Asesor','Empleado','Puesto','Fecha_Inicio','Fecha_Fin','Dias','Semana'] },
    { key:'s6', label:'Dashboard 6 - Ausentismos', tab:OXXO.SHEETS_CONFIG.TABS.s6, required:['Asesor','Empleado','Puesto','Tipo_Ausentismo','Fecha','Semana','Dias'] },
    { key:'s7', label:'Dashboard 7 - TREO', tab:OXXO.SHEETS_CONFIG.TABS.s7, required:['Plaza','CR','Tienda','Asesor','SAP','TREO','Activos','Vacantes','Movimiento'] },
    { key:'catalog', label:'Catalogo de asesores', tab:OXXO.SHEETS_CONFIG.CATALOG_SHEET, required:['ASESOR','TIENDA','CR TIENDA'] },
  ];

  const state = { workbook:null, sheetName:'', rows:[], validation:null };
  const $ = id => document.getElementById(id);

  function norm(value){
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9%]+/g,'').trim();
  }
  function dashboard(){ return dashboards.find(d => d.key === $('dashboard-select').value) || dashboards[0]; }
  function setStatus(items){
    $('status-list').innerHTML = items.map(item => `
      <div class="status-item ${item.type}">
        <span class="status-dot"></span>
        <div><div class="status-title">${escapeHtml(item.title)}</div><div class="status-sub">${escapeHtml(item.text)}</div></div>
        <span class="status-badge">${escapeHtml(item.badge || '')}</span>
      </div>`).join('');
  }
  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function getHeaders(rows){
    const set = new Set();
    rows.forEach(row => Object.keys(row || {}).forEach(key => set.add(key)));
    return [...set];
  }
  function validateRows(){
    const dash = dashboard();
    const rows = state.rows || [];
    const headers = getHeaders(rows);
    const normalizedHeaders = new Map(headers.map(h => [norm(h), h]));
    const missing = dash.required.filter(col => !normalizedHeaders.has(norm(col)));
    const nonEmpty = rows.filter(row => Object.values(row || {}).some(v => String(v ?? '').trim() !== ''));
    const items = [
      { type: rows.length ? 'ok' : 'bad', title:'Archivo leido', text: rows.length ? `${rows.length} filas detectadas en "${state.sheetName}".` : 'No se detectaron filas utiles.', badge: rows.length ? 'OK' : 'Revisar' },
      { type: missing.length ? 'bad' : 'ok', title:'Columnas obligatorias', text: missing.length ? `Faltan: ${missing.join(', ')}` : `Todas las columnas requeridas para ${dash.label}.`, badge: missing.length ? missing.length + ' faltan' : 'OK' },
      { type: nonEmpty.length === rows.length ? 'ok' : 'warn', title:'Filas vacias', text: nonEmpty.length === rows.length ? 'No se detectaron filas completamente vacias.' : `${rows.length - nonEmpty.length} filas vacias o incompletas detectadas.`, badge: nonEmpty.length + ' utiles' },
      { type:'warn', title:'Publicacion', text:'GitHub Pages no escribe en Sheets por si solo. Para publicar directo se necesita URL de Apps Script; si no, descarga el CSV validado.', badge:'Modo seguro' },
    ];
    state.validation = { ok: rows.length > 0 && missing.length === 0, missing, headers, rows: nonEmpty };
    setStatus(items);
    $('download-csv-btn').disabled = !rows.length;
    $('publish-btn').disabled = !state.validation.ok;
    $('admin-guidance').textContent = state.validation.ok
      ? `Listo para ${dash.tab}. Revisa la vista previa y publica o descarga CSV.`
      : 'Corrige las columnas faltantes antes de publicar.';
    renderPreview(nonEmpty.slice(0, 80), headers);
  }
  function renderPreview(rows, headers){
    $('preview-meta').textContent = `${rows.length} filas en vista previa`;
    if (!rows.length || !headers.length) {
      $('preview-table').innerHTML = '<tbody><tr><td style="padding:28px;text-align:center;color:#7a4a42">Aun no hay datos para mostrar.</td></tr></tbody>';
      return;
    }
    const selectedHeaders = headers.slice(0, 14);
    $('preview-table').innerHTML = `
      <thead><tr>${selectedHeaders.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(row => `<tr>${selectedHeaders.map(h => `<td title="${escapeHtml(row[h])}">${escapeHtml(row[h])}</td>`).join('')}</tr>`).join('')}</tbody>`;
  }
  function fillDashboardSelect(){
    $('dashboard-select').innerHTML = dashboards.map(d => `<option value="${d.key}">${d.label}</option>`).join('');
  }
  function fillSheets(){
    const names = state.workbook ? state.workbook.SheetNames : [];
    $('sheet-select').disabled = !names.length;
    $('sheet-select').innerHTML = names.length ? names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('') : '<option value="">Sube un Excel primero</option>';
    state.sheetName = names[0] || '';
  }
  function loadCurrentSheet(){
    if (!state.workbook || !state.sheetName) return;
    const sheet = state.workbook.Sheets[state.sheetName];
    state.rows = XLSX.utils.sheet_to_json(sheet, { defval:'', raw:false });
    validateRows();
  }
  async function handleFile(file){
    if (!file) return;
    const buffer = await file.arrayBuffer();
    state.workbook = XLSX.read(buffer, { type:'array' });
    $('file-meta').textContent = `${file.name} - ${(file.size/1024/1024).toFixed(2)} MB`;
    fillSheets();
    loadCurrentSheet();
  }
  function downloadCsv(){
    if (!state.rows.length) return;
    const dash = dashboard();
    const headers = getHeaders(state.rows);
    OXXO.downloadRowsAsCSV(state.rows, `${dash.key}-${dash.tab}.csv`, headers);
  }
  async function publish(){
    const url = $('apps-script-url').value.trim();
    if (!url) { alert('Pega primero la URL de Apps Script.'); return; }
    if (!state.validation?.ok) { alert('La base aun tiene errores de validacion.'); return; }
    const dash = dashboard();
    $('publish-btn').disabled = true;
    $('publish-btn').textContent = 'Publicando...';
    try {
      const response = await fetch(url, {
        method:'POST',
        mode:'cors',
        headers:{ 'Content-Type':'text/plain;charset=utf-8' },
        body: JSON.stringify({ targetSheet:dash.tab, rows:state.validation.rows, source:'DashboardsOxxo Admin' })
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      alert('Base publicada correctamente.');
    } catch (error) {
      alert('No se pudo publicar. Descarga el CSV o revisa la URL de Apps Script.');
      console.error(error);
    } finally {
      $('publish-btn').disabled = false;
      $('publish-btn').textContent = 'Publicar en Sheets';
    }
  }
  function bind(){
    $('drop-zone').addEventListener('click', () => $('file-input').click());
    $('file-input').addEventListener('change', event => handleFile(event.target.files[0]));
    ['dragenter','dragover'].forEach(ev => $('drop-zone').addEventListener(ev, event => { event.preventDefault(); $('drop-zone').classList.add('drag'); }));
    ['dragleave','drop'].forEach(ev => $('drop-zone').addEventListener(ev, event => { event.preventDefault(); $('drop-zone').classList.remove('drag'); }));
    $('drop-zone').addEventListener('drop', event => handleFile(event.dataTransfer.files[0]));
    $('sheet-select').addEventListener('change', event => { state.sheetName = event.target.value; loadCurrentSheet(); });
    $('dashboard-select').addEventListener('change', validateRows);
    $('download-csv-btn').addEventListener('click', downloadCsv);
    $('publish-btn').addEventListener('click', publish);
    $('save-config-btn').addEventListener('click', () => { localStorage.setItem(ADMIN_CONFIG_KEY, $('apps-script-url').value.trim()); alert('URL guardada en este navegador.'); });
  }
  document.addEventListener('DOMContentLoaded', () => {
    fillDashboardSelect();
    $('apps-script-url').value = localStorage.getItem(ADMIN_CONFIG_KEY) || '';
    setStatus([{ type:'warn', title:'Esperando archivo', text:'Selecciona un dashboard y sube un Excel para iniciar la validacion.', badge:'Pendiente' }]);
    bind();
  });
})();
