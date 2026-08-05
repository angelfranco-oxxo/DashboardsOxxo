/* ==========================================================
   OXXO ADMIN - UI Y RENDERIZADO
   Agrupa render de estados, vista previa y secciones manuales
   del panel admin. No modifica datos ni publica a Sheets.
   ========================================================== */

window.OXXO_ADMIN_UI = function createAdminUI(deps){
  const {$,escapeHtml,dashboard} = deps;

  function setStatus(items){$('status-list').innerHTML=items.map(item=>`<div class="status-item ${item.type}"><span class="status-dot"></span><div><div class="status-title">${escapeHtml(item.title)}</div><div class="status-sub">${escapeHtml(item.text)}</div></div><span class="status-badge">${escapeHtml(item.badge||'')}</span></div>`).join('');}

  function renderPreview(rows,headers){$('preview-meta').textContent=`${rows.length} filas en vista previa`;if(!rows.length||!headers.length){$('preview-table').innerHTML='<tbody><tr><td style="padding:28px;text-align:center;color:#7a4a42">Aun no hay datos para mostrar.</td></tr></tbody>';return;}const selectedHeaders=headers.slice(0,16);$('preview-table').innerHTML=`<thead><tr>${selectedHeaders.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${selectedHeaders.map(h=>`<td title="${escapeHtml(row[h])}">${escapeHtml(row[h])}</td>`).join('')}</tr>`).join('')}</tbody>`;}

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

  return {
    setStatus,
    renderPreview,
    toggleManualSection,
    addPlanRow
  };
};
