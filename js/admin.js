(function(){
  const ADMIN_CONFIG_KEY='oxxo_admin_apps_script_url';
  let adminPassword='';
  const PLAZA_TARGET='OAXACA';
  const DEFAULT_UPLOAD_URL=(window.OXXO&&OXXO.SHEETS_CONFIG&&OXXO.SHEETS_CONFIG.ADMIN_UPLOAD_URL)||'';

  let dashboards=[];

  const columnAliases=window.OXXO_ADMIN_COLUMN_ALIASES||{};

  const state={workbook:null,sheetName:'',fileName:'',rows:[],validation:null,headerRow:0,sourceRows:0,sourceHeaders:[]};
  let manualRows=[];
  const $=id=>document.getElementById(id);

  function norm(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9%]+/g,' ').trim().replace(/\s+/g,'');}
  function normLoose(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
  function aliasesFor(column){return [column,...(columnAliases[column]||[])].map(norm);}
  function initDashboardDefinitions(){
    if(typeof window.OXXO_ADMIN_DASHBOARDS!=='function'){
      throw new Error('No se cargo js/admin/dashboard-definitions.js');
    }
    dashboards=window.OXXO_ADMIN_DASHBOARDS({OXXO,containsOaxaca,isVacancyRow,deriveD1,deriveD2,deriveD2Denom,deriveD3,deriveD5,deriveD6,deriveD7,deriveCatalog});
  }
  function dashboard(){return dashboards.find(d=>d.key===$('dashboard-select').value)||dashboards[0];}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function isFetchBlocked(error){return /failed to fetch|load failed|networkerror|cors/i.test(String(error?.message||error||''));}
  async function postAdminPayload(payload){
    const url=publishUrl();
    if(!url)throw new Error('Falta configurar Apps Script.');
    try{
      const response=await fetch(url,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const result=await response.json().catch(()=>({ok:true}));
      if(result.ok===false)throw new Error(result.error||'Apps Script rechazo la publicacion');
      return result;
    }catch(error){
      if(!isFetchBlocked(error))throw error;
      await fetch(url,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
      return {ok:true,compatibilityMode:true};
    }
  }
  async function authenticateAdmin(password){
    if(!String(password||'').trim())throw new Error('Ingresa la contrasena.');
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
        adminPassword=password;
        input.value='';
        if(error)error.textContent='';
        lock.classList.add('hidden');
      }catch(err){
        if(error)error.textContent=err.message||'Contrasena incorrecta. Intenta de nuevo.';
        input.select();
      }
    });
  }
  function setStatus(items){$('status-list').innerHTML=items.map(item=>`<div class="status-item ${item.type}"><span class="status-dot"></span><div><div class="status-title">${escapeHtml(item.title)}</div><div class="status-sub">${escapeHtml(item.text)}</div></div><span class="status-badge">${escapeHtml(item.badge||'')}</span></div>`).join('');}
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
    findHeaderRow,
    buildSourceMap,
    matchColumns,
    rowsFromMatrix,
    evaluateSheet,
    autoSelectSheet,
    periodInfo
  } = window.OXXO_ADMIN_NORMALIZERS({state,norm,normLoose,aliasesFor,dashboard,$});

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
    renderPreview(nonEmpty.slice(0,80),dash.output);
  }
  function renderPreview(rows,headers){$('preview-meta').textContent=`${rows.length} filas en vista previa`;if(!rows.length||!headers.length){$('preview-table').innerHTML='<tbody><tr><td style="padding:28px;text-align:center;color:#7a4a42">Aun no hay datos para mostrar.</td></tr></tbody>';return;}const selectedHeaders=headers.slice(0,16);$('preview-table').innerHTML=`<thead><tr>${selectedHeaders.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${selectedHeaders.map(h=>`<td title="${escapeHtml(row[h])}">${escapeHtml(row[h])}</td>`).join('')}</tr>`).join('')}</tbody>`;}
  function fillDashboardSelect(){$('dashboard-select').innerHTML=dashboards.map(d=>`<option value="${d.key}">${d.label}</option>`).join('');}
  function fillSheets(){const names=state.workbook?state.workbook.SheetNames:[];$('sheet-select').disabled=!names.length;$('sheet-select').innerHTML=names.length?names.map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join(''):'<option value="">Sube un Excel primero</option>';state.sheetName=names[0]||'';autoSelectSheet();}
  function loadCurrentSheet(){if(!state.workbook||!state.sheetName)return;const dash=dashboard(),sheet=state.workbook.Sheets[state.sheetName],matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false});const parsed=rowsFromMatrix(matrix,dash);state.rows=parsed.rows;state.headerRow=parsed.headerRow;state.sourceRows=parsed.sourceRows;state.sourceHeaders=parsed.sourceHeaders;validateRows();}
  // codepage:65001 (UTF-8) evita que un .csv con acentos salga con mojibake
  // (ej. "MÃ¡rquez" en vez de "Márquez") — XLSX.js sin esto puede asumir otra
  // codificacion para archivos .csv (los .xlsx no se ven afectados, ya traen
  // su propia codificacion declarada).
  async function handleFile(file){if(!file)return;state.fileName=file.name||'';const buffer=await file.arrayBuffer();state.workbook=XLSX.read(buffer,{type:'array',cellDates:true,codepage:65001});$('file-meta').textContent=`${file.name} - ${(file.size/1024/1024).toFixed(2)} MB`;fillSheets();loadCurrentSheet();}
  function downloadCsv(){if(!state.rows.length)return;const dash=dashboard();OXXO.downloadRowsAsCSV(state.rows,`${dash.key}-${dash.tab}.csv`,dash.output);}
  function publishUrl(){return $('apps-script-url').value.trim()||DEFAULT_UPLOAD_URL;}
  // Despues de un publish exitoso, avisa al Apps Script que escriba la fecha
  // de hoy en la fila de este dashboard dentro de la hoja Configuracion —
  // asi "Ultima actualizacion" en la portada (index.html) ya no depende de
  // que alguien la edite a mano, siempre queda igual al ultimo publish real.
  // Fire-and-forget: si falla, no rompe el flujo de publicacion (que ya tuvo
  // exito antes de llegar aqui) ni se le muestra error extra al usuario.
  function notifyConfigDate(dashKey){
    const url=publishUrl();if(!url)return;
    const configId=(String(dashKey||'').match(/^[ds]\d/)||[])[0];
    if(!configId)return;
    fetch(url,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'updateConfigDate',adminPassword,dashboardId:configId})}).catch(()=>{});
  }
  function updatePublishState(){const el=$('publish-state');if(!el)return;const ready=Boolean(publishUrl());el.textContent=ready?'Publicacion directa lista':'Falta configurar Apps Script una sola vez';el.classList.toggle('ready',ready);}
  function urlFromQuery(){try{return new URLSearchParams(location.search).get('uploadUrl')||'';}catch(_){return ''}}
  async function publish(){const url=publishUrl();if(!url){alert('Falta configurar Apps Script una sola vez. Mientras tanto puedes descargar CSV.');return;}if(!state.validation?.ok){alert('La base aun tiene errores de validacion.');return;}const dash=dashboard(),period=periodInfo(dash,state.validation.rows);$('publish-btn').disabled=true;$('publish-btn').textContent='Publicando...';try{const payload={adminPassword,targetSheet:dash.tab,rows:state.validation.rows,source:'DashboardsOxxo Admin',updateMode:period.enabled?'replacePeriod':'replaceAll',periodColumn:period.column,periodValues:period.values};const result=await postAdminPayload(payload);notifyConfigDate(dash.key);alert(result.compatibilityMode?`Solicitud enviada en modo compatible a ${dash.tab}. Espera unos segundos y valida el dashboard.`:`Base publicada correctamente en ${dash.tab}. ${period.enabled?'Periodo actualizado: '+period.values.join(', '):'Pestana reemplazada completa'}.`);}catch(error){alert('No se pudo publicar. Descarga el CSV o revisa la URL de Apps Script.');console.error(error);}finally{$('publish-btn').disabled=false;$('publish-btn').textContent='Publicar en Sheets';}}
  function toggleManualSection(){const key=dashboard().key;const sec=$('manual-entry-section');const sec3=$('manual-entry-d3-section');const secPlan=$('manual-entry-d2plan-section');if(sec)sec.classList.toggle('hidden',key!=='d2otras');if(sec3)sec3.classList.toggle('hidden',key!=='d3plazas');if(secPlan)secPlan.classList.toggle('hidden',key!=='d2plan');}
  function planRowHTML(){return `<tr class="plan-row">
    <td><textarea class="admin-input" rows="2" data-field="Hallazgo" placeholder="Hallazgo relacionado"></textarea></td>
    <td><textarea class="admin-input" rows="2" data-field="Accion" placeholder="Accion propuesta"></textarea></td>
    <td><input class="admin-input" type="text" data-field="Responsable" placeholder="Responsable" /></td>
    <td><input class="admin-input" type="text" data-field="Plazo" placeholder="Plazo" /></td>
    <td><input class="admin-input" type="text" data-field="Indicador" placeholder="Indicador de exito" /></td>
    <td>
      <select class="admin-input" data-field="Prioridad"><option value="Alta">Alta</option><option value="Media" selected>Media</option><option value="Baja">Baja</option></select>
      <button type="button" class="admin-btn plan-row-remove" title="Eliminar fila" style="margin-top:6px;padding:4px 10px">Quitar</button>
    </td>
  </tr>`;}
  function addPlanRow(){const tbody=$('manual-input-d2plan')?.querySelector('tbody');if(!tbody)return;tbody.insertAdjacentHTML('beforeend',planRowHTML());}
  async function publishManualD2Plan(){
    const url=publishUrl();if(!url){alert('Falta configurar Apps Script.');return;}
    const rowEls=[...document.querySelectorAll('#manual-input-d2plan .plan-row')];
    const rows=rowEls.map(tr=>{
      const get=field=>tr.querySelector(`[data-field="${field}"]`)?.value.trim()||'';
      return {Hallazgo:get('Hallazgo'),Accion:get('Accion'),Responsable:get('Responsable'),Plazo:get('Plazo'),Indicador:get('Indicador'),Prioridad:get('Prioridad')||'Media',Actualizado:isoDate(new Date())};
    }).filter(r=>r.Hallazgo&&r.Accion);
    if(!rows.length){alert('Captura al menos una fila con Hallazgo y Accion.');return;}
    const dash=dashboards.find(d=>d.key==='d2plan');
    const btn=$('manual-publish-d2plan-btn');btn.disabled=true;btn.textContent='Publicando...';
    try{
      const payload={adminPassword,targetSheet:dash.tab,rows,source:'DashboardsOxxo Admin Manual',updateMode:'replaceAll'};
      const result=await postAdminPayload(payload);
      notifyConfigDate(dash.key);
      alert(`${rows.length} fila(s) del plan de accion publicadas en ${dash.tab}.`);
    }catch(error){alert('No se pudo publicar: '+error.message);console.error(error);}
    finally{btn.disabled=false;btn.textContent='Publicar';}
  }
  async function publishManual(){const url=publishUrl();if(!url){alert('Falta configurar Apps Script.');return;}const inputs=document.querySelectorAll('#manual-input-table [data-plaza]');const rows=[...inputs].filter(inp=>inp.value&&Number(inp.value)>0).map(inp=>({'Plazas':inp.dataset.plaza,'Bajas Plaza':inp.value,'Actualizado':isoDate(new Date())})).sort((a,b)=>Number(b['Bajas Plaza'])-Number(a['Bajas Plaza']));if(!rows.length){alert('Ingresa al menos una plaza con bajas mayor a 0.');return;}const dash=dashboard();const btn=$('manual-publish-btn');btn.disabled=true;btn.textContent='Publicando...';try{const payload={adminPassword,targetSheet:dash.tab,rows,source:'DashboardsOxxo Admin Manual',updateMode:'replaceAll'};const result=await postAdminPayload(payload);notifyConfigDate(dash.key);alert(result.compatibilityMode?`Solicitud enviada en modo compatible a ${dash.tab}. Espera unos segundos y valida el dashboard.`:`${rows.length} plaza(s) publicadas en ${dash.tab}.`);}catch(error){alert('No se pudo publicar: '+error.message);console.error(error);}finally{btn.disabled=false;btn.textContent='Publicar';}}
  async function publishManualD3(){const url=publishUrl();if(!url){alert('Falta configurar Apps Script.');return;}const inputs=document.querySelectorAll('#manual-input-d3 [data-plaza]');const rows=[...inputs].filter(inp=>inp.value&&Number(inp.value)>0).map(inp=>({'PLAZAS':inp.dataset.plaza,'Aprovechamiento de estructura a hoy':inp.value,'Actualizado':isoDate(new Date())})).sort((a,b)=>Number(b['Aprovechamiento de estructura a hoy'])-Number(a['Aprovechamiento de estructura a hoy']));if(!rows.length){alert('Ingresa al menos una plaza con aprovechamiento mayor a 0.');return;}const dash=dashboard();const btn=$('manual-publish-d3-btn');btn.disabled=true;btn.textContent='Publicando...';try{const payload={adminPassword,targetSheet:dash.tab,rows,source:'DashboardsOxxo Admin Manual',updateMode:'replaceAll'};const result=await postAdminPayload(payload);notifyConfigDate(dash.key);alert(result.compatibilityMode?`Solicitud enviada en modo compatible a ${dash.tab}. Espera unos segundos y valida el dashboard.`:`${rows.length} plaza(s) publicadas en ${dash.tab}.`);}catch(error){alert('No se pudo publicar: '+error.message);console.error(error);}finally{btn.disabled=false;btn.textContent='Publicar';}}
  function bind(){$('drop-zone').addEventListener('click',()=>$('file-input').click());$('file-input').addEventListener('change',event=>handleFile(event.target.files[0]));['dragenter','dragover'].forEach(ev=>$('drop-zone').addEventListener(ev,event=>{event.preventDefault();$('drop-zone').classList.add('drag');}));['dragleave','drop'].forEach(ev=>$('drop-zone').addEventListener(ev,event=>{event.preventDefault();$('drop-zone').classList.remove('drag');}));$('drop-zone').addEventListener('drop',event=>handleFile(event.dataTransfer.files[0]));$('sheet-select').addEventListener('change',event=>{state.sheetName=event.target.value;loadCurrentSheet();});$('dashboard-select').addEventListener('change',()=>{autoSelectSheet();loadCurrentSheet();toggleManualSection();});$('manual-publish-btn').addEventListener('click',publishManual);$('manual-publish-d3-btn').addEventListener('click',publishManualD3);$('manual-publish-d2plan-btn')?.addEventListener('click',publishManualD2Plan);$('manual-add-d2plan-row')?.addEventListener('click',addPlanRow);document.addEventListener('click',event=>{if(event.target.classList.contains('plan-row-remove')){const tr=event.target.closest('tr');const tbody=tr?.parentElement;if(tbody&&tbody.children.length>1)tr.remove();}});$('apps-script-url').addEventListener('input',updatePublishState);$('download-csv-btn').addEventListener('click',downloadCsv);$('publish-btn').addEventListener('click',publish);$('save-config-btn').addEventListener('click',()=>{const url=$('apps-script-url').value.trim();if(!url){alert('No hay URL para guardar.');return;}localStorage.setItem(ADMIN_CONFIG_KEY,url);updatePublishState();alert('URL guardada en este navegador.');});}
  // La URL guardada en localStorage (de un "Guardar" anterior) ya NO tiene prioridad sobre
  // la que trae el codigo: cada vez que se redeploya el Apps Script, DEFAULT_UPLOAD_URL
  // cambia en core.js, pero el navegador seguia usando la vieja guardada indefinidamente
  // (confirmado: causaba publicaciones silenciosas a un deployment desactualizado, sin
  // ningun error visible). Ahora localStorage solo se usa como respaldo si el codigo no
  // trae ninguna URL default.
  document.addEventListener('DOMContentLoaded',()=>{initDashboardDefinitions();initAdminLock();fillDashboardSelect();const queryUrl=urlFromQuery();const saved=localStorage.getItem(ADMIN_CONFIG_KEY)||'';$('apps-script-url').value=queryUrl||DEFAULT_UPLOAD_URL||saved;if(queryUrl)localStorage.setItem(ADMIN_CONFIG_KEY,queryUrl);updatePublishState();setStatus([{type:'warn',title:'Esperando archivo',text:'Selecciona el dashboard y sube un Excel para iniciar validacion.',badge:'Pendiente'}]);bind();toggleManualSection();});
})();
