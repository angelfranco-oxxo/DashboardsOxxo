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
  // Anadelia ya no existe y su estructura/tiendas quedaron a cargo de Timo,
  // asi que sus filas se cuentan en la columna "Timoteo" de este reporte.
  const ASESOR_RENOMBRE = { 'anadelia': 'Timoteo' };
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

  // Decodifica entidades XML, incluidas las numericas (&#233; / &#x1F600;)
  // que Excel/openpyxl usan para acentos y caracteres especiales (ej. "H&#233;ctor").
  function decodeXmlText(s){
    return String(s || '')
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }
  function decodeSharedString(sharedXml, idx){
    const items = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)];
    const si = items[idx];
    if(!si) return '';
    const texts = [...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1]);
    return decodeXmlText(texts.join(''));
  }

  // Lee el texto de una celda (soporta shared string, numero/texto directo,
  // O texto inline t="inlineStr" <is><t>...</t></is> — este ultimo es el
  // formato en el que quedan las celdas de texto cuando Excel/openpyxl
  // resguardan el archivo, y sin soportarlo getCellText() nunca encontraba
  // los encabezados de asesor (C1..M1), asi que el generador nunca escribia
  // nada (0 celdas actualizadas) sin dar ningun error visible.
  // Sin modificar nada — se usa solo para leer los encabezados (fila 1).
  function getCellText(sheetXml, sharedXml, ref){
    const m = sheetXml.match(new RegExp(`<c r="${ref}"([^>]*)>([\\s\\S]*?)</c>`));
    if(!m) return '';
    const [, attrs, inner] = m;
    if(/\bt="inlineStr"/.test(attrs)){
      const tMatch = inner.match(/<is>\s*<t[^>]*>([\s\S]*?)<\/t>\s*<\/is>/);
      return tMatch ? decodeXmlText(tMatch[1]) : '';
    }
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
      await window.OXXO_ADMIN_ASSETS.ensure('jszip');
      const res = await fetch(`${TEMPLATE_URL}?v=${Date.now()}`, { cache: 'no-store' });
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
      btn.innerHTML = '<svg class="icon-inline" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>Generar Indicadores ATs';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('generate-indicadores-btn');
    if(btn) btn.addEventListener('click', generateIndicadores);
  });
})();
