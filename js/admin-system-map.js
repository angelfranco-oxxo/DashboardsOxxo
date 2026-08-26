/* Mapa navegable del origen, almacenamiento y consumo de cada dashboard. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const AREA_LABELS = { rh: 'Recursos Humanos', comercial: 'Comercial', administrativo: 'Administrativo' };
  const CONNECTIONS = [
    { id: 'd1', area: 'rh', title: 'Vacantes diarias', sheet: 'Dashboard_1_Diario', origin: 'Excel de Estructura', frequency: 'Diaria / mensual', mode: 'Reemplaza el mes cargado', consumers: 'Dashboard 1 · Mi Tienda · Mi Dashboard', copy: 'Publica todas las posiciones de estructura; el dashboard identifica las vacantes y calcula días abiertos.' },
    { id: 'd2', area: 'rh', title: 'Bajas diarias', sheet: 'Dashboard_2_Diario', origin: 'Excel de Bajas', frequency: 'Diaria / mensual', mode: 'Reemplaza el mes cargado', consumers: 'Dashboard 2 · Análisis · Mi Tienda', copy: 'Normaliza empleados, tienda, motivo, puesto y temporalidad; conserva el histórico por mes.' },
    { id: 'd3', area: 'rh', title: 'Aprovechamiento', sheet: 'Dashboard_3_Diario', origin: 'Excel ZCS · Medición', frequency: 'Diaria', mode: 'Reemplaza la foto completa', consumers: 'Dashboard 3 · Mi Tienda · Mi Dashboard', copy: 'Convierte la medición de estructura en estatus operativo y aprovechamiento por tienda y asesor.' },
    { id: 'd4', area: 'rh', title: 'Tiempo extra', sheet: 'Dashboard_4_Semanal', origin: 'Excel Base de datos TE', frequency: 'Semanal', mode: 'Reemplaza la semana cargada', consumers: 'Dashboard 4 · Mi Tienda', copy: 'Publica horas, gasto, empleados y tienda; los filtros calculan totales por semana y asesor.' },
    { id: 'd5', area: 'rh', title: 'Vacaciones', sheet: 'Dashboard_5_Semanal', origin: 'Excel Vacaciones Op', frequency: 'Semanal', mode: 'Reemplaza la foto completa', consumers: 'Dashboard 5 · Mi Tienda', copy: 'Relaciona colaborador, tienda y días restantes para presentar saldos vigentes.' },
    { id: 'd6', area: 'rh', title: 'Ausentismos', sheet: 'Dashboard_6_Semanal', origin: 'Excel Absentismos', frequency: 'Semanal', mode: 'Reemplaza la semana cargada', consumers: 'Dashboard 6 · Mi Tienda', copy: 'Distribuye ausencias por tipo, puesto, tienda, asesor y semana; conserva el histórico semanal.' },
    { id: 'd7', area: 'rh', title: 'TREO', sheet: 'Dashboard_7_Semanal', origin: 'Excel Liberación', frequency: 'Semanal', mode: 'Reemplaza la foto completa', consumers: 'Dashboard 7 · Mi Tienda · Mi Dashboard', copy: 'Compara estructura propuesta, SAP, activos y vacantes para recomendar movimientos.' },
    { id: 'd8', area: 'rh', title: 'Capacidades 2026', sheet: 'Dashboard_8_Diario', origin: 'Excel Capacidades', frequency: 'Diaria', mode: 'Reemplaza la foto completa', consumers: 'Dashboard 8 · Mi Tienda', copy: 'Publica certificaciones por colaborador, puesto y tienda; los vacíos se tratan como no aplicables.' },
    { id: 'd10', area: 'rh', title: 'Personal FLEX', sheet: 'Dashboard_10_FLEX', origin: 'Excel Personal FLEX', frequency: 'Semanal', mode: 'Reemplaza la foto completa', consumers: 'Dashboard 10 · Mi Tienda', copy: 'Concentra el número de colaboradores FLEX por tienda y asesor.' },
    { id: 'd11', area: 'rh', title: 'Registro y apego', sheet: 'Dashboard_11_Semanal', origin: 'Excel de checador', frequency: 'Semanal', mode: 'Reemplaza la foto completa', consumers: 'Dashboard 11 · Mi Tienda', copy: 'Publica porcentajes de entradas, salidas, edición y apego por tienda y asesor.' },
    { id: 'd12', area: 'rh', title: 'Enfoque del Líder', sheet: 'Dashboard_12_Mensual', origin: 'Excel Enfoque del Líder', frequency: 'Mensual', mode: 'Reemplaza el mes cargado', consumers: 'Dashboard 12', copy: 'Conserva doce meses por tienda y combina estructura, faltantes, ventas, cliente y etapa del líder.' },
    { id: 'd13', area: 'rh', title: 'Control de ausentismo', sheet: 'Dashboard_13_Ausentismo', origin: 'Excel Sábana + Carátula', frequency: 'Mensual', mode: 'Reemplaza base y resumen', consumers: 'Dashboard 13', copy: 'La Sábana aporta casos y días; Carátula agrega Head Count, histórico 2025 y costo diario.' },
    { id: 'c14', area: 'comercial', title: 'Avance Comercial', sheet: 'Dashboard_14_Comercial', origin: 'Excel de avance comercial', frequency: 'Quincenal', mode: 'Reemplaza la foto completa', consumers: 'Dashboard 14', copy: 'Concentra SPIN, Premia, Cruzada Andatti, Venta Sugerida, Banner y MEP por tienda.' },
    { id: 'promos', area: 'comercial', title: 'PromosD100', sheet: 'Promociones', origin: 'Captura directa en Google Sheets', frequency: 'Cuando cambia una promoción', mode: 'Edición directa por fila', consumers: 'Galería PromosD100', copy: 'Las URLs de imagen, vigencias, categoría y orden se administran directamente en la hoja central.' },
    { id: 's9', area: 'administrativo', title: 'Faltantes y sobrantes', sheet: 'Dashboard_9_Semanal', origin: 'Excel de Recolección', frequency: 'Semanal / mensual', mode: 'Reemplaza semanas del archivo', consumers: 'Dashboard 9 · Análisis · Mi Tienda', copy: 'El signo del importe clasifica faltante o sobrante y cada hoja mensual conserva sus semanas.' },
    { id: 'inventarios', area: 'administrativo', title: 'Resultados de inventario', sheet: 'Inventarios', origin: 'Excel Resultado de Inventario', frequency: 'Mensual', mode: 'Reemplaza el periodo cargado', consumers: 'Inventarios · Mi Tienda', copy: 'Normaliza CR, tienda, fechas, merma, venta sin TAE y resultado final, conservando meses anteriores.' }
  ];

  let activeFilter = 'all';
  let activeId = CONNECTIONS[0].id;

  function renderGrid() {
    const visible = CONNECTIONS.filter((item) => activeFilter === 'all' || item.area === activeFilter);
    if (!visible.some((item) => item.id === activeId)) activeId = visible[0]?.id || '';
    $('system-map-grid').innerHTML = visible.map((item) => `<button class="system-map-source ${item.id === activeId ? 'active' : ''}" type="button" data-map-id="${esc(item.id)}" data-area="${esc(item.area)}" aria-pressed="${item.id === activeId}"><span>${esc(AREA_LABELS[item.area])}</span><strong>${esc(item.title)}</strong><small>${esc(item.sheet)}</small></button>`).join('');
    renderDetail();
  }

  function renderDetail() {
    const item = CONNECTIONS.find((connection) => connection.id === activeId);
    if (!item) return;
    $('system-map-route-title').textContent = item.title;
    $('system-map-route-copy').textContent = item.copy;
    $('system-map-route-path').innerHTML = `<span>${esc(item.origin)}</span><b>›</b><span>Panel Admin</span><b>›</b><span>Apps Script</span><b>›</b><span>${esc(item.sheet)}</span><b>›</b><span>${esc(item.consumers)}</span>`;
    $('system-map-facts').innerHTML = `<div class="system-map-fact"><span>Hoja central</span><strong>${esc(item.sheet)}</strong></div><div class="system-map-fact"><span>Actualización</span><strong>${esc(item.frequency)}</strong></div><div class="system-map-fact"><span>Modo de carga</span><strong>${esc(item.mode)}</strong></div><div class="system-map-fact"><span>Consumidores</span><strong>${esc(item.consumers)}</strong></div>`;
  }

  function bind() {
    const grid = $('system-map-grid');
    if (!grid) return;
    grid.addEventListener('click', (event) => {
      const button = event.target.closest('[data-map-id]');
      if (!button) return;
      activeId = button.dataset.mapId;
      renderGrid();
    });
    document.querySelectorAll('[data-map-filter]').forEach((button) => button.addEventListener('click', () => {
      activeFilter = button.dataset.mapFilter;
      document.querySelectorAll('[data-map-filter]').forEach((item) => item.classList.toggle('active', item === button));
      renderGrid();
    }));
    renderGrid();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
