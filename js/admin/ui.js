/* ==========================================================
   OXXO ADMIN - UI Y RENDERIZADO
   Agrupa render de estados, vista previa y secciones manuales
   del panel admin. No modifica datos ni publica a Sheets.
   ========================================================== */

window.OXXO_ADMIN_UI = function createAdminUI(deps){
  const {$,escapeHtml,dashboard} = deps;
  let publicationToastTimer=null;

  function setStatus(items){$('status-list').innerHTML=items.map(item=>`<div class="status-item ${item.type}"><span class="status-dot"></span><div><div class="status-title">${escapeHtml(item.title)}</div><div class="status-sub">${escapeHtml(item.text)}</div></div><span class="status-badge">${escapeHtml(item.badge||'')}</span></div>`).join('');}

  function renderPreview(rows,headers){$('preview-meta').textContent=`${rows.length} filas en vista previa`;if(!rows.length||!headers.length){$('preview-table').innerHTML='<tbody><tr><td style="padding:28px;text-align:center;color:#7a4a42">Aun no hay datos para mostrar.</td></tr></tbody>';return;}const selectedHeaders=headers.slice(0,16);$('preview-table').innerHTML=`<thead><tr>${selectedHeaders.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${selectedHeaders.map(h=>`<td title="${escapeHtml(row[h])}">${escapeHtml(row[h])}</td>`).join('')}</tr>`).join('')}</tbody>`;}

  function renderPublishImpact({area='—',target='—',rows=0,columns=0,mode='—'}={}){
    if($('impact-area'))$('impact-area').textContent=area;
    if($('impact-target'))$('impact-target').textContent=target;
    if($('impact-rows'))$('impact-rows').textContent=`${Number(rows||0).toLocaleString('es-MX')} · ${Number(columns||0)} col.`;
    if($('impact-mode'))$('impact-mode').textContent=mode;
  }

  function showPublicationToast({type='ok',title='Publicación completada',facts=[]}={}){
    const toast=$('publication-toast');
    if(!toast)return;
    const isBad=type==='bad',isWarn=type==='warn';
    toast.classList.remove('bad','warn');
    if(isBad||isWarn)toast.classList.add(type);
    const icon=isBad?'!':isWarn?'!':'✓';
    const summary=isBad
      ?'No se modificaron los datos. Revisa el detalle antes de volver a intentar.'
      :isWarn
        ?'Los datos se guardaron; hay una comprobación pendiente por revisar.'
        :'Datos guardados y verificados en Google Sheets.';
    $('publication-toast-icon').textContent=icon;
    $('publication-toast-title').textContent=title;
    $('publication-toast-text').textContent=[summary,...(facts||[]).slice(0,2)].filter(Boolean).join(' · ');
    toast.classList.add('visible');
    if(publicationToastTimer)clearTimeout(publicationToastTimer);
    if(!isBad){publicationToastTimer=setTimeout(()=>toast.classList.remove('visible'),isWarn?11000:8000);}
    const close=$('publication-toast-close');
    if(close&&!close.dataset.bound){
      close.dataset.bound='1';
      close.addEventListener('click',()=>{
        toast.classList.remove('visible');
        if(publicationToastTimer)clearTimeout(publicationToastTimer);
      });
    }
  }

  function renderPublicationResult({type='ok',title='Resultado de publicación',area='—',text='',facts=[]}={}){
    const root=$('publication-result');
    if(!root)return;
    root.classList.remove('hidden','bad','warn');
    if(type==='bad'||type==='warn')root.classList.add(type);
    $('publication-result-title').textContent=title;
    $('publication-result-area').textContent=area;
    $('publication-result-text').textContent=text;
    $('publication-result-facts').innerHTML=(facts||[]).filter(Boolean).map(fact=>`<span>${escapeHtml(fact)}</span>`).join('');
    showPublicationToast({type,title,facts});
    root.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  // "Bajas otras plazas" (manual-entry-section) y "Aprovechamiento otras
  // plazas" (manual-entry-d3-section) ya no tienen su propia opcion en el
  // menu: se calculan solas al publicar "d2" (Bajas diarias) y "d3"
  // (Estructura) respectivamente, desde el mismo archivo. Los formularios
  // de 4 casillas se dejan visibles junto con su dashboard padre como
  // respaldo manual, por si hace falta corregir una plaza a mano.
  function toggleManualSection(){const key=dashboard().key;const sec=$('manual-entry-section');const sec3=$('manual-entry-d3-section');const secPlan=$('manual-entry-d2plan-section');if(sec)sec.classList.toggle('hidden',key!=='d2');if(sec3)sec3.classList.toggle('hidden',key!=='d3');if(secPlan)secPlan.classList.toggle('hidden',key!=='d2plan');}
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

  return {
    setStatus,
    renderPreview,
    renderPublishImpact,
    renderPublicationResult,
    toggleManualSection,
    addPlanRow
  };
};
