/* ==========================================================
   OXXO ADMIN - PUBLICACION Y DESCARGAS
   Agrupa descarga CSV, POST a Apps Script y publicaciones
   manuales sin cambiar el flujo visual del panel admin.
   ========================================================== */

window.OXXO_ADMIN_PUBLISHERS = function createAdminPublishers(deps){
  const {
    $,
    state,
    OXXO,
    DEFAULT_UPLOAD_URL,
    dashboard,
    getDashboards,
    periodInfo,
    isoDate,
    getAdminPassword,
    rowsFromMatrix,
    getSheetMatrix
  } = deps;

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
    fetch(url,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'updateConfigDate',adminPassword:getAdminPassword(),dashboardId:configId})}).catch(()=>{});
  }
  function updatePublishState(){const el=$('publish-state');if(!el)return;const ready=Boolean(publishUrl());el.textContent=ready?'Publicacion directa lista':'Falta configurar Apps Script una sola vez';el.classList.toggle('ready',ready);}

  // Dashboards que ya no tienen su propia opcion en el menu porque salen del
  // MISMO archivo que ya se sube para su dashboard "padre": Bajas otras
  // plazas y Movimientos ABC salen del mismo Excel de d2 (hojas "Bajas" y
  // "ABC"); Aprovechamiento otras plazas sale del mismo Excel de d3 (hoja
  // "PLAZAS"). Al publicar el padre se recalculan y publican solos, cada
  // uno buscando su propia hoja preferida dentro del workbook ya cargado
  // (no necesariamente la misma hoja seleccionada para el padre). Si alguno
  // falla no se revierte el publish del padre (que ya tuvo exito): solo se
  // avisa aparte.
  const AUTO_PUBLISH_MAP={d2:['d2otras','d2denom'],d3:['d3plazas']};
  function findSheetInWorkbook(preferredNames){
    const names=state.workbook?.SheetNames||[];
    for(const preferred of preferredNames||[]){
      const found=names.find(n=>n.trim().toLowerCase()===String(preferred).trim().toLowerCase());
      if(found)return found;
    }
    return '';
  }
  async function publishAutoFor(parentKey){
    if(!state.workbook)return [];
    const keys=AUTO_PUBLISH_MAP[parentKey]||[];
    const publicados=[];
    for(const key of keys){
      const dashDef=getDashboards().find(d=>d.key===key);
      if(!dashDef)continue;
      const sheetName=findSheetInWorkbook(dashDef.preferredSheets)||state.sheetName;
      if(!sheetName)continue;
      const matrix=getSheetMatrix(sheetName);
      if(!matrix.length)continue;
      const parsed=rowsFromMatrix(matrix,dashDef);
      if(!parsed.rows.length)continue;
      await postAdminPayload({adminPassword:getAdminPassword(),targetSheet:dashDef.tab,rows:parsed.rows,source:`DashboardsOxxo Admin (auto desde ${parentKey})`,updateMode:'replaceAll'});
      notifyConfigDate(dashDef.key);
      publicados.push({label:dashDef.label,count:parsed.rows.length});
    }
    return publicados;
  }

  async function publish(){
    const url=publishUrl();
    if(!url){alert('Falta configurar Apps Script una sola vez. Mientras tanto puedes descargar CSV.');return;}
    if(!state.validation?.ok){alert('La base aun tiene errores de validacion.');return;}
    const dash=dashboard(),period=periodInfo(dash,state.validation.rows);
    $('publish-btn').disabled=true;$('publish-btn').textContent='Publicando...';
    try{
      const payload={adminPassword:getAdminPassword(),targetSheet:dash.tab,rows:state.validation.rows,source:'DashboardsOxxo Admin',updateMode:period.enabled?'replacePeriod':'replaceAll',periodColumn:period.column,periodValues:period.values};
      const result=await postAdminPayload(payload);
      notifyConfigDate(dash.key);
      let autoMsg='';
      if(AUTO_PUBLISH_MAP[dash.key]){
        try{
          const publicados=await publishAutoFor(dash.key);
          if(publicados.length)autoMsg=' Tambien se actualizaron: '+publicados.map(p=>`${p.label} (${p.count})`).join(', ')+'.';
        }catch(autoError){
          console.error(`No se pudo publicar los dashboards derivados de ${dash.key} automaticamente:`,autoError);
          autoMsg=' Ojo: no se pudieron actualizar los dashboards derivados, revisalos aparte si hace falta.';
        }
      }
      alert((result.compatibilityMode?`Solicitud enviada en modo compatible a ${dash.tab}. Espera unos segundos y valida el dashboard.`:`Base publicada correctamente en ${dash.tab}. ${period.enabled?'Periodo actualizado: '+period.values.join(', '):'Pestana reemplazada completa'}.`)+autoMsg);
    }catch(error){
      alert('No se pudo publicar. Descarga el CSV o revisa la URL de Apps Script.');
      console.error(error);
    }finally{
      $('publish-btn').disabled=false;$('publish-btn').textContent='Publicar en Sheets';
    }
  }

  async function publishManualD2Plan(){
    const url=publishUrl();if(!url){alert('Falta configurar Apps Script.');return;}
    const rowEls=[...document.querySelectorAll('#manual-input-d2plan .plan-row')];
    const rows=rowEls.map(tr=>{
      const get=field=>tr.querySelector(`[data-field="${field}"]`)?.value.trim()||'';
      return {Hallazgo:get('Hallazgo'),Accion:get('Accion'),Responsable:get('Responsable'),Plazo:get('Plazo'),Indicador:get('Indicador'),Prioridad:get('Prioridad')||'Media',Actualizado:isoDate(new Date())};
    }).filter(r=>r.Hallazgo&&r.Accion);
    if(!rows.length){alert('Captura al menos una fila con Hallazgo y Accion.');return;}
    const dash=getDashboards().find(d=>d.key==='d2plan');
    const btn=$('manual-publish-d2plan-btn');btn.disabled=true;btn.textContent='Publicando...';
    try{
      const payload={adminPassword:getAdminPassword(),targetSheet:dash.tab,rows,source:'DashboardsOxxo Admin Manual',updateMode:'replaceAll'};
      const result=await postAdminPayload(payload);
      notifyConfigDate(dash.key);
      alert(`${rows.length} fila(s) del plan de accion publicadas en ${dash.tab}.`);
    }catch(error){alert('No se pudo publicar: '+error.message);console.error(error);}
    finally{btn.disabled=false;btn.textContent='Publicar';}
  }

  async function publishManual(){const url=publishUrl();if(!url){alert('Falta configurar Apps Script.');return;}const inputs=document.querySelectorAll('#manual-input-table [data-plaza]');const rows=[...inputs].filter(inp=>inp.value&&Number(inp.value)>0).map(inp=>({'Plazas':inp.dataset.plaza,'Bajas Plaza':inp.value,'Actualizado':isoDate(new Date())})).sort((a,b)=>Number(b['Bajas Plaza'])-Number(a['Bajas Plaza']));if(!rows.length){alert('Ingresa al menos una plaza con bajas mayor a 0.');return;}const dash=dashboard();const btn=$('manual-publish-btn');btn.disabled=true;btn.textContent='Publicando...';try{const payload={adminPassword:getAdminPassword(),targetSheet:dash.tab,rows,source:'DashboardsOxxo Admin Manual',updateMode:'replaceAll'};const result=await postAdminPayload(payload);notifyConfigDate(dash.key);alert(result.compatibilityMode?`Solicitud enviada en modo compatible a ${dash.tab}. Espera unos segundos y valida el dashboard.`:`${rows.length} plaza(s) publicadas en ${dash.tab}.`);}catch(error){alert('No se pudo publicar: '+error.message);console.error(error);}finally{btn.disabled=false;btn.textContent='Publicar';}}

  async function publishManualD3(){const url=publishUrl();if(!url){alert('Falta configurar Apps Script.');return;}const inputs=document.querySelectorAll('#manual-input-d3 [data-plaza]');const rows=[...inputs].filter(inp=>inp.value&&Number(inp.value)>0).map(inp=>({'PLAZAS':inp.dataset.plaza,'Aprovechamiento de estructura a hoy':inp.value,'Actualizado':isoDate(new Date())})).sort((a,b)=>Number(b['Aprovechamiento de estructura a hoy'])-Number(a['Aprovechamiento de estructura a hoy']));if(!rows.length){alert('Ingresa al menos una plaza con aprovechamiento mayor a 0.');return;}const dash=dashboard();const btn=$('manual-publish-d3-btn');btn.disabled=true;btn.textContent='Publicando...';try{const payload={adminPassword:getAdminPassword(),targetSheet:dash.tab,rows,source:'DashboardsOxxo Admin Manual',updateMode:'replaceAll'};const result=await postAdminPayload(payload);notifyConfigDate(dash.key);alert(result.compatibilityMode?`Solicitud enviada en modo compatible a ${dash.tab}. Espera unos segundos y valida el dashboard.`:`${rows.length} plaza(s) publicadas en ${dash.tab}.`);}catch(error){alert('No se pudo publicar: '+error.message);console.error(error);}finally{btn.disabled=false;btn.textContent='Publicar';}}

  return {
    downloadCsv,
    publishUrl,
    postAdminPayload,
    notifyConfigDate,
    updatePublishState,
    publish,
    publishManual,
    publishManualD3,
    publishManualD2Plan
  };
};
