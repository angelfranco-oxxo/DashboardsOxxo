/* ==========================================================
   OXXO ADMIN - NORMALIZADORES Y REGLAS
   Lee matrices de Excel, detecta columnas, limpia datos,
   deriva campos por dashboard y calcula periodos de carga.
   ========================================================== */

window.OXXO_ADMIN_NORMALIZERS = function createAdminNormalizers(deps){
  const {state,norm,normLoose,aliasesFor,dashboard,$} = deps;

  function getHeaders(rows){const set=new Set();rows.forEach(row=>Object.keys(row||{}).forEach(key=>set.add(key)));return [...set];}
  function containsOaxaca(value){return normLoose(value).includes('oaxaca');}
  function toNumber(value){const n=Number(String(value??'').replace(/[$,%]/g,'').replace(/,/g,'').trim());return Number.isFinite(n)?n:0;}
  function pctValue(value){const n=toNumber(value);if(!n)return 0;return n<=1?n*100:n;}
  function parseDate(value){
    if(value instanceof Date&&!isNaN(value))return value;
    const raw=String(value??'').trim();if(!raw||/^n\/?a$/i.test(raw))return null;
    if(/^\d+(\.\d+)?$/.test(raw)){const serial=Number(raw);if(serial>25000&&serial<80000)return new Date(Date.UTC(1899,11,30)+serial*86400000);}
    const embedded=raw.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
    const clean=(embedded?embedded[0]:raw.replace(/\s+\d{1,2}:\d{2}(:\d{2})?.*$/,'')).replace(/[.]/g,'/').replace(/-/g,'/');
    const parts=clean.split('/').map(p=>p.trim()).filter(Boolean);
    if(parts.length>=3){let day,month,year;if(parts[0].length===4){year=Number(parts[0]);month=Number(parts[1]);day=Number(parts[2]);}else{day=Number(parts[0]);month=Number(parts[1]);year=Number(parts[2]);}if(year<100)year+=2000;const d=new Date(year,month-1,day);if(!isNaN(d))return d;}
    const d=new Date(raw);return isNaN(d)?null:d;
  }
  function isoDate(date){return date?`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`:'';}
  function monthKey(date){if(!date)return '';const abbr=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][date.getMonth()];return `${abbr}-${String(date.getFullYear()).slice(-2)}`;}
  function daysBetween(start,end){if(!start||!end)return '';const a=new Date(start.getFullYear(),start.getMonth(),start.getDate()).getTime();const b=new Date(end.getFullYear(),end.getMonth(),end.getDate()).getTime();return Math.max(0,Math.floor((b-a)/86400000));}
  function extractStatusDate(value){const m=String(value??'').match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);return m?parseDate(m[0]):null;}
  function vacancyDaysValue(value){
    const raw=String(value??'').trim();
    if(!raw||/finaliz/i.test(raw))return '';
    const d=parseDate(raw);
    if(d&&d.getFullYear()<=1901){
      const base=Date.UTC(1899,11,30);
      return Math.max(0,Math.round((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-base)/86400000));
    }
    if(/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/.test(raw))return '';
    const n=toNumber(raw);
    return Number.isFinite(n)&&n>=0?n:'';
  }  function isVacancyRow(row){const status=normLoose(row['Status ocupacion']);return status.includes('vacante')||status.includes('no ocupado');}

  function dateFromText(value){const m=String(value||'').match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);return m?parseDate(m[0]):null;}
  function monthFromSourceName(){return monthKey(dateFromText(state.fileName)||dateFromText(state.sheetName));}
  function deriveD1(row){const fecha=parseDate(row.Fecha)||extractStatusDate(row['Status ocupacion']);const today=new Date();const sourceMonth=monthFromSourceName();const dias=vacancyDaysValue(row['Dias Vacantes']);return {...row,Fecha:isoDate(fecha),'Dias Vacantes':dias!==''?dias:daysBetween(fecha,today),Mes:sourceMonth||monthKey(parseDate(row.Mes))||monthKey(fecha)};}
  function deriveD2(row){const fecha=parseDate(row.Fecha);const sourceMonth=monthFromSourceName();return {...row,Fecha:isoDate(fecha),Mes:sourceMonth||monthKey(parseDate(row.Mes))||monthKey(fecha)};}
  function deriveD2Denom(row){const fecha=parseDate(row['F.Crea']);const sourceMonth=monthFromSourceName();return {...row,'F.Crea':isoDate(fecha),Mes:sourceMonth||monthKey(parseDate(row.Mes))||monthKey(fecha)};}
  function deriveD3(row){const raw=pctValue(row['Aprovechamiento Estructura']);return {...row,'Aprovechamiento Estructura':raw,'Aprovechamiento Binario':raw>=95?100:0};}
  function deriveD5(row){return {...row,Fecha_Inicio:isoDate(parseDate(row.Fecha_Inicio)),Fecha_Fin:isoDate(parseDate(row.Fecha_Fin)),Periodo_Anterior:row.Periodo_Anterior||0,Periodo_Actual:row.Periodo_Actual||0,Dias_Restantes:row.Dias_Restantes||row['Total dias restantes']||0};}
  function deriveD6(row){return {...row,'Inicio de validez':isoDate(parseDate(row['Inicio de validez'])),'Fin de validez':isoDate(parseDate(row['Fin de validez'])),'Inicio de semana':isoDate(parseDate(row['Inicio de semana'])),'Fin de semana':isoDate(parseDate(row['Fin de semana'])),Dias:row.Dias||row['Absentismos solo en la semana']||0};}
  function deriveD7(row){return {...row,'Estructura Propuesta TREO P2 Jun - Ago':row['Estructura Propuesta TREO P2 Jun - Ago']||row.TREO,'Estructura SAP':row['Estructura SAP']||row.SAP,'Empleados Activos':row['Empleados Activos']||row.Activos,'Dif SAP vs Est Optima Final':row['Dif SAP vs Est Optima Final']||row.DIF,'Movimiento Inicial':row['Movimiento Inicial']||row.Movimiento};}
  function deriveCatalog(row){return {...row,ASESOR:String(row.ASESOR||'').trim(),TIENDA:String(row.TIENDA||'').trim(),'CR TIENDA':String(row['CR TIENDA']||'').trim().toUpperCase()};}

  function findHeaderRow(matrix,dash){const limit=Math.min(matrix.length,40);let best={index:0,score:-1};for(let i=0;i<limit;i++){const cells=(matrix[i]||[]).map(norm).filter(Boolean);const score=dash.required.reduce((total,col)=>total+(aliasesFor(col).some(alias=>cells.includes(alias))?1:0),0)+Math.min(cells.length,12)/100;if(score>best.score)best={index:i,score};}return best;}
  function buildSourceMap(sourceHeaders){const sourceMap=new Map();sourceHeaders.forEach((header,index)=>{const key=norm(header);if(key&&!sourceMap.has(key))sourceMap.set(key,index);});return sourceMap;}
  function matchColumns(sourceMap,dash){const matched={};dash.output.forEach(col=>{const exact=aliasesFor(col).find(alias=>sourceMap.has(alias));if(exact)matched[col]=sourceMap.get(exact);});return matched;}
  function rowsFromMatrix(matrix,dash){
    if(!matrix.length)return{rows:[],headers:[],headerRow:0,sourceRows:0,sourceHeaders:[]};
    const headerInfo=findHeaderRow(matrix,dash);
    const sourceHeaders=(matrix[headerInfo.index]||[]).map((value,index)=>String(value||`Columna ${index+1}`).trim());
    const matched=matchColumns(buildSourceMap(sourceHeaders),dash);
    const rawRows=matrix.slice(headerInfo.index+1).map(line=>{const row={};dash.output.forEach(col=>{row[col]=matched[col]!==undefined?(line[matched[col]]??''):'';});return row;}).filter(row=>Object.values(row).some(v=>String(v??'').trim()!==''));
    const filtered=rawRows.map(row=>dash.derive?dash.derive(row):row).filter(row=>!dash.filter||dash.filter(row)).map(row=>{const cleaned={};dash.output.forEach(col=>{cleaned[col]=row[col]??'';});return cleaned;});
    return{rows:filtered,headers:dash.output,headerRow:headerInfo.index+1,sourceRows:rawRows.length,sourceHeaders};
  }
  function evaluateSheet(name,dash){const sheet=state.workbook.Sheets[name];const matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false});const parsed=rowsFromMatrix(matrix,dash);const missing=dash.required.filter(col=>!parsed.rows.some(row=>String(row[col]??'').trim()!==''));const preference=(dash.preferredSheets||[]).some(s=>norm(s)===norm(name))?1000:0;return{name,parsed,missing,score:preference+parsed.rows.length-missing.length*100};}
  function autoSelectSheet(){if(!state.workbook)return;const dash=dashboard();const evaluations=state.workbook.SheetNames.map(name=>evaluateSheet(name,dash)).sort((a,b)=>b.score-a.score);const best=evaluations[0];if(best&&best.name&&$('sheet-select').value!==best.name){$('sheet-select').value=best.name;state.sheetName=best.name;}}

  function periodInfo(dash,rows){const column=dash.periodColumn||'';const values=column?[...new Set(rows.map(row=>String(row[column]??'').trim()).filter(Boolean))]:[];return{column,values,enabled:Boolean(column&&values.length)};}

  return {
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
  };
};