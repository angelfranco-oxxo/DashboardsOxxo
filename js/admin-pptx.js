(function(){
  function findKey(row, aliases){
    const clean = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
    const keys = Object.keys(row||{});
    const map = new Map(keys.map(k => [clean(k), k]));
    for(const a of aliases){ const found = map.get(clean(a)); if(found) return found; }
    for(const a of aliases){ const ca = clean(a); const found = keys.find(k => clean(k).includes(ca) || ca.includes(clean(k))); if(found) return found; }
    return null;
  }
  function val(row, key, fallback=''){ const v = key ? row[key] : undefined; return (v===undefined||v===null||String(v).trim()==='') ? fallback : v; }
  function num(v){ const n = Number(String(v??'').replace(/[$,%]/g,'').replace(/,/g,'').trim()); return Number.isFinite(n) ? n : 0; }
  function normText(v){ return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase(); }
  function latestByKey(rows, key){
    const vals = [...new Set(rows.map(r => String(r[key]||'').trim()).filter(Boolean))];
    return vals.sort().slice(-1)[0] || '';
  }

  async function kpiD1(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d1);
    if(!raw || !raw.length) return null;
    const mesKey = findKey(raw[0], ['Mes']);
    const mes = latestByKey(raw, mesKey);
    const filtered = mes ? raw.filter(r => String(r[mesKey]||'').trim() === mes) : raw;
    return { label: 'Total Vacantes', value: String(filtered.length), sub: mes ? `Mes ${mes}` : 'Plaza Oaxaca' };
  }

  async function kpiD2(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d2);
    if(!raw || !raw.length) return null;
    const mesKey = findKey(raw[0], ['Mes']);
    const asesorKey = findKey(raw[0], ['Asesor']);
    const puestoKey = findKey(raw[0], ['Puesto']);
    const mes = latestByKey(raw, mesKey);
    const rows = raw.filter(r => {
      if(mes && String(r[mesKey]||'').trim() !== mes) return false;
      const asesor = normText(val(r, asesorKey));
      if(!asesor || asesor.includes('SIN ASESOR') || asesor.replace(/[^A-Z]/g,'') === 'TIMOTEOANTONIOPEREZ') return false;
      const puesto = normText(val(r, puestoKey));
      return puesto.includes('AYUDANTE') || puesto.includes('ENCARGADO') || puesto.includes('LIDER');
    });
    return { label: 'Total de Bajas', value: String(rows.length), sub: mes ? `Mes ${mes}` : 'Plaza Oaxaca' };
  }

  async function kpiD3(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d3);
    if(!raw || !raw.length) return null;
    const estatusKey = findKey(raw[0], ['Clas Aprov','Estatus Con impacto Ausentismo','Estatus']);
    const total = raw.length;
    const completas = raw.filter(r => {
      const s = normText(val(r, estatusKey));
      return s.includes('COMPLETO') && !s.includes('INCOMPLETO') && !s.includes('CRIT');
    }).length;
    const pct = total > 0 ? (completas / total * 100) : 0;
    return { label: 'Aprovechamiento General', value: pct.toFixed(2) + '%', sub: 'Plaza Oaxaca' };
  }

  async function kpiD4(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.s4);
    if(!raw || !raw.length) return null;
    const semanaKey = findKey(raw[0], ['Semana']);
    const horasKey = findKey(raw[0], ['Cantidad']);
    const semana = latestByKey(raw, semanaKey);
    const rows = semana ? raw.filter(r => String(r[semanaKey]||'').trim() === semana) : raw;
    const totalHoras = rows.reduce((s,r) => s + num(val(r, horasKey)), 0);
    return { label: 'Total Horas TE', value: OXXO.formatNum(totalHoras), sub: semana ? `Semana ${semana}` : 'Plaza Oaxaca' };
  }

  async function kpiD6(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.s6);
    if(!raw || !raw.length) return null;
    const semanaKey = findKey(raw[0], ['Semana']);
    const diasKey = findKey(raw[0], ['Dias']);
    const semana = latestByKey(raw, semanaKey);
    const rows = semana ? raw.filter(r => String(r[semanaKey]||'').trim() === semana) : raw;
    const totalDias = rows.reduce((s,r) => s + num(val(r, diasKey)), 0);
    return { label: 'Días Ausentes', value: OXXO.formatNum(Math.round(totalDias)), sub: semana ? `Semana ${semana}` : 'Plaza Oaxaca' };
  }

  async function kpiD7(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.s7);
    if(!raw || !raw.length) return null;
    const difKey = findKey(raw[0], ['Dif SAP vs Est Optima Final']);
    const total = raw.length;
    const alineadas = raw.filter(r => num(val(r, difKey)) === 0).length;
    const pct = total > 0 ? (alineadas / total * 100) : 0;
    return { label: 'Alineación Global TREO', value: pct.toFixed(1) + '%', sub: 'Plaza Oaxaca' };
  }

  const DASHBOARDS = [
    { name: 'Dashboard 1 · Vacantes', fn: kpiD1 },
    { name: 'Dashboard 2 · Bajas', fn: kpiD2 },
    { name: 'Dashboard 3 · Aprovechamiento', fn: kpiD3 },
    { name: 'Dashboard 4 · Tiempo Extra', fn: kpiD4 },
    { name: 'Dashboard 6 · Ausentismos', fn: kpiD6 },
    { name: 'Dashboard 7 · TREO', fn: kpiD7 },
  ];

  async function generatePresentation(){
    const statusEl = document.getElementById('pptx-status');
    const btn = document.getElementById('generate-pptx-btn');
    btn.disabled = true;
    btn.textContent = 'Generando...';
    if(statusEl) statusEl.textContent = 'Consultando Google Sheets...';
    try {
      const results = [];
      for(const d of DASHBOARDS){
        try {
          const kpi = await d.fn();
          results.push({ name: d.name, kpi });
        } catch(e) {
          console.error('Error KPI', d.name, e);
          results.push({ name: d.name, kpi: null });
        }
      }

      const pptx = new window.PptxGenJS();
      pptx.defineLayout({ name: 'OXXO', width: 10, height: 5.63 });
      pptx.layout = 'OXXO';

      const RED = 'F71926';
      const DARK = '211312';
      const GRAY = '7A4A42';

      const title = pptx.addSlide();
      title.background = { color: RED };
      title.addText('Presentación Ejecutiva', { x: 0.6, y: 1.9, w: 8.8, h: 1, fontSize: 40, bold: true, color: 'FFFFFF', fontFace: 'Arial' });
      title.addText('Indicadores clave · Plaza Oaxaca', { x: 0.6, y: 2.9, w: 8.8, h: 0.5, fontSize: 18, color: 'FFD7D5', fontFace: 'Arial' });
      const today = new Date();
      title.addText(today.toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' }), { x: 0.6, y: 4.8, w: 8.8, h: 0.4, fontSize: 12, color: 'FFD7D5', fontFace: 'Arial' });

      results.forEach(({ name, kpi }) => {
        const slide = pptx.addSlide();
        slide.background = { color: 'FFF8EF' };
        slide.addText(name, { x: 0.5, y: 0.4, w: 9, h: 0.6, fontSize: 22, bold: true, color: DARK, fontFace: 'Arial' });
        if(kpi){
          slide.addText(kpi.value, { x: 0.5, y: 1.6, w: 9, h: 2, fontSize: 96, bold: true, color: RED, align: 'center', fontFace: 'Arial' });
          slide.addText(kpi.label, { x: 0.5, y: 3.6, w: 9, h: 0.5, fontSize: 20, color: DARK, align: 'center', fontFace: 'Arial' });
          slide.addText(kpi.sub || '', { x: 0.5, y: 4.15, w: 9, h: 0.4, fontSize: 13, color: GRAY, align: 'center', fontFace: 'Arial' });
        } else {
          slide.addText('Sin datos disponibles', { x: 0.5, y: 2.3, w: 9, h: 0.6, fontSize: 22, color: GRAY, align: 'center', fontFace: 'Arial' });
        }
      });

      const d5Slide = pptx.addSlide();
      d5Slide.background = { color: 'FFF8EF' };
      d5Slide.addText('Dashboard 5 · Vacaciones', { x: 0.5, y: 0.4, w: 9, h: 0.6, fontSize: 22, bold: true, color: DARK, fontFace: 'Arial' });
      d5Slide.addText('Este dashboard usa datos offline (no conectados a Google Sheets).\nConsúltalo directamente en el Dashboard 5.', { x: 0.5, y: 2.1, w: 9, h: 1, fontSize: 16, color: GRAY, align: 'center', fontFace: 'Arial' });

      const fileName = `Presentacion-Ejecutiva-Oaxaca-${today.toISOString().slice(0,10)}.pptx`;
      await pptx.writeFile({ fileName });
      if(statusEl) statusEl.textContent = 'Presentación generada correctamente.';
    } catch(e){
      console.error(e);
      if(statusEl) statusEl.textContent = 'Error al generar la presentación: ' + e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '📊 Generar Presentación Ejecutiva';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('generate-pptx-btn');
    if(btn) btn.addEventListener('click', generatePresentation);
  });
})();
