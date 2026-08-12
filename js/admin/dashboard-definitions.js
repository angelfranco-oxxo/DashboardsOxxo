/* ==========================================================
   OXXO ADMIN - DEFINICIONES DE DASHBOARDS
   Configura hojas destino, columnas, reglas y notas de carga.
   La logica de normalizacion se queda privada en admin.js.
   ========================================================== */

window.OXXO_ADMIN_DASHBOARDS = function createAdminDashboards(deps){
  const {
    OXXO,
    containsOaxaca,
    isVacancyRow,
    deriveD1,
    deriveD2,
    deriveD2Denom,
    deriveD3,
    deriveD5,
    deriveD6,
    deriveD7,
    deriveCatalog
  } = deps;

  // d2otras: mismas 4 plazas que ya se capturaban a mano en el formulario
  // manual (Chontalpa, Villahermosa, Costa Istmo, Tuxtla) para el ranking
  // comparativo del Dashboard 2. Ahora se cuentan solas desde la hoja "Bajas"
  // del Excel ABC (una fila por baja, columna Plaza), agrupando y sumando 1
  // por fila -- ya no hace falta escribirlas a mano cada vez.
  function normPlazaNombre(v){return String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').trim().toUpperCase();}
  const PEER_PLAZAS_D2OTRAS=['Chontalpa','Villahermosa','Costa Istmo','Tuxtla'];
  const PEER_SET_D2OTRAS=new Set(PEER_PLAZAS_D2OTRAS.map(normPlazaNombre));
  function todayIsoD2Otras(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function deriveD2Otras(row){
    // Fila ya agregada (formato viejo: Plazas + Bajas Plaza con numero) se
    // deja intacta. Fila cruda (una baja, columna Plaza) se marca para que
    // el filtro/aggregate sepan tratarla como "1 baja de esa plaza".
    const bajasNum=Number(row['Bajas Plaza']);
    const yaAgregada=Number.isFinite(bajasNum)&&bajasNum>0&&String(row['Bajas Plaza']||'').trim()!==''&&String(row.Plazas||'').trim()!=='';
    return yaAgregada?row:{...row,Plaza:String(row.Plaza||'').trim()};
  }
  function aggregateD2Otras(rows){
    const porPlaza=new Map();
    rows.forEach(row=>{
      const bajasNum=Number(row['Bajas Plaza']);
      const yaAgregada=Number.isFinite(bajasNum)&&bajasNum>0&&String(row['Bajas Plaza']||'').trim()!==''&&String(row.Plazas||'').trim()!=='';
      const nombre=yaAgregada?String(row.Plazas).trim():String(row.Plaza||'').trim();
      if(!nombre)return;
      const suma=yaAgregada?bajasNum:1;
      porPlaza.set(nombre,(porPlaza.get(nombre)||0)+suma);
    });
    const hoy=todayIsoD2Otras();
    return [...porPlaza.entries()]
      .map(([Plazas,Bajas])=>({Plazas,'Bajas Plaza':Bajas,Actualizado:hoy}))
      .sort((a,b)=>b['Bajas Plaza']-a['Bajas Plaza']);
  }

  return [
    {key:'d1',label:'Dashboard 1 - Vacantes diarias',tab:OXXO.SHEETS_CONFIG.TABS.d1,periodColumn:'Mes',preferredSheets:['Estructura','Dashboard_1_Diario'],output:['Plaza','Asesor','Unidad org','CR TIENDA','ID posiciones','Descripcion de Posicion','Status ocupacion','Empleados','Fecha','Dias Vacantes','Mes'],required:['Plaza','Asesor','Unidad org','ID posiciones','Descripcion de Posicion','Status ocupacion'],filter:r=>containsOaxaca(r.Plaza),derive:deriveD1,notes:'Estructura cruda. Mes se toma del nombre del archivo; Dias Vacantes se deriva del texto vacante si no viene en el archivo. Se publican TODAS las posiciones (no solo vacantes) para que TREO calcule SAP/Activos por tienda; Dashboard 1 filtra por su cuenta las que son vacante (Status/Empleados vacio).'},
    {key:'d2',label:'Dashboard 2 - Bajas diarias',tab:OXXO.SHEETS_CONFIG.TABS.d2,periodColumn:'Mes',preferredSheets:['Bajas'],output:['Plaza','Asesor','Nombre del empleado','No Personal','Fecha','Mes','Semana','Temporalidad','Rot_Temp','Puesto','Tienda','Motivo','Detalle','Edad','Genero'],required:['Plaza','Asesor','Nombre del empleado','Fecha','Semana','Temporalidad','Rot_Temp','Puesto','Tienda'],filter:r=>containsOaxaca(r.Plaza),derive:deriveD2,notes:'Base principal de bajas. Mes se toma del nombre del archivo si trae fecha; si no, se calcula con F. Validez/Fecha.'},
    {key:'d2otras',label:'Dashboard 2 - Bajas otras plazas',tab:OXXO.SHEETS_CONFIG.TABS.d2otras,periodColumn:'',preferredSheets:['Bajas'],sourceColumns:['Plazas','Bajas Plaza','Plaza'],output:['Plazas','Bajas Plaza','Actualizado'],required:['Plazas','Bajas Plaza'],
      filter:r=>{
        const bajasNum=Number(r['Bajas Plaza']);
        const yaAgregada=Number.isFinite(bajasNum)&&bajasNum>0&&String(r['Bajas Plaza']||'').trim()!==''&&String(r.Plazas||'').trim()!=='';
        if(yaAgregada)return true;
        const plaza=String(r.Plaza||'').trim();
        if(!plaza||containsOaxaca(plaza))return false;
        return PEER_SET_D2OTRAS.has(normPlazaNombre(plaza));
      },
      derive:deriveD2Otras,
      aggregate:aggregateD2Otras,
      notes:'Ranking comparativo de bajas por plaza (Chontalpa, Villahermosa, Costa Istmo, Tuxtla) para el Dashboard 2. Sube la hoja "Bajas" del Excel ABC completo (una fila por baja, columna Plaza): se agrupan y cuentan solas, Oaxaca se excluye porque ya la cubre el Dashboard 2 principal. Tambien acepta el formato viejo ya agregado (columnas Plazas + Bajas Plaza).'},
    {key:'d2denom',label:'Dashboard 2 - Movimientos ABC',tab:OXXO.SHEETS_CONFIG.TABS.d2denom,periodColumn:'',preferredSheets:['ABC'],output:['Plaza','Asesor','Mes','Denominacion Medida','Denominacion Motivo','Nombre del empleado','F.Crea','Denominacion Posicion Anterior','Denominacion Posicion Actual','Denominacion Funcion Anterior','Denominacion Funcion Actual','Denominacion U.Org. Actual'],required:['Plaza','Asesor','Denominacion Medida','Nombre del empleado','F.Crea','Denominacion Funcion Anterior','Denominacion Funcion Actual'],filter:r=>containsOaxaca(r.Plaza)&&/cambio\s+de\s+puesto/i.test(String(r['Denominacion Medida']||'')),derive:deriveD2Denom,notes:'Detalle ABC: solo CAMBIO DE PUESTO. Mes se toma del nombre del archivo si trae fecha; ascenso/descenso lo calcula el dashboard.'},
    {key:'d2plan',label:'Dashboard 2 - Plan de accion (Analisis de Bajas)',tab:OXXO.SHEETS_CONFIG.TABS.d2plan,periodColumn:'',preferredSheets:['Plan de Accion'],output:['Hallazgo','Accion','Responsable','Plazo','Indicador','Prioridad'],required:['Hallazgo','Accion'],filter:r=>Boolean(String(r.Hallazgo||'').trim()),derive:r=>r,notes:'Plan de accion mensual del Analisis de Bajas. Captura manual: Hallazgo, Accion, Responsable, Plazo, Indicador de exito, Prioridad.'},
    {key:'d3plazas',label:'Dashboard 3 - Aprovechamiento otras plazas',tab:OXXO.SHEETS_CONFIG.TABS.d3plazas,periodColumn:'',preferredSheets:['Medicion'],output:['PLAZAS','Aprovechamiento de estructura a hoy'],required:['PLAZAS','Aprovechamiento de estructura a hoy'],filter:r=>Boolean(String(r.PLAZAS||'').trim()),derive:r=>r,notes:'Aprovechamiento por plaza para el ranking comparativo del Dashboard 3. Columnas: PLAZAS y Aprovechamiento de estructura a hoy (valor entre 0 y 100).'},
    {key:'d3',label:'Dashboard 3 - Estructura',tab:OXXO.SHEETS_CONFIG.TABS.d3,periodColumn:'',preferredSheets:['Medicion'],output:['Plaza','CR TIENDA','UO','Asesor','Tienda','Esquema','Estructura Diaria','AUSENTISMOS','Vacante','LIDER','ENCARGADO','AYUDANTE','Vacantes','Aprovechamiento Estructura','Aprovechamiento Binario','Estatus Con impacto Ausentismo','EC SIN AUSENTISMO','FECHA'],required:['Plaza','CR TIENDA','Asesor','Tienda','Estructura Diaria','Aprovechamiento Estructura','Estatus Con impacto Ausentismo','FECHA'],filter:r=>containsOaxaca(r.Plaza),derive:deriveD3,notes:'Regla D3: Aprovechamiento Estructura >= 95% cuenta como 100%, menor a 95% cuenta como 0%. Cada carga reemplaza toda la pestana (es una foto diaria, no un historico por periodo).'},
    {key:'s4',label:'Dashboard 4 - Tiempo extra',tab:OXXO.SHEETS_CONFIG.TABS.s4,periodColumn:'Semana',preferredSheets:['Base de datos TE'],output:['Zona','Region','Plaza','Asesor','Numero de personal','Nombre del empleado o candidato','Esquema','Textos homologados','Texto breve de unidad organizativa','Cr de Tienda','Cantidad','Importe','Ano','Mes','Semana'],required:['Plaza','Asesor','Nombre del empleado o candidato','Textos homologados','Texto breve de unidad organizativa','Cantidad','Importe','Semana'],filter:r=>containsOaxaca(r.Plaza),derive:r=>r,notes:'Base limpia de tiempo extra. Usar Cantidad como horas e Importe como gasto.'},
    {key:'s5',label:'Dashboard 5 - Vacaciones',tab:OXXO.SHEETS_CONFIG.TABS.s5,preferredSheets:['Vacaciones Op'],output:['Region','Plaza','Asesor','Tienda','Puesto','Posicion','Area','No. De Empleado','Nombre','Fecha_Inicio','Fecha_Fin','Periodo_Anterior','Periodo_Actual','Dias_Restantes','Bucket_Ant','Bucket_Act','Tipo de Conting.'],required:['Plaza','Asesor','Tienda','Puesto','No. De Empleado','Nombre','Dias_Restantes'],filter:r=>containsOaxaca(r.Plaza),derive:deriveD5,notes:'Vacaciones Op. El indicador principal es Total dias restantes.'},
    {key:'s6',label:'Dashboard 6 - Ausentismos',tab:OXXO.SHEETS_CONFIG.TABS.s6,periodColumn:'Semana',preferredSheets:['Absentismos'],output:['Zona','Region','Plaza','Asesor','N de personal','Nombre del empleado o candidato','Estatus','Esquema','Puesto','Cr de Tienda','Tienda','Tipo_Ausentismo','Denominacion','Inicio de validez','Fin de validez','Dias','Horas','Absentismos solo en la semana','Inicio de semana','Fin de semana','Ano','Mes','Semana'],required:['Plaza','Asesor','N de personal','Nombre del empleado o candidato','Tienda','Tipo_Ausentismo','Denominacion','Absentismos solo en la semana','Semana'],filter:r=>containsOaxaca(r.Plaza),derive:deriveD6,notes:'Absentismos. La metrica principal es Absentismos solo en la semana.'},
    {key:'s7',label:'Dashboard 7 - TREO',tab:OXXO.SHEETS_CONFIG.TABS.s7,preferredSheets:['Liberacion','LiberaciÃ³n'],output:['Plaza','CR Reg','CR','Tienda','ID Tienda','Asesor','Accionable sugerido TREO','Estructura Propuesta TREO P2 Jun - Ago','Estructura SAP','Empleados Activos','Vacantes','Dif SAP vs Est Optima Final','Movimiento Inicial','Turnos','Antiguedad'],required:['Plaza','CR','Tienda','Asesor','Estructura Propuesta TREO P2 Jun - Ago','Estructura SAP','Empleados Activos','Vacantes','Movimiento Inicial'],filter:r=>containsOaxaca(r.Plaza),derive:deriveD7,notes:'Usa el primer bloque operativo: TREO=L, SAP=M, Activos=N, Vacantes=O, Movimiento=Q.'},
    {key:'d8',label:'Dashboard 8 - Capacidades',tab:OXXO.SHEETS_CONFIG.TABS.d8,preferredSheets:['Sheet1','Capacidades'],output:['Zona','Region','Plaza','Asesor_Correcto','Esquema','Unidad org.','Cr de tienda','Puesto_Correcto','Nº personal','Empleados','Promedio de Código de Ética 2026','Promedio de Seguridad en la persona 2026','Promedio de Cobro dls Sedes Mundialistas 2026','Promedio de Capacidad Tablero Amazon Counter','Promedio de PLD2026Certificacion','Promedio de ModuloCercaSiempre2026','Promedio de Resultado Certificación Alimentos y Bebidas 2026','Pan Horneado'],required:['Plaza','Asesor_Correcto','Puesto_Correcto','Empleados'],filter:r=>containsOaxaca(r.Plaza),derive:r=>r,notes:'Tablero de Capacidades: foto diaria de certificaciones por empleado, sin columna de periodo. Cada carga reemplaza toda la pestana. Las columnas de certificacion vienen 1=completo, 0=pendiente, fraccion=parcial y vacio=no aplica a ese puesto/tienda.'},
    {key:'catalog',label:'Catalogo de asesores',tab:OXXO.SHEETS_CONFIG.CATALOG_SHEET,preferredSheets:['Catalogo_Asesores','Catalogo asesores','Hoja1','ASESORES ACTJUNJUL'],output:['ASESOR','TIENDA','CR TIENDA'],required:['ASESOR','TIENDA','CR TIENDA'],filter:r=>Boolean(r.ASESOR&&(r.TIENDA||r['CR TIENDA'])),derive:deriveCatalog,notes:'Catalogo compartido para corregir asesor por CR/Tienda. Acepta archivos con titulo arriba y encabezados ASESOR, TIENDA, CR TIENDA.'}
  
  ];
};