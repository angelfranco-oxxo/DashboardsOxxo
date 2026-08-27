(function(){
  const ADMIN_CONFIG_KEY='oxxo_admin_apps_script_url';
  let adminPassword='';
  const PLAZA_TARGET='OAXACA';
  const DEFAULT_UPLOAD_URL=(window.OXXO&&OXXO.SHEETS_CONFIG&&OXXO.SHEETS_CONFIG.ADMIN_UPLOAD_URL)||'';

  let dashboards=[];

  const columnAliases=window.OXXO_ADMIN_COLUMN_ALIASES||{};

  const state={workbook:null,sheetName:'',fileName:'',rows:[],validation:null,headerRow:0,sourceRows:0,sourceHeaders:[],sheetMatrixCache:new Map(),runtimeVersion:0};
  let manualRows=[];
  const $=id=>document.getElementById(id);

  function norm(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9%]+/g,' ').trim().replace(/\s+/g,'');}
  function normLoose(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
  function aliasesFor(column){return [column,...(columnAliases[column]||[])].map(norm);}
  function initDashboardDefinitions(){
    if(typeof window.OXXO_ADMIN_DASHBOARDS!=='function'){
      throw new Error('No se cargo js/admin/dashboard-definitions.js');
    }
    dashboards=window.OXXO_ADMIN_DASHBOARDS({OXXO,state,parseDate,isoDate,containsOaxaca,isVacancyRow,deriveD1,deriveD2,deriveD2Denom,deriveD3,deriveD5,deriveD6,deriveD7,deriveCatalog,deriveInventories});
  }
  function dashboard(){return dashboards.find(d=>d.key===$('dashboard-select').value)||dashboards[0];}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  const {setStatus,renderPreview,renderPublishImpact,renderPublicationResult,toggleManualSection,addPlanRow} = window.OXXO_ADMIN_UI({$,escapeHtml,dashboard});
  // Valida la contrasena contra el Apps Script (action:'auth') en vez de solo
  // comprobar que no venga vacia. Antes cualquier texto abria el panel: los
  // datos nunca estuvieron expuestos (cada escritura revalida la contrasena en
  // el servidor y una mala era rechazada ahi), pero se podia entrar, subir un
  // Excel completo y enterarse del rechazo hasta el final.
  //
  // FALLA ABIERTA A PROPOSITO: solo se rechaza cuando el servidor responde
  // explicitamente 'No autorizado'. Cualquier otro error deja pasar igual que
  // antes, para no dejar a nadie fuera del panel si el Apps Script desplegado
  // en vivo va atrasado respecto al repo (ya paso varias veces). Casos:
  //  - Deploy nuevo + contrasena buena -> ok:true, entra.
  //  - Deploy nuevo + contrasena mala  -> 'No autorizado', se rechaza.
  //  - Deploy viejo SIN action:'auth'  -> cae al flujo de publicacion, que
  //    valida la contrasena primero: con una mala responde 'No autorizado'
  //    (se rechaza igual), y con una buena responde 'targetSheet requerido'
  //    (no es rechazo de credencial -> entra). Es decir, la validacion
  //    tambien funciona contra deploys viejos.
  //  - Sin red / CORS bloqueado -> postAdminPayload no puede leer la
  //    respuesta (modo compatible), no hay forma de verificar -> entra.
  async function authenticateAdmin(password){
    if(!String(password||'').trim())throw new Error('Ingresa la contrasena.');
    try{
      await postAdminPayload({action:'auth',adminPassword:password});
    }catch(error){
      if(/no autorizado/i.test(String(error?.message||error||''))){
        throw new Error('Contrasena incorrecta.');
      }
      console.warn('[OXXO] No se pudo verificar la contrasena contra Apps Script; se permite el acceso y la validacion real ocurre al publicar.',error);
    }
    adminPassword=password;
    return true;
  }
  function initAdminLock(){
    const lock=$('admin-lock'),form=$('admin-lock-form'),input=$('admin-password'),error=$('admin-lock-error');
    if(!lock||!form||!input)return;
    lock.classList.remove('hidden');
    setTimeout(()=>input.focus(),80);
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const password=input.value;
      if(error)error.textContent='Validando...';
      try{
        await authenticateAdmin(password);
        input.value='';
        if(error)error.textContent='';
        lock.classList.add('hidden');
      }catch(err){
        if(error)error.textContent=err.message||'Contrasena incorrecta. Intenta de nuevo.';
        input.select();
      }
    });
  }
  const {
    getHeaders,
    containsOaxaca,
    toNumber,
    pctValue,
    parseDate,
    isoDate,
    monthKey,
    daysBetween,
    extractStatusDate,
    isVacancyRow,
    dateFromText,
    monthFromSourceName,
    deriveD1,
    deriveD2,
    deriveD2Denom,
    deriveD3,
    deriveD5,
    deriveD6,
    deriveD7,
    deriveCatalog,
    deriveInventories,
    findHeaderRow,
    buildSourceMap,
    matchColumns,
    rowsFromMatrix,
    getSheetMatrix,
    evaluateSheet,
    autoSelectSheet,
    periodInfo
  } = window.OXXO_ADMIN_NORMALIZERS({state,norm,normLoose,aliasesFor,dashboard,$,OXXO});

  function validateRows(){
    const dash=dashboard(),rows=state.rows||[],headers=getHeaders(rows),missing=dash.required.filter(col=>!rows.some(row=>String(row[col]??'').trim()!=='')),nonEmpty=rows.filter(row=>Object.values(row||{}).some(v=>String(v??'').trim()!=='')),period=periodInfo(dash,nonEmpty);
    if(dash.periodColumn&&!period.values.length)missing.push(dash.periodColumn);
    setStatus([
      {type:rows.length?'ok':'bad',title:'Archivo leido',text:rows.length?`${rows.length} filas Oaxaca listas desde "${state.sheetName}".`:`No se detectaron filas utiles para ${PLAZA_TARGET}.`,badge:rows.length?'OK':'Revisar'},
      {type:missing.length?'bad':'ok',title:'Columnas obligatorias',text:missing.length?`Faltan o vienen vacias: ${missing.join(', ')}`:`Columnas criticas OK para ${dash.label}.`,badge:missing.length?missing.length+' faltan':'OK'},
      {type:state.sourceRows===rows.length?'ok':'warn',title:'Filtro Oaxaca',text:state.sourceRows===rows.length?'Todas las filas utiles corresponden al filtro esperado.':`${state.sourceRows} filas leidas; ${rows.length} quedaron despues de filtros/reglas.`,badge:`${rows.length} utiles`},
      {type:'warn',title:'Regla aplicada',text:dash.notes||'Se normalizaron columnas al formato del dashboard.',badge:'Auto'},
      {type:period.enabled?'ok':'warn',title:'Modo de publicacion',text:period.enabled?`Se reemplazara solo ${period.column}: ${period.values.join(', ')}.`:'Sin periodo confiable: esta base reemplaza la pestana completa.',badge:period.enabled?'Por periodo':'Completo'}
    ]);
    state.validation={ok:rows.length>0&&missing.length===0,missing,headers,rows:nonEmpty};
    $('download-csv-btn').disabled=!rows.length;$('publish-btn').disabled=!state.validation.ok;
    $('admin-guidance').textContent=state.validation.ok?`Listo para publicar en ${dash.tab}. Encabezados detectados en fila ${state.headerRow}; se enviaran ${dash.output.length} columnas normalizadas.`:'Revisa la hoja seleccionada o el dashboard destino: faltan columnas criticas o no hay filas Oaxaca.';
    renderPublishImpact({
      area:ADMIN_AREAS[currentAdminArea]?.title||currentAdminArea,
      target:dash.tab,
      rows:nonEmpty.length,
      columns:dash.output.length,
      mode:period.enabled?`Solo ${period.values.join(', ')}`:'Reemplazo completo'
    });
    renderPreview(nonEmpty.slice(0,80),dash.output);
  }
  // d2otras (Bajas otras plazas) y d2denom (Movimientos ABC) ya no aparecen
  // en el menu: se calculan solos al publicar "Bajas diarias" (mismo
  // archivo, cada uno con su propia hoja -- "Bajas" y "ABC"), asi no hay que
  // subir el Excel varias veces. d3plazas (Aprovechamiento otras plazas)
  // sigue el mismo patron: se calcula sola al publicar "Estructura" desde
  // la hoja "PLAZAS" del mismo Excel. Las definiciones siguen vivas en
  // dashboards[] para que publish() las reutilice.
  const HIDDEN_FROM_MENU=['d2otras','d2denom','d3plazas'];
  const ADMIN_AREAS={
    rh:{title:'Recursos Humanos',description:'Bases de talento, estructura y operación de tienda.',color:'#f71926',soft:'#fff0ef'},
    comercial:{title:'Comercial',description:'PromosD100 (edición directa en Sheets) y avance de indicadores comerciales.',color:'#12608f',soft:'#eaf5fb'},
    administrativo:{title:'Administrativo',description:'Resultados de Inventario y Faltantes y Sobrantes.',color:'#65529a',soft:'#f1eef9'}
  };
  let currentAdminArea='rh';
  function dashboardArea(key){
    if(['s9','inventories'].includes(key))return 'administrativo';
    if(key==='c14')return 'comercial';
    return 'rh';
  }
  function areaDashboards(area=currentAdminArea){return dashboards.filter(d=>!HIDDEN_FROM_MENU.includes(d.key)&&dashboardArea(d.key)===area);}
  function fillDashboardSelect(area=currentAdminArea){
    const select=$('dashboard-select'),available=areaDashboards(area);
    select.innerHTML=available.map(d=>`<option value="${d.key}">${d.label}</option>`).join('');
    select.disabled=!available.length;
  }
  function selectUploadTab(){
    const uploadTab=document.querySelector('.admin-tab[data-tab="upload"]');
    if(uploadTab&&!uploadTab.classList.contains('active'))uploadTab.click();
  }
  function setAdminArea(area){
    if(!ADMIN_AREAS[area])return;
    currentAdminArea=area;
    const config=ADMIN_AREAS[area],available=areaDashboards(area),isCommercial=area==='comercial';
    document.querySelectorAll('.admin-area').forEach(button=>{
      const active=button.dataset.adminArea===area;
      button.classList.toggle('active',active);
      button.setAttribute('aria-selected',String(active));
    });
    const context=$('admin-area-context');
    context.style.setProperty('--area-color',config.color);
    context.style.setProperty('--area-soft',config.soft);
    $('admin-area-title').textContent=config.title;
    $('admin-area-description').textContent=config.description;
    $('admin-area-count').textContent=`${available.length} ${available.length===1?'base':'bases'}`;
    $('admin-upload-tab-label').textContent='Cargar y Publicar Bases';
    $('tabpanel-upload').dataset.adminArea=area;
    document.querySelectorAll('.admin-tab').forEach(tab=>tab.classList.toggle('hidden',area!=='rh'&&!['upload','calidad','bitacora','consola','mapa'].includes(tab.dataset.tab)));
    if(area!=='rh')selectUploadTab();
    // Comercial tiene dos cosas distintas: PromosD100 (se edita directo en
    // Sheets, panel informativo fijo) y bases que SI se suben por Excel (ej.
    // Dashboard 14 - Avance Comercial). El panel de Promos se muestra siempre
    // que el area sea comercial; el flujo normal de carga se muestra o no
    // segun si esa area tiene alguna base disponible (antes se ocultaba
    // siempre que isCommercial, lo que dejaba Dashboard 14 inalcanzable
    // desde la pestana Comercial).
    const hasUpload=available.length>0;
    $('admin-commercial-panel').classList.toggle('hidden',!isCommercial);
    $('admin-upload-workspace').classList.toggle('hidden',!hasUpload);
    $('admin-preview-section').classList.toggle('hidden',!hasUpload);
    if(!hasUpload)return;
    fillDashboardSelect(area);
    autoSelectSheet();
    loadCurrentSheet();
    toggleManualSection();
  }
  function fillSheets(){const names=state.workbook?state.workbook.SheetNames:[];$('sheet-select').disabled=!names.length;$('sheet-select').innerHTML=names.length?names.map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join(''):'<option value="">Sube un Excel primero</option>';state.sheetName=names[0]||'';autoSelectSheet();}
  function loadCurrentSheet(){if(!state.workbook||!state.sheetName)return;const dash=dashboard(),matrix=getSheetMatrix(state.sheetName);const parsed=rowsFromMatrix(matrix,dash);state.rows=parsed.rows;state.headerRow=parsed.headerRow;state.sourceRows=parsed.sourceRows;state.sourceHeaders=parsed.sourceHeaders;validateRows();}
  // codepage:65001 (UTF-8) evita que un .csv con acentos salga con mojibake
  // (ej. "MÃ¡rquez" en vez de "Márquez") — XLSX.js sin esto puede asumir otra
  // codificacion para archivos .csv (los .xlsx no se ven afectados, ya traen
  // su propia codificacion declarada).
  async function handleFile(file){if(!file)return;state.fileName=file.name||'';const buffer=await file.arrayBuffer();state.workbook=XLSX.read(buffer,{type:'array',cellDates:true,codepage:65001});state.sheetMatrixCache=new Map();$('file-meta').textContent=`${file.name} - ${(file.size/1024/1024).toFixed(2)} MB`;fillSheets();loadCurrentSheet();}
  function urlFromQuery(){try{return new URLSearchParams(location.search).get('uploadUrl')||'';}catch(_){return ''}}
  const {
    downloadCsv,
    publishUrl,
    postAdminPayload,
    notifyConfigDate,
    updatePublishState,
    publish,
    publishManual,
    publishManualD3,
    publishManualD2Plan
  } = window.OXXO_ADMIN_PUBLISHERS({$,state,OXXO,DEFAULT_UPLOAD_URL,dashboard,getDashboards:()=>dashboards,periodInfo,isoDate,getAdminPassword:()=>adminPassword,getAdminArea:()=>ADMIN_AREAS[currentAdminArea]?.title||currentAdminArea,getRuntimeVersion:()=>state.runtimeVersion,renderPublicationResult,rowsFromMatrix,getSheetMatrix});
  async function refreshRuntimeVersion(){
    const el=$('admin-runtime-version'),url=publishUrl();
    if(!el)return;
    el.classList.remove('ok','bad');
    el.textContent='Apps Script · verificando…';
    if(!url){el.textContent='Apps Script · sin configurar';el.classList.add('bad');return;}
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),7000);
    try{
      const separator=url.includes('?')?'&':'?';
      const response=await fetch(`${url}${separator}health=${Date.now()}`,{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const result=await response.json();
      if(result.ok===false)throw new Error(result.error||'Servicio no disponible');
      const version=result.version?`v${result.version}`:'sin versión';
      state.runtimeVersion=Number(result.version||0);
      const sources=Array.isArray(result.sheets)?` · ${result.sheets.length} fuentes`:'';
      el.textContent=`Apps Script ${version}${sources}`;
      el.classList.add(result.version?'ok':'bad');
    }catch(error){
      state.runtimeVersion=0;
      el.textContent='Apps Script · no verificable';
      el.classList.add('bad');
      console.warn('[OXXO] No se pudo comprobar la versión productiva de Apps Script.',error);
    }finally{clearTimeout(timeout);}
  }
  // Contexto minimo para que otras herramientas del panel (ej.
  // js/admin-reasignaciones.js) publiquen con el MISMO mecanismo -- misma
  // URL, misma contrasena, mismo manejo de CORS/modo compatible -- sin
  // duplicar esa logica ni exponer el password directamente.
  window.OXXO_ADMIN_CTX = { getAdminPassword: () => adminPassword, publishUrl, postAdminPayload, isoDate };
  function bind(){$('drop-zone').addEventListener('click',()=>$('file-input').click());$('file-input').addEventListener('change',event=>handleFile(event.target.files[0]));['dragenter','dragover'].forEach(ev=>$('drop-zone').addEventListener(ev,event=>{event.preventDefault();$('drop-zone').classList.add('drag');}));['dragleave','drop'].forEach(ev=>$('drop-zone').addEventListener(ev,event=>{event.preventDefault();$('drop-zone').classList.remove('drag');}));$('drop-zone').addEventListener('drop',event=>handleFile(event.dataTransfer.files[0]));$('sheet-select').addEventListener('change',event=>{state.sheetName=event.target.value;loadCurrentSheet();});$('dashboard-select').addEventListener('change',()=>{autoSelectSheet();loadCurrentSheet();toggleManualSection();});document.querySelectorAll('.admin-area').forEach(button=>button.addEventListener('click',()=>setAdminArea(button.dataset.adminArea)));$('manual-publish-btn').addEventListener('click',publishManual);$('manual-publish-d3-btn').addEventListener('click',publishManualD3);$('manual-publish-d2plan-btn')?.addEventListener('click',publishManualD2Plan);$('manual-add-d2plan-row')?.addEventListener('click',addPlanRow);document.addEventListener('click',event=>{if(event.target.classList.contains('plan-row-remove')){const tr=event.target.closest('tr');const tbody=tr?.parentElement;if(tbody&&tbody.children.length>1)tr.remove();}});$('apps-script-url').addEventListener('input',updatePublishState);$('download-csv-btn').addEventListener('click',downloadCsv);$('publish-btn').addEventListener('click',publish);$('save-config-btn').addEventListener('click',()=>{const url=$('apps-script-url').value.trim();if(!url){alert('No hay URL para guardar.');return;}localStorage.setItem(ADMIN_CONFIG_KEY,url);updatePublishState();alert('URL guardada en este navegador.');});}
  // La URL guardada en localStorage (de un "Guardar" anterior) ya NO tiene prioridad sobre
  // la que trae el codigo: cada vez que se redeploya el Apps Script, DEFAULT_UPLOAD_URL
  // cambia en core.js, pero el navegador seguia usando la vieja guardada indefinidamente
  // (confirmado: causaba publicaciones silenciosas a un deployment desactualizado, sin
  // ningun error visible). Ahora localStorage solo se usa como respaldo si el codigo no
  // trae ninguna URL default.
  document.addEventListener('DOMContentLoaded',()=>{initDashboardDefinitions();initAdminLock();fillDashboardSelect();const queryUrl=urlFromQuery();const saved=localStorage.getItem(ADMIN_CONFIG_KEY)||'';$('apps-script-url').value=queryUrl||DEFAULT_UPLOAD_URL||saved;if(queryUrl)localStorage.setItem(ADMIN_CONFIG_KEY,queryUrl);updatePublishState();refreshRuntimeVersion();setStatus([{type:'warn',title:'Esperando archivo',text:'Selecciona el dashboard y sube un Excel para iniciar validacion.',badge:'Pendiente'}]);bind();setAdminArea('rh');});
})();
