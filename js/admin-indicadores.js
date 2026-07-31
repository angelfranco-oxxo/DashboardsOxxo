(function(){
  const TEMPLATE_URL = 'assets/INDICADORES_ATs_template.xlsx';
  // Filas del template (verificadas contra el archivo real subido por el
  // usuario): fila 2 = Aprovechamiento de estructura, fila 5 = Vacantes en
  // estructura, fila 11 = Alineación de estructura. El resto de las filas
  // (NPS, Ausentismo, las 4 Rotaciones, % Apego) no tienen fuente confiable
  // en los dashboards y se dejan intactas para llenarse a mano.
  const FILA_APROVECHAMIENTO = 2;
  const FILA_VACANTES = 5;
  const FILA_ALINEACION = 11;
  const COLUMNAS_AT = ['C','D','E','F','G','H','I','J','K','L','M'];

  // Renombres de asesor exclusivos de este Excel (no afectan los dashboards):
  // solo cambia la etiqueta que se muestra, NO fusiona/suma sus filas con las
  // de otro asesor existente.
  const ASESOR_RENOMBRE = { 'anadelia': 'Timo' };
  function renombrarAsesores(map){
    const out = new Map();
    map.forEach((value, name) => {
      const key = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      let nuevoNombre = name;
      for (const alias in ASESOR_RENOMBRE) {
        if (key.includes(alias)) { nuevoNombre = ASESOR_RENOMBRE[alias]; break; }
      }
      out.set(nuevoNombre, value);
    });
    return out;
  }

  function decodeSharedString(sharedXml, idx){
    const items = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)];
    const si = items[idx];
    if(!si) return '';
    const texts = [...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1]);
    return texts.join('')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }

  // Lee el texto de una celda (soporta shared string o numero/texto directo),
  // sin modificar nada — se usa solo para leer los encabezados (fila 1).
  function getCellText(sheetXml, sharedXml, ref){
    const m = sheetXml.match(new RegExp(`<c r="${ref}"([^>]*)>([\\s\\S]*?)</c>`));
    if(!m) return '';
    const [, attrs, inner] = m;
    const vMatch = inner.match(/<v>([^<]*)<\/v>/);
    if(!vMatch) return '';
    return /\bt="s"/.test(attrs) ? decodeSharedString(sharedXml, Number(vMatch[1])) : vMatch[1];
  }

  // Reemplaza SOLO el valor numerico dentro de <c r="ref" ...><v>...</v></c>,
  // conservando el atributo de estilo (s="N") y todo lo demas de la celda
  // intacto — asi el color/semaforo/formato condicional del template nunca
  // se toca, solo el numero.
  function setCellValue(sheetXml, ref, value){
    const re = new RegExp(`(<c r="${ref}"[^>]*>)([\\s\\S]*?)(</c>)`);
    if(!re.test(sheetXml)) return sheetXml;
    return sheetXml.replace(re, (full, open, inner, close) => {
      const openSinTexto = open.replace(/\s+t="s"/, '');
      const nuevoInner = inner.includes('<v>') ? inner.replace(/<v>[^<]*<\/v>/, `<v>${value}</v>`) : `<v>${value}</v>`;
      return openSinTexto + nuevoInner + close;
    });
  }

  async function generateIndicadores(){
    const statusEl = document.getElementById('indicadores-status');
    const btn = document.getElementById('generate-indicadores-btn');
    btn.disabled = true;
    btn.textContent = 'Generando...';
    if(statusEl) statusEl.textContent = 'Consultando Google Sheets...';
    try {
      const res = await fetch(TEMPLATE_URL);
      if(!res.ok) throw new Error(`No se pudo cargar la plantilla (HTTP ${res.status})`);
      const buf = await res.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);
      const sheetFile = zip.file('xl/worksheets/sheet1.xml');
      const sharedFile = zip.file('xl/sharedStrings.xml');
      if(!sheetFile) throw new Error('La plantilla no tiene xl/worksheets/sheet1.xml');
      let sheetXml = await sheetFile.async('string');
      const sharedXml = sharedFile ? await sharedFile.async('string') : '';

      const [vacantes, aprovechamiento, alineacion] = await Promise.all([
        OXXO.metricsVacantesPorAsesor(),
        OXXO.metricsAprovechamientoPorAT(),
        OXXO.metricsAlineacionPorAsesor(),
      ].map(p => p.then(renombrarAsesores)));

      let celdasActualizadas = 0;
      const sinMatch = [];
      for(const col of COLUMNAS_AT){
        const header = getCellText(sheetXml, sharedXml, `${col}1`).trim();
        if(!header) continue;
        const mAprov = OXXO.metricsMatchShortName(header, [...aprovechamiento.keys()]);
        const mAlin = OXXO.metricsMatchShortName(header, [...alineacion.keys()]);
        // Un asesor "activo" es el que aparece en Aprovechamiento o
        // Alineacion (siempre tienen una fila por cada tienda asignada). Si
        // aparece ahi pero NO en Vacantes, es porque tiene 0 vacantes ahora
        // mismo (esa lista solo genera filas cuando SI hay una vacante) —
        // hay que escribir 0, no dejar el valor viejo de la plantilla sin
        // tocar.
        const esAsesorActivo = mAprov !== null || mAlin !== null;
        const mVac = OXXO.metricsMatchShortName(header, [...vacantes.keys()]);
        if(mVac !== null || esAsesorActivo){ sheetXml = setCellValue(sheetXml, `${col}${FILA_VACANTES}`, mVac !== null ? vacantes.get(mVac) : 0); celdasActualizadas++; }
        if(mAprov !== null){ sheetXml = setCellValue(sheetXml, `${col}${FILA_APROVECHAMIENTO}`, aprovechamiento.get(mAprov)); celdasActualizadas++; }
        if(mAlin !== null){ sheetXml = setCellValue(sheetXml, `${col}${FILA_ALINEACION}`, alineacion.get(mAlin)); celdasActualizadas++; }
        if(!esAsesorActivo && mVac === null) sinMatch.push(header);
      }

      zip.file('xl/worksheets/sheet1.xml', sheetXml);
      const out = await zip.generateAsync({ type: 'uint8array' });
      const today = new Date();
      const fileName = `Indicadores-ATs-${today.toISOString().slice(0,10)}.xlsx`;
      OXXO.downloadBlob(out, fileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      if(statusEl){
        statusEl.textContent = sinMatch.length
          ? `Actualizado (${celdasActualizadas} celdas). Sin datos para: ${sinMatch.join(', ')}.`
          : `Actualizado correctamente (${celdasActualizadas} celdas).`;
      }
    } catch(e){
      console.error(e);
      if(statusEl) statusEl.textContent = 'Error al generar el archivo: ' + e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '📥 Generar Indicadores ATs';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('generate-indicadores-btn');
    if(btn) btn.addEventListener('click', generateIndicadores);
  });
})();
