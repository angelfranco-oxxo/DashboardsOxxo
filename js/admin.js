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
  const {setStatus,renderPreview,toggleManualSection,addPlanRow} = window.OXXO_ADMIN_UI({$,escapeHtml,dashboard});
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
  // d2otras (Bajas otras plazas) y d2denom (Movimientos ABC) ya no aparecen
  // en el menu: se calculan solos al publicar "Bajas diarias" (mismo
  // archivo, cada uno con su propia hoja -- "Bajas" y "ABC"), asi no hay que
  // subir el Excel varias veces. Las definiciones siguen vivas en
  // dashboards[] para que publish() las reutilice.
  const HIDDEN_FROM_MENU=['d2otras','d2denom'];
  function fillDashboardSelect(){$('dashboard-select').innerHTML=dashboards.filter(d=>!HIDDEN_FROM_MENU.includes(d.key)).map(d=>`<option value="${d.key}">${d.label}</option>`).join('');}
  function fillSheets(){const names=state.workbook?state.workbook.SheetNames:[];$('sheet-select').disabled=!names.length;$('sheet-select').innerHTML=names.length?names.map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join(''):'<option value="">Sube un Excel primero</option>';state.sheetName=names[0]||'';autoSelectSheet();}
  function loadCurrentSheet(){if(!state.workbook||!state.sheetName)return;const dash=dashboard(),sheet=state.workbook.Sheets[state.sheetName],matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false});const parsed=rowsFromMatrix(matrix,dash);state.rows=parsed.rows;state.headerRow=parsed.headerRow;state.sourceRows=parsed.sourceRows;state.sourceHeaders=parsed.sourceHeaders;validateRows();}
  // codepage:65001 (UTF-8) evita que un .csv con acentos salga con mojibake
  // (ej. "MÃ¡rquez" en vez de "Márquez") — XLSX.js sin esto puede asumir otra
  // codificacion para archivos .csv (los .xlsx no se ven afectados, ya traen
  // su propia codificacion declarada).
  async function handleFile(file){if(!file)return;state.fileName=file.name||'';const buffer=await file.arrayBuffer();state.workbook=XLSX.read(buffer,{type:'array',cellDates:true,codepage:65001});$('file-meta').textContent=`${file.name} - ${(file.size/1024/1024).toFixed(2)} MB`;fillSheets();loadCurrentSheet();}
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
  } = window.OXXO_ADMIN_PUBLISHERS({$,state,OXXO,DEFAULT_UPLOAD_URL,dashboard,getDashboards:()=>dashboards,periodInfo,isoDate,getAdminPassword:()=>adminPassword,rowsFromMatrix});
  function bind(){$('drop-zone').addEventListener('click',()=>$('file-input').click());$('file-input').addEventListener('change',event=>handleFile(event.target.files[0]));['dragenter','dragover'].forEach(ev=>$('drop-zone').addEventListener(ev,event=>{event.preventDefault();$('drop-zone').classList.add('drag');}));['dragleave','drop'].forEach(ev=>$('drop-zone').addEventListener(ev,event=>{event.preventDefault();$('drop-zone').classList.remove('drag');}));$('drop-zone').addEventListener('drop',event=>handleFile(event.dataTransfer.files[0]));$('sheet-select').addEventListener('change',event=>{state.sheetName=event.target.value;loadCurrentSheet();});$('dashboard-select').addEventListener('change',()=>{autoSelectSheet();loadCurrentSheet();toggleManualSection();});$('manual-publish-btn').addEventListener('click',publishManual);$('manual-publish-d3-btn').addEventListener('click',publishManualD3);$('manual-publish-d2plan-btn')?.addEventListener('click',publishManualD2Plan);$('manual-add-d2plan-row')?.addEventListener('click',addPlanRow);document.addEventListener('click',event=>{if(event.target.classList.contains('plan-row-remove')){const tr=event.target.closest('tr');const tbody=tr?.parentElement;if(tbody&&tbody.children.length>1)tr.remove();}});$('apps-script-url').addEventListener('input',updatePublishState);$('download-csv-btn').addEventListener('click',downloadCsv);$('publish-btn').addEventListener('click',publish);$('save-config-btn').addEventListener('click',()=>{const url=$('apps-script-url').value.trim();if(!url){alert('No hay URL para guardar.');return;}localStorage.setItem(ADMIN_CONFIG_KEY,url);updatePublishState();alert('URL guardada en este navegador.');});}
  // La URL guardada en localStorage (de un "Guardar" anterior) ya NO tiene prioridad sobre
  // la que trae el codigo: cada vez que se redeploya el Apps Script, DEFAULT_UPLOAD_URL
  // cambia en core.js, pero el navegador seguia usando la vieja guardada indefinidamente
  // (confirmado: causaba publicaciones silenciosas a un deployment desactualizado, sin
  // ningun error visible). Ahora localStorage solo se usa como respaldo si el codigo no
  // trae ninguna URL default.
  document.addEventListener('DOMContentLoaded',()=>{initDashboardDefinitions();initAdminLock();fillDashboardSelect();const queryUrl=urlFromQuery();const saved=localStorage.getItem(ADMIN_CONFIG_KEY)||'';$('apps-script-url').value=queryUrl||DEFAULT_UPLOAD_URL||saved;if(queryUrl)localStorage.setItem(ADMIN_CONFIG_KEY,queryUrl);updatePublishState();setStatus([{type:'warn',title:'Esperando archivo',text:'Selecciona el dashboard y sube un Excel para iniciar validacion.',badge:'Pendiente'}]);bind();toggleManualSection();});
})();
