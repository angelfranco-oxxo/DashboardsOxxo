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
  function tipoPuesto(desc){
    const d = normText(desc);
    if(d.includes('LIDER')) return 'Lider';
    if(d.includes('ENCARGADO')) return 'Encargado';
    if(d.includes('AYUDANTE')) return 'Ayudante';
    return 'Otro';
  }
  function tipoAusentismo(desc){
    const d = normText(desc);
    if(d.includes('FALTA')) return 'Faltas';
    if(d.includes('ACCIDENTE')) return 'Accidentes';
    if(d.includes('INC') || d.includes('ENF')) return 'Incapacidades';
    if(d.includes('VACAC')) return 'Vacaciones';
    if(d.includes('MATERN') || d.includes('PATERN') || d.includes('PERMISO')) return 'Permisos';
    return 'Otro';
  }

  async function kpiD1(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d1);
    if(!raw || !raw.length) return null;
    const mesKey = findKey(raw[0], ['Mes']);
    const puestoKey = findKey(raw[0], ['Descripcion de Posicion','Puesto']);
    const mes = latestByKey(raw, mesKey);
    const rows = mes ? raw.filter(r => String(r[mesKey]||'').trim() === mes) : raw;
    const byPuesto = { Lider: 0, Encargado: 0, Ayudante: 0, Otro: 0 };
    rows.forEach(r => { byPuesto[tipoPuesto(val(r, puestoKey))]++; });
    return {
      label: 'Total Vacantes', value: String(rows.length), sub: mes ? `Mes ${mes}` : 'Plaza Oaxaca',
      secondary: [
        { label: 'Lider', value: String(byPuesto.Lider) },
        { label: 'Encargado', value: String(byPuesto.Encargado) },
        { label: 'Ayudante', value: String(byPuesto.Ayudante) },
      ],
      chart: { title: 'Vacantes por Puesto', labels: ['Lider','Encargado','Ayudante'], values: [byPuesto.Lider, byPuesto.Encargado, byPuesto.Ayudante] },
    };
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
      const puesto = tipoPuesto(val(r, puestoKey));
      return puesto !== 'Otro';
    });
    const byPuesto = { Lider: 0, Encargado: 0, Ayudante: 0 };
    rows.forEach(r => { byPuesto[tipoPuesto(val(r, puestoKey))]++; });
    return {
      label: 'Total de Bajas', value: String(rows.length), sub: mes ? `Mes ${mes}` : 'Plaza Oaxaca',
      secondary: [
        { label: 'Ayudante', value: String(byPuesto.Ayudante) },
        { label: 'Encargado', value: String(byPuesto.Encargado) },
        { label: 'Lider', value: String(byPuesto.Lider) },
      ],
      chart: { title: 'Bajas por Puesto', labels: ['Ayudante','Encargado','Lider'], values: [byPuesto.Ayudante, byPuesto.Encargado, byPuesto.Lider] },
    };
  }

  async function kpiD3(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d3);
    if(!raw || !raw.length) return null;
    const estatusKey = findKey(raw[0], ['Clas Aprov','Estatus Con impacto Ausentismo','Estatus']);
    const total = raw.length;
    let completas = 0, incompletas = 0, criticas = 0;
    raw.forEach(r => {
      const s = normText(val(r, estatusKey));
      if(s.includes('CRIT')) criticas++;
      else if(s.includes('INCOMPLETO')) incompletas++;
      else if(s.includes('COMPLETO')) completas++;
    });
    const pct = total > 0 ? (completas / total * 100) : 0;
    return {
      label: 'Aprovechamiento General', value: pct.toFixed(2) + '%', sub: 'Plaza Oaxaca',
      secondary: [
        { label: 'Completas', value: String(completas) },
        { label: 'Incompletas', value: String(incompletas) },
        { label: 'Criticas', value: String(criticas) },
      ],
      chart: { title: 'Tiendas por Estatus', labels: ['Completas','Incompletas','Criticas'], values: [completas, incompletas, criticas], type: 'pie' },
    };
  }

  async function kpiD4(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.s4);
    if(!raw || !raw.length) return null;
    const semanaKey = findKey(raw[0], ['Semana']);
    const horasKey = findKey(raw[0], ['Cantidad']);
    const tipoKey = findKey(raw[0], ['Textos homologados']);
    const semana = latestByKey(raw, semanaKey);
    const rows = semana ? raw.filter(r => String(r[semanaKey]||'').trim() === semana) : raw;
    const totalHoras = rows.reduce((s,r) => s + num(val(r, horasKey)), 0);
    const byTipo = { Doble: 0, Triple: 0, Descanso: 0, Sencillo: 0 };
    // Clasificacion normalizada (sin acentos/espacios), igual que dashboard-4.html, para que
    // la presentacion no diverja del dashboard si 'Textos homologados' trae variantes de
    // acentos/espacios.
    rows.forEach(r => {
      const t = normText(val(r, tipoKey));
      const horas = num(val(r, horasKey));
      if(t.replace(/\s+/g,'') === 'TIEMPOEXTRADOBLE') byTipo.Doble += horas;
      else if(t.replace(/\s+/g,'') === 'TIEMPOEXTRATRIPLE') byTipo.Triple += horas;
      else if(t.replace(/\s+/g,'').startsWith('DIADES')) byTipo.Descanso += horas;
      else byTipo.Sencillo += horas;
    });
    return {
      label: 'Total Horas TE', value: OXXO.formatNum(totalHoras), sub: semana ? `Semana ${semana}` : 'Plaza Oaxaca',
      secondary: [
        { label: 'Doble', value: OXXO.formatNum(byTipo.Doble) },
        { label: 'Triple', value: OXXO.formatNum(byTipo.Triple) },
        { label: 'Descanso', value: OXXO.formatNum(byTipo.Descanso) },
      ],
      chart: { title: 'Horas TE por Tipo', labels: ['Sencillo','Doble','Triple','Descanso'], values: [byTipo.Sencillo, byTipo.Doble, byTipo.Triple, byTipo.Descanso] },
    };
  }

  async function kpiD5(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.s5);
    if(!raw || !raw.length) return null;
    const diasKey = findKey(raw[0], ['Dias_Restantes']);
    const bucketKey = findKey(raw[0], ['Bucket_Ant']);
    const totalDias = raw.reduce((s,r) => s + num(val(r, diasKey)), 0);
    const buckets = { 'ya vencieron sus dias': 0, '0 a 50 dias': 0, '51 a 100 dias': 0, '101 a 150 dias': 0, 'mas de 150 dias': 0 };
    raw.forEach(r => {
      const b = String(val(r, bucketKey) || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
      if(buckets[b] !== undefined) buckets[b]++;
    });
    return {
      label: 'Días Restantes de Vacaciones', value: OXXO.formatNum(Math.round(totalDias)), sub: 'Plaza Oaxaca',
      secondary: [
        { label: 'Vencidos', value: String(buckets['ya vencieron sus dias']) },
        { label: 'Vencen 0-50 días', value: String(buckets['0 a 50 dias']) },
        { label: 'Colaboradores', value: String(raw.length) },
      ],
      chart: { title: 'Colaboradores por Vencimiento', labels: ['Vencidos','0-50 días','51-100 días','101-150 días','+150 días'], values: [buckets['ya vencieron sus dias'], buckets['0 a 50 dias'], buckets['51 a 100 dias'], buckets['101 a 150 dias'], buckets['mas de 150 dias']] },
    };
  }

  async function kpiD6(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.s6);
    if(!raw || !raw.length) return null;
    const semanaKey = findKey(raw[0], ['Semana']);
    const diasKey = findKey(raw[0], ['Dias']);
    const denomKey = findKey(raw[0], ['Denominacion']);
    const semana = latestByKey(raw, semanaKey);
    const rows = semana ? raw.filter(r => String(r[semanaKey]||'').trim() === semana) : raw;
    const totalDias = rows.reduce((s,r) => s + num(val(r, diasKey)), 0);
    const byTipo = { Faltas: 0, Incapacidades: 0, Vacaciones: 0, Permisos: 0, Accidentes: 0, Otro: 0 };
    rows.forEach(r => { byTipo[tipoAusentismo(val(r, denomKey))] += num(val(r, diasKey)); });
    return {
      label: 'Días Ausentes', value: OXXO.formatNum(Math.round(totalDias)), sub: semana ? `Semana ${semana}` : 'Plaza Oaxaca',
      secondary: [
        { label: 'Faltas', value: OXXO.formatNum(Math.round(byTipo.Faltas)) },
        { label: 'Incapacidades', value: OXXO.formatNum(Math.round(byTipo.Incapacidades)) },
        { label: 'Vacaciones', value: OXXO.formatNum(Math.round(byTipo.Vacaciones)) },
      ],
      chart: { title: 'Días Ausentes por Tipo', labels: ['Faltas','Incapacidades','Vacaciones','Permisos','Accidentes'], values: [byTipo.Faltas, byTipo.Incapacidades, byTipo.Vacaciones, byTipo.Permisos, byTipo.Accidentes], type: 'pie' },
    };
  }

  async function kpiD7(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.s7);
    if(!raw || !raw.length) return null;
    const difKey = findKey(raw[0], ['Dif SAP vs Est Optima Final']);
    const total = raw.length;
    let alineadas = 0, subir = 0, bajar = 0;
    raw.forEach(r => {
      const d = num(val(r, difKey));
      if(d === 0) alineadas++;
      else if(d > 0) subir++;
      else bajar++;
    });
    const pct = total > 0 ? (alineadas / total * 100) : 0;
    return {
      label: 'Alineación Global TREO', value: pct.toFixed(1) + '%', sub: 'Plaza Oaxaca',
      secondary: [
        { label: 'Alineadas', value: String(alineadas) },
        { label: 'Por Subir', value: String(subir) },
        { label: 'Por Bajar', value: String(bajar) },
      ],
      chart: { title: 'Tiendas por Estatus TREO', labels: ['Alineadas','Por Subir','Por Bajar'], values: [alineadas, subir, bajar], type: 'pie' },
    };
  }

  const DASHBOARDS = [
    { name: 'Dashboard 1 · Vacantes', fn: kpiD1 },
    { name: 'Dashboard 2 · Bajas', fn: kpiD2 },
    { name: 'Dashboard 3 · Aprovechamiento', fn: kpiD3 },
    { name: 'Dashboard 4 · Tiempo Extra', fn: kpiD4 },
    { name: 'Dashboard 5 · Vacaciones', fn: kpiD5 },
    { name: 'Dashboard 6 · Ausentismos', fn: kpiD6 },
    { name: 'Dashboard 7 · TREO', fn: kpiD7 },
  ];

  const RED = 'F71926';
  const DARK = '211312';
  const GRAY = '7A4A42';
  const PALETTE = ['F71926','F07B22','F6B73C','1DB954','0066CC','8B4CF7','9E9E9E'];

  function addKpiSlide(pptx, name, kpi){
    const slide = pptx.addSlide();
    slide.background = { color: 'FFF8EF' };
    slide.addText(name, { x: 0.4, y: 0.3, w: 9.2, h: 0.5, fontSize: 22, bold: true, color: DARK, fontFace: 'Arial' });

    if(!kpi){
      slide.addText('Sin datos disponibles', { x: 0.4, y: 2.3, w: 9.2, h: 0.6, fontSize: 22, color: GRAY, align: 'center', fontFace: 'Arial' });
      return;
    }

    // KPI principal (izquierda)
    slide.addText(kpi.value, { x: 0.4, y: 1.0, w: 4.2, h: 1.3, fontSize: 56, bold: true, color: RED, align: 'center', fontFace: 'Arial' });
    slide.addText(kpi.label, { x: 0.4, y: 2.25, w: 4.2, h: 0.45, fontSize: 15, color: DARK, align: 'center', fontFace: 'Arial', bold: true });
    slide.addText(kpi.sub || '', { x: 0.4, y: 2.65, w: 4.2, h: 0.35, fontSize: 11, color: GRAY, align: 'center', fontFace: 'Arial' });

    // KPIs secundarios (debajo del principal)
    (kpi.secondary || []).forEach((s, i) => {
      const y = 3.15 + i * 0.62;
      slide.addShape(pptx.ShapeType.roundRect, { x: 0.4, y, w: 4.2, h: 0.52, fill: { color: 'FFFFFF' }, line: { color: 'EFE2DC', width: 1 }, rectRadius: 0.08 });
      slide.addText(s.label, { x: 0.55, y: y + 0.06, w: 2.6, h: 0.4, fontSize: 12, color: GRAY, fontFace: 'Arial', valign: 'middle' });
      slide.addText(s.value, { x: 3.1, y: y + 0.06, w: 1.4, h: 0.4, fontSize: 14, bold: true, color: DARK, align: 'right', fontFace: 'Arial', valign: 'middle' });
    });

    // Gráfica (derecha)
    if(kpi.chart && kpi.chart.values.some(v => v > 0)){
      const chartType = kpi.chart.type === 'pie' ? pptx.ChartType.pie : pptx.ChartType.bar;
      const dataSeries = [{ name: kpi.chart.title, labels: kpi.chart.labels, values: kpi.chart.values }];
      slide.addText(kpi.chart.title, { x: 4.9, y: 0.9, w: 4.7, h: 0.35, fontSize: 13, bold: true, color: DARK, fontFace: 'Arial' });
      slide.addChart(chartType, dataSeries, {
        x: 4.85, y: 1.25, w: 4.75, h: 3.9,
        chartColors: PALETTE,
        showLegend: true, legendPos: 'b', legendFontSize: 9,
        showValue: kpi.chart.type === 'pie',
        dataLabelFontSize: 10,
        catAxisLabelFontSize: 10,
        valAxisLabelFontSize: 10,
      });
    }
  }

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

      const title = pptx.addSlide();
      title.background = { color: RED };
      title.addText('Presentación Ejecutiva', { x: 0.6, y: 1.9, w: 8.8, h: 1, fontSize: 40, bold: true, color: 'FFFFFF', fontFace: 'Arial' });
      title.addText('Indicadores clave · Plaza Oaxaca', { x: 0.6, y: 2.9, w: 8.8, h: 0.5, fontSize: 18, color: 'FFD7D5', fontFace: 'Arial' });
      const today = new Date();
      title.addText(today.toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' }), { x: 0.6, y: 4.8, w: 8.8, h: 0.4, fontSize: 12, color: 'FFD7D5', fontFace: 'Arial' });

      results.forEach(({ name, kpi }) => addKpiSlide(pptx, name, kpi));

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
