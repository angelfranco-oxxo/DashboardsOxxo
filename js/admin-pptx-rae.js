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
  // Ranking de conteo por nombre (p.ej. vacantes o bajas por Asesor), top N descendente.
  function rankCount(rows, nameKey, limit){
    const counts = new Map();
    rows.forEach(r => {
      const name = String(val(r, nameKey)||'').trim();
      if(!name) return;
      counts.set(name, (counts.get(name)||0) + 1);
    });
    return [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, limit);
  }
  // Ranking de suma por nombre (p.ej. horas TE o dias ausentes por Asesor), top N descendente.
  function rankSum(rows, nameKey, valueKey, limit){
    const sums = new Map();
    rows.forEach(r => {
      const name = String(val(r, nameKey)||'').trim();
      if(!name) return;
      sums.set(name, (sums.get(name)||0) + num(val(r, valueKey)));
    });
    return [...sums.entries()].map(([name, value]) => ({ name, value: Math.round(value) })).filter(it => it.value > 0).sort((a,b) => b.value - a.value).slice(0, limit);
  }
  // Ranking de promedio por nombre (p.ej. % aprovechamiento por AT), ordenado descendente.
  function rankAvg(rows, nameKey, valueKey, limit){
    const sums = new Map(), counts = new Map();
    rows.forEach(r => {
      const name = String(val(r, nameKey)||'').trim();
      if(!name) return;
      sums.set(name, (sums.get(name)||0) + num(val(r, valueKey)));
      counts.set(name, (counts.get(name)||0) + 1);
    });
    return [...sums.entries()].map(([name, sum]) => ({ name, value: sum / counts.get(name) })).sort((a,b) => b.value - a.value).slice(0, limit);
  }
  // Ranking ascendente (p.ej. dias restantes de vacaciones: los mas criticos primero).
  function rankAsc(rows, nameKey, valueKey, limit){
    return rows.map(r => ({ name: String(val(r, nameKey)||'').trim(), value: num(val(r, valueKey)) }))
      .filter(it => it.name)
      .sort((a,b) => a.value - b.value).slice(0, limit);
  }

  async function dataD1(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d1);
    if(!raw || !raw.length) return null;
    const mesKey = findKey(raw[0], ['Mes']);
    const puestoKey = findKey(raw[0], ['Descripcion de Posicion','Puesto']);
    const asesorKey = findKey(raw[0], ['Asesor']);
    const mes = latestByKey(raw, mesKey);
    const rows = mes ? raw.filter(r => String(r[mesKey]||'').trim() === mes) : raw;
    const byPuesto = { Lider: 0, Encargado: 0, Ayudante: 0, Otro: 0 };
    rows.forEach(r => { byPuesto[tipoPuesto(val(r, puestoKey))]++; });
    return {
      total: rows.length, sub: mes ? `Mes ${mes}` : 'Plaza Oaxaca',
      byPuesto,
      ranking: rankCount(rows, asesorKey, 8),
    };
  }

  async function dataD2(){
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
      total: rows.length, sub: mes ? `Mes ${mes}` : 'Plaza Oaxaca',
      byPuesto,
      ranking: rankCount(rows, asesorKey, 8),
    };
  }

  async function dataD3(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d3);
    if(!raw || !raw.length) return null;
    const estatusKey = findKey(raw[0], ['Clas Aprov','Estatus Con impacto Ausentismo','Estatus']);
    const asesorKey = findKey(raw[0], ['Asesor']);
    const aprovKey = findKey(raw[0], ['Aprovechamiento Estructura','Aprovechamiento de estructura']);
    const total = raw.length;
    let completas = 0, incompletas = 0, criticas = 0;
    raw.forEach(r => {
      const s = normText(val(r, estatusKey));
      if(s.includes('CRIT')) criticas++;
      else if(s.includes('INCOMPLETO')) incompletas++;
      else if(s.includes('COMPLETO')) completas++;
    });
    const pct = total > 0 ? (completas / total * 100) : 0;
    const oaxacaAvg = raw.reduce((s,r) => s + num(val(r, aprovKey)), 0) / (total || 1);

    let plazas = [];
    try {
      const otras = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d3plazas);
      if(otras && otras.length){
        const plazaKey = findKey(otras[0], ['PLAZAS','Plaza']);
        const valKey = findKey(otras[0], ['Aprovechamiento de estructura a hoy','Aprovechamiento']);
        plazas = otras.map(r => ({ name: String(val(r, plazaKey)||'').trim(), value: num(val(r, valKey)) })).filter(p => p.name);
      }
    } catch(e){ /* sin datos de otras plazas: se muestra solo Oaxaca */ }
    plazas.push({ name: 'OAXACA', value: oaxacaAvg });
    plazas.sort((a,b) => b.value - a.value);

    return {
      pct, completas, incompletas, criticas,
      plazas: plazas.slice(0, 5),
      ranking: rankAvg(raw, asesorKey, aprovKey, 10),
    };
  }

  async function dataD4(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.s4);
    if(!raw || !raw.length) return null;
    const semanaKey = findKey(raw[0], ['Semana']);
    const horasKey = findKey(raw[0], ['Cantidad']);
    const tipoKey = findKey(raw[0], ['Textos homologados']);
    const asesorKey = findKey(raw[0], ['Asesor']);
    const semana = latestByKey(raw, semanaKey);
    const rows = semana ? raw.filter(r => String(r[semanaKey]||'').trim() === semana) : raw;
    const totalHoras = rows.reduce((s,r) => s + num(val(r, horasKey)), 0);
    const byTipo = { Sencillo: 0, Doble: 0, Triple: 0, Descanso: 0 };
    rows.forEach(r => {
      const t = normText(val(r, tipoKey));
      const horas = num(val(r, horasKey));
      if(t.replace(/\s+/g,'') === 'TIEMPOEXTRADOBLE') byTipo.Doble += horas;
      else if(t.replace(/\s+/g,'') === 'TIEMPOEXTRATRIPLE') byTipo.Triple += horas;
      else if(t.replace(/\s+/g,'').startsWith('DIADES')) byTipo.Descanso += horas;
      else byTipo.Sencillo += horas;
    });
    return {
      totalHoras, sub: semana ? `Semana ${semana}` : 'Plaza Oaxaca',
      byTipo,
      ranking: rankSum(rows, asesorKey, horasKey, 8),
    };
  }

  async function dataD5(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.s5);
    if(!raw || !raw.length) return null;
    const diasKey = findKey(raw[0], ['Dias_Restantes']);
    const bucketKey = findKey(raw[0], ['Bucket_Ant']);
    const nombreKey = findKey(raw[0], ['Nombre']);
    const totalDias = raw.reduce((s,r) => s + num(val(r, diasKey)), 0);
    const buckets = { 'ya vencieron sus dias': 0, '0 a 50 dias': 0, '51 a 100 dias': 0, '101 a 150 dias': 0, 'mas de 150 dias': 0 };
    raw.forEach(r => {
      const b = String(val(r, bucketKey) || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
      if(buckets[b] !== undefined) buckets[b]++;
    });
    return {
      totalDias: Math.round(totalDias), colaboradores: raw.length,
      buckets,
      ranking: rankAsc(raw, nombreKey, diasKey, 8),
    };
  }

  async function dataD6(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.s6);
    if(!raw || !raw.length) return null;
    const semanaKey = findKey(raw[0], ['Semana']);
    const diasKey = findKey(raw[0], ['Dias']);
    const denomKey = findKey(raw[0], ['Denominacion']);
    const asesorKey = findKey(raw[0], ['Asesor']);
    const semana = latestByKey(raw, semanaKey);
    const rows = semana ? raw.filter(r => String(r[semanaKey]||'').trim() === semana) : raw;
    const totalDias = rows.reduce((s,r) => s + num(val(r, diasKey)), 0);
    const byTipo = { Faltas: 0, Incapacidades: 0, Vacaciones: 0, Permisos: 0, Accidentes: 0, Otro: 0 };
    rows.forEach(r => { byTipo[tipoAusentismo(val(r, denomKey))] += num(val(r, diasKey)); });
    return {
      totalDias: Math.round(totalDias), sub: semana ? `Semana ${semana}` : 'Plaza Oaxaca',
      byTipo,
      ranking: rankSum(rows, asesorKey, diasKey, 8),
    };
  }

  async function dataD7(){
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.s7);
    if(!raw || !raw.length) return null;
    const difKey = findKey(raw[0], ['Dif SAP vs Est Optima Final']);
    const treoKey = findKey(raw[0], ['Estructura Propuesta TREO P2 Jun - Ago','TREO']);
    const activosKey = findKey(raw[0], ['Empleados Activos','Activos']);
    const vacantesKey = findKey(raw[0], ['Vacantes']);
    const asesorKey = findKey(raw[0], ['Asesor']);
    const total = raw.length;
    let alineadas = 0, subir = 0, bajar = 0, posSubir = 0, posBajar = 0;
    raw.forEach(r => {
      const d = num(val(r, difKey));
      if(d === 0) alineadas++;
      else if(d > 0) { subir++; posSubir += d; }
      else { bajar++; posBajar += -d; }
    });
    const totalTreo = raw.reduce((s,r) => s + num(val(r, treoKey)), 0);
    const totalActivos = raw.reduce((s,r) => s + num(val(r, activosKey)), 0);
    const totalVacantes = raw.reduce((s,r) => s + num(val(r, vacantesKey)), 0);
    const cobertura = totalTreo > 0 ? (totalActivos / totalTreo * 100) : 0;
    return {
      total, alineadas, subir, bajar, posSubir, posBajar,
      totalTreo, totalActivos, totalVacantes, cobertura,
    };
  }

  // ── Paleta y helpers visuales (misma estructura que RAE_BASE.pptx) ──
  const RED = 'CC0000', GOLD = 'FFC400', ORANGE = 'EE7203', DARK = '2B1714';
  const PINKBG = 'FCE8EA', TRACKBG = 'F4F4F4', BORDER = 'E2E2E2';
  const TEXT = '222222', MUTED = '777777', SUBTLE = 'FFE3E0', BADGETEXT = '5A3A00', WHITE = 'FFFFFF', GREEN = '00A878';
  const PAGE_W = 13.333, MARGIN_X = 0.45, HEADER_H = 0.92;

  function addHeader(slide, title, dateLabel){
    slide.addShape('rect', { x: 0, y: 0, w: PAGE_W, h: HEADER_H, fill: { color: RED }, line: { type: 'none' } });
    slide.addShape('rect', { x: 0, y: HEADER_H, w: PAGE_W, h: 0.05, fill: { color: GOLD }, line: { type: 'none' } });
    const fontSize = title.length > 22 ? 22 : 30;
    slide.addText(title, { x: MARGIN_X, y: 0, w: 7.5, h: HEADER_H, fontSize, bold: true, color: WHITE, fontFace: 'Arial', valign: 'middle', margin: 0 });
    slide.addShape('roundRect', { x: 8.05, y: 0.26, w: 2.55, h: 0.42, rectRadius: 0.08, fill: { color: GOLD }, line: { type: 'none' } });
    slide.addText('Plaza Oaxaca', { x: 8.05, y: 0.26, w: 2.55, h: 0.42, fontSize: 13, bold: true, color: BADGETEXT, fontFace: 'Arial', align: 'center', valign: 'middle', margin: 0 });
    slide.addText(`OXXO · Uso Interno · ${dateLabel}`, { x: 10.7, y: 0, w: 2.2, h: HEADER_H, fontSize: 10, color: SUBTLE, fontFace: 'Arial', align: 'right', valign: 'middle', margin: 0 });
  }

  function addSectionTitle(slide, x, y, w, text, rightText){
    slide.addShape('ellipse', { x, y: y + 0.05, w: 0.13, h: 0.13, fill: { color: RED }, line: { type: 'none' } });
    slide.addText(text, { x: x + 0.22, y, w: w - 0.22, h: 0.32, fontSize: 13, bold: true, color: TEXT, fontFace: 'Arial', margin: 0, valign: 'middle' });
    if(rightText){
      slide.addText(rightText, { x: x + w - 2.2, y, w: 2.2, h: 0.32, fontSize: 10, color: MUTED, fontFace: 'Arial', align: 'right', margin: 0, valign: 'middle' });
    }
  }

  function addHeroKpi(slide, x, y, w, h, value, label, sub){
    slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.12, fill: { color: RED }, line: { type: 'none' } });
    slide.addText(String(value), { x: x + 0.2, y: y + 0.12, w: w * 0.45, h: h - 0.24, fontSize: 56, bold: true, color: WHITE, fontFace: 'Arial', valign: 'middle', margin: 0 });
    slide.addText([
      { text: label, options: { bold: true, breakLine: true } },
      { text: sub, options: { bold: false } },
    ], { x: x + w * 0.45, y, w: w * 0.55 - 0.15, h, fontSize: 11, color: SUBTLE, fontFace: 'Arial', valign: 'middle', margin: 0 });
  }

  function addDoughnutCard(pptx, slide, x, y, w, h, title, segments){
    slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.1, fill: { color: WHITE }, line: { color: BORDER, width: 1 } });
    addSectionTitle(slide, x + 0.2, y + 0.16, w - 0.4, title);
    const clean = segments.filter(s => s.value > 0);
    if(!clean.length){
      slide.addText('Sin datos disponibles', { x: x + 0.2, y: y + h/2 - 0.2, w: w - 0.4, h: 0.4, fontSize: 12, color: MUTED, align: 'center', fontFace: 'Arial', margin: 0 });
      return;
    }
    const total = clean.reduce((s, seg) => s + seg.value, 0) || 1;

    // Bloque grafica+leyenda centrado verticalmente en el area bajo el titulo:
    // ancla fija arriba dejaba huecos enormes en tarjetas altas con pocos segmentos.
    const contentTop = y + 0.62;
    const contentH = h - 0.62 - 0.2;
    const chartSize = Math.min(w * 0.42, contentH, 2.3);
    const rowStep = Math.min(0.62, Math.max(contentH, 0.62 * clean.length) / clean.length);
    const blockH = Math.max(chartSize, rowStep * clean.length);
    const blockY = contentTop + Math.max(0, (contentH - blockH) / 2);
    const chartY = blockY + (blockH - chartSize) / 2;

    slide.addChart(pptx.ChartType.doughnut, [{ name: title, labels: clean.map(s => s.label), values: clean.map(s => s.value) }], {
      x: x + 0.25, y: chartY, w: chartSize, h: chartSize,
      chartColors: clean.map(s => s.color),
      showLegend: false, showValue: false, showPercent: false,
      dataBorder: { pt: 2, color: WHITE },
      holeSize: 62,
    });
    const top = clean[0];
    const topPct = Math.round((top.value / total) * 100);
    slide.addText(`${topPct}%`, { x: x + 0.25, y: chartY + chartSize/2 - 0.32, w: chartSize, h: 0.34, fontSize: 20, bold: true, color: TEXT, align: 'center', fontFace: 'Arial', margin: 0 });
    slide.addText(top.label.toUpperCase(), { x: x + 0.25, y: chartY + chartSize/2 + 0.02, w: chartSize, h: 0.22, fontSize: 8, color: MUTED, align: 'center', fontFace: 'Arial', margin: 0 });

    const legendX = x + 0.35 + chartSize;
    const legendW = w - 0.6 - chartSize;
    const legendRowH = Math.min(0.22, rowStep * 0.36);
    let ly = blockY + (blockH - rowStep * clean.length) / 2;
    clean.forEach(seg => {
      const pct = Math.round((seg.value / total) * 100);
      slide.addShape('ellipse', { x: legendX, y: ly + 0.05, w: 0.1, h: 0.1, fill: { color: seg.color }, line: { type: 'none' } });
      slide.addText(seg.label.toUpperCase(), { x: legendX + 0.18, y: ly - 0.03, w: legendW * 0.55, h: legendRowH, fontSize: 9.5, bold: true, color: MUTED, fontFace: 'Arial', margin: 0 });
      slide.addText(`${pct}%`, { x: legendX + legendW * 0.55, y: ly - 0.03, w: legendW * 0.45, h: legendRowH, fontSize: 9.5, bold: true, color: seg.color, fontFace: 'Arial', align: 'right', margin: 0 });
      slide.addText(String(seg.value), { x: legendX + 0.18, y: ly + rowStep * 0.3, w: legendW, h: legendRowH, fontSize: rowStep >= 0.5 ? 16 : 12, bold: true, color: TEXT, fontFace: 'Arial', margin: 0 });
      ly += rowStep;
    });
  }

  function addRankingList(slide, x, y, w, h, title, items, rightText){
    slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.1, fill: { color: WHITE }, line: { color: BORDER, width: 1 } });
    addSectionTitle(slide, x + 0.2, y + 0.16, w - 0.4, title, rightText);
    if(!items.length){
      slide.addText('Sin datos disponibles', { x: x + 0.2, y: y + h/2 - 0.2, w: w - 0.4, h: 0.4, fontSize: 12, color: MUTED, align: 'center', fontFace: 'Arial', margin: 0 });
      return;
    }
    const maxValue = Math.max(...items.map(it => it.value), 1);
    const rowH = Math.min(0.68, (h - 0.8) / items.length);
    let ry = y + 0.62;
    items.forEach((item, idx) => {
      const barColor = idx === 0 ? RED : GOLD;
      const nameW = w * 0.32;
      const barX = x + 0.2 + nameW;
      const barW = w - 0.4 - nameW - 0.65;
      const pillW = 0.6;
      slide.addText(item.name, { x: x + 0.2, y: ry, w: nameW - 0.1, h: rowH, fontSize: 9.5, color: TEXT, fontFace: 'Arial', valign: 'middle', margin: 0, fit: 'shrink' });
      slide.addShape('roundRect', { x: barX, y: ry + rowH * 0.28, w: barW, h: rowH * 0.32, rectRadius: 0.04, fill: { color: TRACKBG }, line: { type: 'none' } });
      const fillW = Math.max(barW * (item.value / maxValue), 0.06);
      slide.addShape('roundRect', { x: barX, y: ry + rowH * 0.28, w: fillW, h: rowH * 0.32, rectRadius: 0.04, fill: { color: barColor }, line: { type: 'none' } });
      slide.addShape('roundRect', { x: x + w - 0.2 - pillW, y: ry + (rowH - 0.24) / 2, w: pillW, h: 0.24, rectRadius: 0.04, fill: { color: PINKBG }, line: { type: 'none' } });
      slide.addText(String(item.value), { x: x + w - 0.2 - pillW, y: ry + (rowH - 0.24) / 2, w: pillW, h: 0.24, fontSize: 10, bold: true, color: RED, fontFace: 'Arial', align: 'center', valign: 'middle', margin: 0 });
      ry += rowH;
    });
  }

  function addGaugeCard(slide, x, y, w, h, pct, label){
    const color = pct >= 95 ? GREEN : (pct >= 85 ? GOLD : RED);
    slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.08, fill: { color: WHITE }, line: { color: BORDER, width: 1 } });
    slide.addText(`${pct.toFixed(1)}%`, { x: x + 0.1, y: y + 0.16, w: w - 0.2, h: 0.6, fontSize: 26, bold: true, color, fontFace: 'Arial', margin: 0 });
    slide.addText(label.toUpperCase(), { x: x + 0.1, y: y + 0.72, w: w - 0.2, h: 0.24, fontSize: 10, bold: true, color: MUTED, fontFace: 'Arial', margin: 0, fit: 'shrink' });
    slide.addShape('roundRect', { x: x + 0.1, y: y + h - 0.24, w: w - 0.2, h: 0.1, rectRadius: 0.05, fill: { color: TRACKBG }, line: { type: 'none' } });
    slide.addShape('roundRect', { x: x + 0.1, y: y + h - 0.24, w: (w - 0.2) * Math.min(pct, 100) / 100, h: 0.1, rectRadius: 0.05, fill: { color }, line: { type: 'none' } });
  }

  function addAtList(slide, x, y, w, h, title, items, rightText){
    slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.1, fill: { color: WHITE }, line: { color: BORDER, width: 1 } });
    addSectionTitle(slide, x + 0.2, y + 0.16, w - 0.4, title, rightText);
    if(!items.length){
      slide.addText('Sin datos disponibles', { x: x + 0.2, y: y + h/2 - 0.2, w: w - 0.4, h: 0.4, fontSize: 12, color: MUTED, align: 'center', fontFace: 'Arial', margin: 0 });
      return;
    }
    const half = Math.ceil(items.length / 2);
    const colW = (w - 0.4) / 2;
    const rowH = Math.min(0.4, (h - 0.75) / half);
    [items.slice(0, half), items.slice(half)].forEach((col, ci) => {
      let ry = y + 0.62;
      col.forEach(it => {
        const cx = x + 0.2 + ci * colW;
        const color = it.value >= 95 ? GREEN : (it.value >= 85 ? '#B8860B' : RED);
        slide.addText(it.name, { x: cx, y: ry, w: colW - 1.0, h: rowH, fontSize: 10, color: TEXT, fontFace: 'Arial', valign: 'middle', margin: 0, fit: 'shrink' });
        slide.addText(`${it.value.toFixed(2)}%`, { x: cx + colW - 1.0, y: ry, w: 1.0, h: rowH, fontSize: 10, bold: true, color, fontFace: 'Arial', align: 'right', valign: 'middle', margin: 0 });
        ry += rowH;
      });
    });
  }

  function addMetricCard(slide, x, y, w, h, label, value, note, big){
    slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.08, fill: { color: WHITE }, line: { color: BORDER, width: 1 } });
    slide.addText(label.toUpperCase(), { x: x + 0.14, y: y + 0.1, w: w - 0.28, h: 0.24, fontSize: 9, bold: true, color: MUTED, fontFace: 'Arial', margin: 0, fit: 'shrink' });
    slide.addText(String(value), { x: x + 0.14, y: y + 0.32, w: w - 0.28, h: big ? 0.55 : 0.4, fontSize: big ? 30 : 20, bold: true, color: TEXT, fontFace: 'Arial', margin: 0 });
    slide.addText(note, { x: x + 0.14, y: y + h - 0.32, w: w - 0.28, h: 0.28, fontSize: 8.5, bold: true, color: RED, fontFace: 'Arial', margin: 0, fit: 'shrink' });
  }

  function emptySlide(pptx, title, dateLabel){
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, title, dateLabel);
    slide.addText('Sin datos disponibles en Google Sheets', { x: MARGIN_X, y: 3, w: PAGE_W - MARGIN_X*2, h: 0.6, fontSize: 18, color: MUTED, align: 'center', fontFace: 'Arial' });
    return slide;
  }

  function buildD1(pptx, d, dateLabel){
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'VACANTES', dateLabel);
    addHeroKpi(slide, MARGIN_X, 1.25, 4.55, 1.35, d.total, 'VACANTES TOTALES', 'en tiendas filtradas · Plaza Oaxaca');
    addDoughnutCard(pptx, slide, MARGIN_X, 2.8, 4.55, 2.5, 'Distribución por puesto', [
      { label: 'Ayudante', value: d.byPuesto.Ayudante, color: GOLD },
      { label: 'Encargado', value: d.byPuesto.Encargado, color: ORANGE },
      { label: 'Lider', value: d.byPuesto.Lider, color: RED },
    ]);
    addRankingList(slide, 5.35, 1.25, 7.55, 5.75, 'Vacantes por Asesor', d.ranking, `${d.total} vacantes totales`);
  }

  function buildD2(pptx, d, dateLabel){
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'BAJAS', dateLabel);
    addRankingList(slide, MARGIN_X, 1.25, 6.85, 5.75, 'Bajas por Asesor', d.ranking, `${d.total} bajas totales`);
    addDoughnutCard(pptx, slide, 8.3, 1.25, 4.6, 5.75, 'Bajas por Puesto', [
      { label: 'Ayudante', value: d.byPuesto.Ayudante, color: GOLD },
      { label: 'Encargado', value: d.byPuesto.Encargado, color: ORANGE },
      { label: 'Lider', value: d.byPuesto.Lider, color: RED },
    ]);
  }

  function buildD3(pptx, d, dateLabel){
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'APROVECHAMIENTO DE ESTRUCTURA', dateLabel);
    addSectionTitle(slide, MARGIN_X, 1.2, 6.85, 'Aprovechamiento por Plaza', 'Meta 95%');
    const gW = (6.85 - 0.2 * 4) / 5;
    d.plazas.forEach((p, i) => addGaugeCard(slide, MARGIN_X + i * (gW + 0.2), 1.65, gW, 1.55, p.value, p.name));
    addAtList(slide, MARGIN_X, 3.5, 6.85, 3.5, 'Aprovechamiento por AT', d.ranking, 'Meta 95%');
    addDoughnutCard(pptx, slide, 8.3, 1.2, 4.6, 5.8, 'Estatus con impacto de ausentismo', [
      { label: 'Completas', value: d.completas, color: GREEN },
      { label: 'Incompletas', value: d.incompletas, color: GOLD },
      { label: 'Criticas', value: d.criticas, color: RED },
    ]);
  }

  function buildD4(pptx, d, dateLabel){
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'TIEMPO EXTRA', dateLabel);
    addHeroKpi(slide, MARGIN_X, 1.25, 4.55, 1.35, OXXO.formatNum(d.totalHoras), 'HORAS TE TOTALES', d.sub + ' · Plaza Oaxaca');
    addDoughnutCard(pptx, slide, MARGIN_X, 2.8, 4.55, 2.5, 'Horas TE por tipo', [
      { label: 'Sencillo', value: d.byTipo.Sencillo, color: GOLD },
      { label: 'Doble', value: d.byTipo.Doble, color: ORANGE },
      { label: 'Triple', value: d.byTipo.Triple, color: RED },
      { label: 'Descanso', value: d.byTipo.Descanso, color: DARK },
    ]);
    addRankingList(slide, 5.35, 1.25, 7.55, 5.75, 'Horas TE por Asesor', d.ranking, `${OXXO.formatNum(d.totalHoras)} h totales`);
  }

  function buildD5(pptx, d, dateLabel){
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'CONTROL DE VACACIONES', dateLabel);
    addHeroKpi(slide, MARGIN_X, 1.25, 4.55, 1.35, OXXO.formatNum(d.totalDias), 'DÍAS RESTANTES', `${d.colaboradores} colaboradores · Plaza Oaxaca`);
    addDoughnutCard(pptx, slide, MARGIN_X, 2.8, 4.55, 2.5, 'Colaboradores por vencimiento', [
      { label: 'Vencidos', value: d.buckets['ya vencieron sus dias'], color: RED },
      { label: '0-50 días', value: d.buckets['0 a 50 dias'], color: ORANGE },
      { label: '51-100 días', value: d.buckets['51 a 100 dias'], color: GOLD },
      { label: '+100 días', value: d.buckets['101 a 150 dias'] + d.buckets['mas de 150 dias'], color: GREEN },
    ]);
    addRankingList(slide, 5.35, 1.25, 7.55, 5.75, 'Casos más críticos (menos días)', d.ranking, `${d.colaboradores} colaboradores`);
  }

  function buildD6(pptx, d, dateLabel){
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'AUSENTISMOS', dateLabel);
    addHeroKpi(slide, MARGIN_X, 1.25, 4.55, 1.35, OXXO.formatNum(d.totalDias), 'DÍAS AUSENTES', d.sub + ' · Plaza Oaxaca');
    addDoughnutCard(pptx, slide, MARGIN_X, 2.8, 4.55, 2.5, 'Días ausentes por tipo', [
      { label: 'Faltas', value: Math.round(d.byTipo.Faltas), color: RED },
      { label: 'Incapacidades', value: Math.round(d.byTipo.Incapacidades), color: ORANGE },
      { label: 'Vacaciones', value: Math.round(d.byTipo.Vacaciones), color: GOLD },
      { label: 'Permisos', value: Math.round(d.byTipo.Permisos), color: DARK },
    ]);
    addRankingList(slide, 5.35, 1.25, 7.55, 5.75, 'Días ausentes por Asesor', d.ranking, `${OXXO.formatNum(d.totalDias)} días totales`);
  }

  function buildD7(pptx, d, dateLabel){
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addHeader(slide, 'TREO · ESTRUCTURA', dateLabel);
    const kpiW = (PAGE_W - MARGIN_X * 2 - 0.2 * 3) / 4;
    addMetricCard(slide, MARGIN_X + 0 * (kpiW + 0.2), 1.2, kpiW, 1.05, 'Total Tiendas', d.total, 'Plaza Oaxaca', true);
    addMetricCard(slide, MARGIN_X + 1 * (kpiW + 0.2), 1.2, kpiW, 1.05, 'Cobertura Estructura', `${d.cobertura.toFixed(0)}%`, `${OXXO.formatNum(d.totalActivos)} de ${OXXO.formatNum(d.totalTreo)} posiciones`, true);
    addMetricCard(slide, MARGIN_X + 2 * (kpiW + 0.2), 1.2, kpiW, 1.05, 'Alineadas', d.alineadas, `${d.total ? Math.round(d.alineadas/d.total*100) : 0}% del total`, true);
    addMetricCard(slide, MARGIN_X + 3 * (kpiW + 0.2), 1.2, kpiW, 1.05, 'Vacantes Totales', OXXO.formatNum(d.totalVacantes), 'En tiendas filtradas', true);
    addMetricCard(slide, MARGIN_X + 0 * (kpiW + 0.2), 2.4, kpiW, 0.85, 'Por Subir ▲', OXXO.formatNum(Math.round(d.posSubir)), `+${OXXO.formatNum(Math.round(d.posSubir))} posiciones a agregar`);
    addMetricCard(slide, MARGIN_X + 1 * (kpiW + 0.2), 2.4, kpiW, 0.85, 'Por Bajar ▼', OXXO.formatNum(Math.round(d.posBajar)), `-${OXXO.formatNum(Math.round(d.posBajar))} posiciones a liberar`);
    addMetricCard(slide, MARGIN_X + 2 * (kpiW + 0.2), 2.4, kpiW, 0.85, 'Sub-dotadas', d.subir, 'Activos < TREO');
    addMetricCard(slide, MARGIN_X + 3 * (kpiW + 0.2), 2.4, kpiW, 0.85, 'Sobre-dotadas', d.bajar, 'Activos > TREO');
    addDoughnutCard(pptx, slide, MARGIN_X, 3.5, PAGE_W - MARGIN_X * 2, 3.5, 'Alineación Global', [
      { label: 'Alineada', value: d.alineadas, color: GREEN },
      { label: 'Subir', value: d.subir, color: GOLD },
      { label: 'Bajar', value: d.bajar, color: RED },
    ]);
  }

  const DASHBOARDS = [
    { title: 'VACANTES', fetch: dataD1, build: buildD1 },
    { title: 'BAJAS', fetch: dataD2, build: buildD2 },
    { title: 'APROVECHAMIENTO DE ESTRUCTURA', fetch: dataD3, build: buildD3 },
    { title: 'TIEMPO EXTRA', fetch: dataD4, build: buildD4 },
    { title: 'CONTROL DE VACACIONES', fetch: dataD5, build: buildD5 },
    { title: 'AUSENTISMOS', fetch: dataD6, build: buildD6 },
    { title: 'TREO · ESTRUCTURA', fetch: dataD7, build: buildD7 },
  ];

  async function generatePresentation(){
    const statusEl = document.getElementById('pptx-rae-status');
    const btn = document.getElementById('generate-pptx-rae-btn');
    btn.disabled = true;
    btn.textContent = 'Generando...';
    if(statusEl) statusEl.textContent = 'Consultando Google Sheets...';
    try {
      const today = new Date();
      const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const dateLabel = `${MESES[today.getMonth()]} ${today.getFullYear()}`;

      const pptx = new window.PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE'; // 13.333in x 7.5in, igual que RAE_BASE.pptx

      const title = pptx.addSlide();
      title.background = { color: RED };
      title.addText('Presentación RAE', { x: 0.8, y: 2.3, w: 11.7, h: 1.3, fontSize: 40, bold: true, color: 'FFFFFF', fontFace: 'Arial' });
      title.addText('Indicadores clave · Plaza Oaxaca', { x: 0.8, y: 3.7, w: 11.7, h: 0.5, fontSize: 20, color: 'FFD7D5', fontFace: 'Arial' });
      title.addText(today.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }), { x: 0.8, y: 6.4, w: 11.7, h: 0.4, fontSize: 13, color: 'FFD7D5', fontFace: 'Arial' });

      for(const d of DASHBOARDS){
        try {
          const data = await d.fetch();
          if(data) d.build(pptx, data, dateLabel);
          else emptySlide(pptx, d.title, dateLabel);
        } catch(e){
          console.error('Error generando slide', d.title, e);
          emptySlide(pptx, d.title, dateLabel);
        }
      }

      const fileName = `Presentacion-RAE-Oaxaca-${today.toISOString().slice(0,10)}.pptx`;
      await pptx.writeFile({ fileName });
      if(statusEl) statusEl.textContent = 'Presentación generada correctamente.';
    } catch(e){
      console.error(e);
      if(statusEl) statusEl.textContent = 'Error al generar la presentación: ' + e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '📊 Generar Presentación RAE';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('generate-pptx-rae-btn');
    if(btn) btn.addEventListener('click', generatePresentation);
  });
})();
