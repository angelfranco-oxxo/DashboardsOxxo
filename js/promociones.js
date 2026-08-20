(function(){
  'use strict';

  const TAB = OXXO.SHEETS_CONFIG.TABS.promos || 'Promociones';
  const grid = document.getElementById('promo-grid');
  const statusFilter = document.getElementById('promo-status');
  const categoryFilter = document.getElementById('promo-category');
  const lightbox = document.getElementById('promo-lightbox');
  let promotions = [];
  let lastTrigger = null;

  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const dayStart = date => new Date(date.getFullYear(),date.getMonth(),date.getDate());
  const today = dayStart(new Date());

  function valueByAlias(row, aliases){
    const lookup = new Map(Object.keys(row || {}).map(key => [norm(key),row[key]]));
    for(const alias of aliases){if(lookup.has(norm(alias))) return lookup.get(norm(alias));}
    return '';
  }

  function parseDate(value){
    if(value instanceof Date && !Number.isNaN(value.getTime())) return dayStart(value);
    const raw = String(value || '').trim();
    if(!raw) return null;
    if(/^\d{4}-\d{1,2}-\d{1,2}/.test(raw)){
      const [y,m,d] = raw.slice(0,10).split('-').map(Number); return new Date(y,m-1,d);
    }
    const match = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if(match){const year=Number(match[3])+(match[3].length===2?2000:0);return new Date(year,Number(match[2])-1,Number(match[1]));}
    if(/^\d+(?:\.\d+)?$/.test(raw)) return new Date(1899,11,30+Math.floor(Number(raw)));
    const parsed = new Date(raw); return Number.isNaN(parsed.getTime()) ? null : dayStart(parsed);
  }

  function formatDate(date){return date ? new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',year:'numeric'}).format(date) : 'Sin fecha';}
  function isActiveFlag(value){return !/^(no|false|falso|0|inactiva|inactivo|desactivada|desactivado)$/i.test(String(value || '').trim());}
  function safeImageUrl(value){
    const raw = String(value || '').trim();
    if(!raw) return '';
    const driveId = raw.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/)?.[1]
      || raw.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1];
    if(driveId) return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`;
    try{const url=new URL(raw);return /^https?:$/.test(url.protocol)?url.href:'';}catch(_){return '';}
  }

  function mapPromotion(row,index){
    const start = parseDate(valueByAlias(row,['Fecha inicio','Inicio','Desde']));
    const end = parseDate(valueByAlias(row,['Fecha fin','Fin','Hasta','Vigencia']));
    const active = isActiveFlag(valueByAlias(row,['Activa','Activo','Publicar','Visible']));
    let state = 'current';
    if(start && start>today) state='next';
    else if(!active || (end && end<today)) state='expired';
    const remaining = end ? Math.round((end-today)/86400000) : null;
    return {
      id:index,
      title:String(valueByAlias(row,['Título','Titulo','Promoción','Promocion','Nombre'])||`Promoción ${index+1}`).trim(),
      description:String(valueByAlias(row,['Descripción','Descripcion','Detalle','Texto'])||'').trim(),
      category:String(valueByAlias(row,['Categoría','Categoria','Tipo'])||'General').trim(),
      image:safeImageUrl(valueByAlias(row,['Imagen URL','Imagen','URL imagen','Liga imagen','Enlace','Enlace de imagen'])),
      start,end,active,state,remaining,
      order:Number(valueByAlias(row,['Orden','Prioridad']))||999
    };
  }

  function statusLabel(promo){
    if(promo.state==='next') return 'Próximamente';
    if(promo.remaining != null && promo.remaining>=0 && promo.remaining<=3) return 'Últimos días';
    return 'Vigente';
  }

  function dateLabel(promo){
    if(promo.start && promo.end) return `${formatDate(promo.start)} — ${formatDate(promo.end)}`;
    if(promo.end) return `Vigente hasta ${formatDate(promo.end)}`;
    if(promo.start) return `Disponible desde ${formatDate(promo.start)}`;
    return 'Vigencia abierta';
  }

  function cardHTML(promo,index){
    const dateClass=promo.state==='next'?'promo-card__soon':(promo.remaining!=null&&promo.remaining<=3?'promo-card__ending':'');
    return `<article class="promo-card" tabindex="0" role="button" data-promo-id="${promo.id}" aria-label="Ver promoción ${esc(promo.title)}" style="animation-delay:${Math.min(index,8)*45}ms">
      <div class="promo-card__media">
        <img src="${esc(promo.image)}" alt="${esc(promo.title)}" loading="lazy">
        <div class="promo-card__fallback"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-5-5L5 21"></path></svg></div>
        <span class="promo-card__tag">${esc(statusLabel(promo))}</span>
        <span class="promo-card__zoom"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4M11 8v6M8 11h6"></path></svg></span>
      </div>
      <div class="promo-card__body"><div class="promo-card__category">${esc(promo.category)}</div><h2>${esc(promo.title)}</h2><p class="promo-card__description">${esc(promo.description||'Consulta el material promocional y su periodo de vigencia.')}</p><div class="promo-card__dates ${dateClass}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg>${esc(dateLabel(promo))}</div></div>
    </article>`;
  }

  function attachImageFallbacks(){
    grid.querySelectorAll('.promo-card img').forEach(img=>{
      if(!img.getAttribute('src')) img.closest('.promo-card').classList.add('has-image-error');
      img.addEventListener('error',()=>img.closest('.promo-card').classList.add('has-image-error'),{once:true});
    });
  }

  function render(){
    const selectedStatus=statusFilter.value;
    const selectedCategory=categoryFilter.value;
    const data=promotions.filter(p=>{
      const statusMatch=selectedStatus==='all'?p.active:(p.state===selectedStatus&&p.active);
      return statusMatch&&(!selectedCategory||p.category===selectedCategory);
    }).sort((a,b)=>a.order-b.order||(a.start?.getTime()||0)-(b.start?.getTime()||0));
    document.getElementById('promo-results').textContent=`${data.length} ${data.length===1?'promoción':'promociones'}`;
    if(!data.length){grid.innerHTML=`<div class="promo-empty"><strong>No hay promociones para mostrar</strong><p>Prueba con otra categoría o cambia el filtro de vigencia.</p></div>`;return;}
    grid.innerHTML=data.map(cardHTML).join('');attachImageFallbacks();
  }

  function openLightbox(promo,trigger){
    if(!promo) return;
    lastTrigger=trigger;
    const image=document.getElementById('lightbox-image');
    const media=image.closest('.promo-lightbox__media');
    media.classList.toggle('is-empty',!promo.image);
    image.onerror=()=>media.classList.add('is-empty');
    image.src=promo.image;image.alt=promo.title;
    document.getElementById('lightbox-category').textContent=promo.category;
    document.getElementById('lightbox-title').textContent=promo.title;
    document.getElementById('lightbox-description').textContent=promo.description||'Material promocional vigente.';
    document.getElementById('lightbox-dates').textContent=dateLabel(promo);
    lightbox.classList.add('open');lightbox.setAttribute('aria-hidden','false');document.body.classList.add('promo-modal-open');
    setTimeout(()=>document.getElementById('lightbox-close').focus(),220);
  }
  function closeLightbox(){
    if(!lightbox.classList.contains('open')) return;
    lightbox.classList.remove('open');lightbox.setAttribute('aria-hidden','true');document.body.classList.remove('promo-modal-open');
    document.getElementById('lightbox-image').removeAttribute('src');if(lastTrigger) lastTrigger.focus();
  }

  function showSetup(){
    ['count-current','count-next','count-categories'].forEach(id=>document.getElementById(id).textContent='0');
    document.getElementById('promo-results').textContent='Configuración pendiente';
    grid.innerHTML=`<div class="promo-setup"><h2>Prepara la pestaña “Promociones”</h2><p>Créala en el Google Sheets principal y usa estos encabezados en la primera fila. Las imágenes de Drive deben tener acceso “Cualquier persona con el enlace”.</p><div class="promo-setup__columns"><code>Título</code><code>Imagen URL</code><code>Fecha inicio</code><code>Fecha fin</code><code>Categoría</code><code>Activa</code><code>Descripción</code><code>Orden</code></div></div>`;
  }

  async function init(){
    const rows=await OXXO.fetchSheetData(TAB);
    if(rows===null){OXXO.showError('promo-grid','Google Sheets no respondió. Puedes reintentar sin perder tu selección.');document.getElementById('promo-corte').innerHTML='<span></span>Sin conexión';return;}
    if(!rows.length){showSetup();document.getElementById('promo-corte').innerHTML='<span></span>Esperando configuración';return;}
    const populatedRows=rows.filter(row=>Object.values(row||{}).some(value=>String(value||'').trim()));
    promotions=populatedRows.map(mapPromotion);
    const categories=[...new Set(promotions.filter(p=>p.active).map(p=>p.category))].sort((a,b)=>a.localeCompare(b,'es'));
    categories.forEach(category=>{const option=document.createElement('option');option.value=category;option.textContent=category;categoryFilter.appendChild(option);});
    const current=promotions.filter(p=>p.active&&p.state==='current').length;
    const next=promotions.filter(p=>p.active&&p.state==='next').length;
    document.getElementById('count-current').textContent=current;
    document.getElementById('count-next').textContent=next;
    document.getElementById('count-categories').textContent=categories.length;
    document.getElementById('promo-corte').innerHTML=`<span></span>${current} ${current===1?'promoción vigente':'promociones vigentes'}`;
    OXXO.updateFooterTime('load-time');render();
  }

  statusFilter.addEventListener('change',render);categoryFilter.addEventListener('change',render);
  grid.addEventListener('click',event=>{const card=event.target.closest('.promo-card');if(card)openLightbox(promotions.find(p=>p.id===Number(card.dataset.promoId)),card);});
  grid.addEventListener('keydown',event=>{if(event.key!=='Enter'&&event.key!==' ')return;const card=event.target.closest('.promo-card');if(card){event.preventDefault();openLightbox(promotions.find(p=>p.id===Number(card.dataset.promoId)),card);}});
  document.getElementById('lightbox-close').addEventListener('click',closeLightbox);
  lightbox.addEventListener('click',event=>{if(event.target===lightbox)closeLightbox();});
  document.addEventListener('keydown',event=>{
    if(!lightbox.classList.contains('open')) return;
    if(event.key==='Escape'){closeLightbox();return;}
    if(event.key==='Tab'){event.preventDefault();document.getElementById('lightbox-close').focus();}
  });
  OXXO.setRetryHandler(init);
  document.addEventListener('DOMContentLoaded',init);
})();
