const DATA_URL = '../assets/data/vacaciones-dashboard-5.json';
const charts = {};
const state = {
  rows: [],
  activeKpi: 'all',
  asesor: '',
  tienda: '',
  puesto: '',
  rango: '',
};

const KPI_DEFS = [
  { id: 'all', label: 'Dias restantes', color: 'rojo', tip: 'Suma de "dias_restantes" (saldo total de vacaciones pendiente) de todos los colaboradores con los filtros activos.' },
  { id: 'ant', label: 'Periodo anterior', color: 'amarillo', tip: 'Suma de "periodo_anterior": dias de vacaciones pendientes de ejercicios anteriores al actual.' },
  { id: 'act', label: 'Periodo actual', color: 'azul', tip: 'Suma de "periodo_actual": dias de vacaciones generados en el periodo en curso.' },
  { id: 'avg', label: 'Promedio', color: 'verde', tip: 'Dias restantes totales divididos entre el numero de colaboradores con saldo mayor a 0.' },
  { id: 'vencido', label: 'Vencidos ant.', color: 'rojo', tip: 'Colaboradores cuyo periodo anterior cae en el bucket "Vencido" segun fecha de vencimiento.' },
  { id: 'prox30', label: 'Vencen 0-30', color: 'amarillo', tip: 'Colaboradores cuyo periodo anterior vence en los proximos 0-30 dias.' },
];

function n(value, decimals = 0) {
  return Number(value || 0).toLocaleString('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function pct(value, total) {
  return total ? `${((value / total) * 100).toFixed(1)}%` : '0.0%';
}

function theme() {
  return OXXO.getChartThemeColors();
}

function destroyChart(id) {
  if (charts[id]) charts[id].destroy();
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
}

function rangeLabel(value) {
  const days = Number(value) || 0;
  if (days === 0) return '0';
  if (days <= 5) return '1-5';
  if (days <= 10) return '6-10';
  if (days <= 15) return '11-15';
  if (days <= 20) return '16-20';
  if (days <= 30) return '21-30';
  return '31+';
}

function bucketMatches(row, kpiId) {
  if (kpiId === 'ant') return row.periodo_anterior > 0;
  if (kpiId === 'act') return row.periodo_actual > 0;
  if (kpiId === 'avg') return row.dias_restantes > 0;
  if (kpiId === 'vencido') return row.vence_ant_bucket === 'Vencido';
  if (kpiId === 'prox30') return row.vence_ant_bucket === '0-30';
  return true;
}

function baseFilteredRows() {
  return state.rows.filter((row) => {
    if (state.asesor && row.asesor !== state.asesor) return false;
    if (state.tienda && row.tienda !== state.tienda) return false;
    if (state.puesto && row.puesto !== state.puesto) return false;
    if (state.rango && rangeLabel(row.dias_restantes) !== state.rango) return false;
    return true;
  });
}

function filteredRows() {
  return baseFilteredRows().filter((row) => bucketMatches(row, state.activeKpi));
}

function metrics(rows) {
  const dias = sum(rows, 'dias_restantes');
  const ant = sum(rows, 'periodo_anterior');
  const act = sum(rows, 'periodo_actual');
  return {
    empleados: rows.length,
    dias_restantes: dias,
    periodo_anterior: ant,
    periodo_actual: act,
    promedio: rows.length ? dias / rows.length : 0,
    con_pendientes: rows.filter((row) => row.dias_restantes > 0).length,
    con_periodo_anterior: rows.filter((row) => row.periodo_anterior > 0).length,
    ant_vencido: rows.filter((row) => row.vence_ant_bucket === 'Vencido').length,
    ant_0_30: rows.filter((row) => row.vence_ant_bucket === '0-30').length,
  };
}

function groupBy(rows, key) {
  const map = new Map();
  rows.forEach((row) => {
    const label = row[key] || 'Sin dato';
    if (!map.has(label)) {
      map.set(label, {
        label,
        empleados: 0,
        dias_restantes: 0,
        periodo_anterior: 0,
        periodo_actual: 0,
      });
    }
    const item = map.get(label);
    item.empleados += 1;
    item.dias_restantes += Number(row.dias_restantes) || 0;
    item.periodo_anterior += Number(row.periodo_anterior) || 0;
    item.periodo_actual += Number(row.periodo_actual) || 0;
  });
  return Array.from(map.values())
    .map((item) => ({ ...item, promedio: item.empleados ? item.dias_restantes / item.empleados : 0 }))
    .sort((a, b) => b.dias_restantes - a.dias_restantes);
}

function countBy(rows, key, order) {
  const map = new Map(order.map((label) => [label, { label, empleados: 0, dias_restantes: 0 }]));
  rows.forEach((row) => {
    const label = row[key] || 'Sin dato';
    if (!map.has(label)) map.set(label, { label, empleados: 0, dias_restantes: 0 });
    const item = map.get(label);
    item.empleados += 1;
    item.dias_restantes += Number(row.periodo_anterior) || 0;
  });
  return Array.from(map.values()).filter((row) => row.empleados > 0 || order.includes(row.label));
}

function distribution(rows) {
  return ['0', '1-5', '6-10', '11-15', '16-20', '21-30', '31+'].map((label) => ({
    label,
    empleados: rows.filter((row) => rangeLabel(row.dias_restantes) === label).length,
  }));
}

function tooltipLines(row) {
  return [
    `Colaboradores: ${n(row.empleados)}`,
    `Total dias: ${n(row.dias_restantes, 1)}`,
    `Periodo anterior: ${n(row.periodo_anterior, 1)}`,
    `Periodo actual: ${n(row.periodo_actual, 1)}`,
    `Promedio: ${n(row.promedio, 1)}`,
  ];
}

function renderStackedHorizontal(id, rows) {
  const canvas = document.getElementById(id);
  if (!canvas || !OXXO.ensureChartReady(canvas)) return;
  destroyChart(id);
  const t = theme();
  const ctx = canvas.getContext('2d');
  const gradient = (from, to) => (context) => {
    const area = context.chart.chartArea;
    if (!area) return to;
    const g = ctx.createLinearGradient(area.left, 0, area.right, 0);
    g.addColorStop(0, from);
    g.addColorStop(1, to);
    return g;
  };
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map((row) => OXXO.truncate(row.label, 20)),
      datasets: [
        {
          label: 'Periodo anterior',
          data: rows.map((row) => row.periodo_anterior),
          backgroundColor: gradient('#FF6A55', '#D91F2D'),
          borderColor: 'rgba(255,255,255,.68)',
          borderWidth: 1,
          borderRadius: 999,
          borderSkipped: false,
        },
        {
          label: 'Periodo actual',
          data: rows.map((row) => row.periodo_actual),
          backgroundColor: gradient('#F6B73C', '#F07B22'),
          borderColor: 'rgba(255,255,255,.68)',
          borderWidth: 1,
          borderRadius: 999,
          borderSkipped: false,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#5A4037', usePointStyle: true, pointStyle: 'circle', boxWidth: 8, font: { family: 'Barlow', size: 12, weight: '800' } },
        },
        tooltip: {
          backgroundColor: '#251313',
          titleColor: '#FFF8EE',
          bodyColor: '#FFF8EE',
          padding: 12,
          cornerRadius: 14,
          callbacks: {
            afterBody: (items) => {
              const row = rows[items[0].dataIndex];
              return tooltipLines(row);
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          beginAtZero: true,
          border: { display: false },
          grid: { color: 'rgba(128,63,38,.08)', drawTicks: false },
          ticks: { color: '#6A5148', callback: (value) => n(value), font: { family: 'Barlow', weight: '800' } },
        },
        y: {
          stacked: true,
          border: { display: false },
          grid: { display: false },
          ticks: { color: '#5A4037', font: { family: 'Barlow', weight: '900' } },
        },
      },
    },
  });
}

function renderVencimiento(id, rows) {
  const canvas = document.getElementById(id);
  if (!canvas || !OXXO.ensureChartReady(canvas)) return;
  destroyChart(id);
  const t = theme();
  const colors = {
    Vencido: '#E30613',
    '0-30': '#F06A24',
    '31-60': '#F2A52B',
    '61-90': '#FFCD56',
    '91-180': '#198754',
  };
  const ctx = canvas.getContext('2d');
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map((row) => row.label),
      datasets: [{
        label: 'Dias periodo anterior',
        data: rows.map((row) => row.dias_restantes),
        backgroundColor: rows.map((row) => colors[row.label] || '#6F6664'),
        borderColor: 'rgba(255,255,255,.68)',
        borderWidth: 1,
        borderRadius: 999,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#251313',
          titleColor: '#FFF8EE',
          bodyColor: '#FFF8EE',
          padding: 12,
          cornerRadius: 14,
          callbacks: {
            label: (ctx) => ` Dias: ${n(ctx.raw, 1)}`,
            afterLabel: (ctx) => `Colaboradores: ${n(rows[ctx.dataIndex].empleados)}`,
          },
        },
      },
      scales: {
        x: { beginAtZero: true, border: { display: false }, grid: { color: 'rgba(128,63,38,.08)', drawTicks: false }, ticks: { color: '#6A5148', callback: (value) => n(value), font: { family: 'Barlow', weight: '800' } } },
        y: { border: { display: false }, grid: { display: false }, ticks: { color: '#5A4037', font: { family: 'Barlow', weight: '900' } } },
      },
    },
  });
}

function renderDistribution(id, rows) {
  const canvas = document.getElementById(id);
  if (!canvas || !OXXO.ensureChartReady(canvas)) return;
  destroyChart(id);
  const t = theme();
  const colors = rows.map((row) => {
    if (row.label === '0') return '#198754';
    if (row.label === '1-5' || row.label === '6-10') return '#6F6664';
    if (row.label === '11-15' || row.label === '16-20') return '#F2A52B';
    return '#E30613';
  });
  charts[id] = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: rows.map((row) => row.label),
      datasets: [{
        label: 'Colaboradores',
        data: rows.map((row) => row.empleados),
        backgroundColor: colors,
        borderColor: 'rgba(255,255,255,.68)',
        borderWidth: 1,
        borderRadius: 999,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#251313', titleColor: '#FFF8EE', bodyColor: '#FFF8EE', padding: 12, cornerRadius: 14 },
      },
      scales: {
        x: { border: { display: false }, grid: { display: false }, ticks: { color: '#6A5148', font: { family: 'Barlow', weight: '800' } } },
        y: { beginAtZero: true, border: { display: false }, grid: { color: 'rgba(128,63,38,.08)', drawTicks: false }, ticks: { color: '#6A5148', callback: (value) => n(value), font: { family: 'Barlow', weight: '800' } } },
      },
    },
  });
}

function renderKpis(rows) {
  const m = metrics(rows);
  const cards = [
    { id: 'all', value: n(m.dias_restantes, 1), delta: `${n(m.con_pendientes)} colaboradores con saldo` },
    { id: 'ant', value: n(m.periodo_anterior, 1), delta: `${n(m.con_periodo_anterior)} colaboradores` },
    { id: 'act', value: n(m.periodo_actual, 1), delta: `${pct(m.periodo_actual, m.dias_restantes)} del saldo` },
    { id: 'avg', value: n(m.promedio, 1), delta: 'dias por colaborador' },
    { id: 'vencido', value: n(m.ant_vencido), delta: 'requieren accion inmediata' },
    { id: 'prox30', value: n(m.ant_0_30), delta: 'periodo anterior' },
  ];

  document.getElementById('kpi-section').innerHTML = cards.map((card) => {
    const def = KPI_DEFS.find((item) => item.id === card.id);
    const active = state.activeKpi === card.id ? ' is-active' : '';
    const deltaClass = ['all', 'act', 'avg'].includes(card.id) ? 'neu' : 'neg';
    return `
      <button class="kpi-card ${def.color}${active}" type="button" data-kpi-filter="${card.id}">
        <div class="kpi-card__label">${def.label}<span class="info-tip" tabindex="0" onclick="event.stopPropagation()" data-tip="${def.tip}"></span></div>
        <div class="kpi-card__value">${card.value}</div>
        <div class="kpi-card__delta ${deltaClass}">${card.delta}</div>
      </button>`;
  }).join('');

  document.querySelectorAll('[data-kpi-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeKpi = button.dataset.kpiFilter;
      renderAll();
    });
  });
}

function renderActions(rows) {
  const riskRows = countBy(rows, 'vence_ant_bucket', ['Vencido', '0-30', '31-60', '61-90']);
  const advisors = groupBy(rows, 'asesor');
  const stores = groupBy(rows, 'tienda');
  const positions = groupBy(rows, 'puesto');
  const overdue = riskRows.find((row) => row.label === 'Vencido') || { empleados: 0, dias_restantes: 0 };
  const next30 = riskRows.find((row) => row.label === '0-30') || { empleados: 0, dias_restantes: 0 };
  const topAdvisor = advisors[0] || { label: 'Sin dato', dias_restantes: 0, empleados: 0, periodo_anterior: 0 };
  const topStore = stores[0] || { label: 'Sin dato', dias_restantes: 0, empleados: 0 };
  const topPosition = positions[0] || { label: 'Sin dato', dias_restantes: 0, empleados: 0 };
  const heavy = rows.filter((row) => row.dias_restantes >= 21).length;

  const actions = [
    {
      title: `Atender vencidos: ${n(overdue.empleados)} colaboradores`,
      text: `${n(overdue.dias_restantes, 1)} dias de periodo anterior ya vencido. Prioriza contacto y programacion esta semana.`,
    },
    {
      title: `Blindar 0-30 dias: ${n(next30.empleados)} colaboradores`,
      text: `${n(next30.dias_restantes, 1)} dias de periodo anterior por vencer. Conviene cerrar calendario antes del siguiente corte.`,
    },
    {
      title: `Asesor foco: ${topAdvisor.label}`,
      text: `${n(topAdvisor.dias_restantes, 1)} dias en ${n(topAdvisor.empleados)} colaboradores; ${n(topAdvisor.periodo_anterior, 1)} son de periodo anterior.`,
    },
    {
      title: `Tienda foco: ${topStore.label}`,
      text: `${n(topStore.dias_restantes, 1)} dias acumulados. Revisar cobertura y balance de turnos antes de autorizar bloques grandes.`,
    },
    {
      title: `Puesto mas cargado: ${topPosition.label}`,
      text: `${n(topPosition.dias_restantes, 1)} dias entre ${n(topPosition.empleados)} colaboradores. Util para planear reemplazos por perfil.`,
    },
    {
      title: `Saldos altos: ${n(heavy)} colaboradores con 21+ dias`,
      text: 'Usa el filtro de rango para aislarlos y bajar primero los saldos que pueden complicar cobertura.',
    },
  ];

  document.getElementById('actions-list').innerHTML = actions.map((action) => `
    <div class="vac-action">
      <div class="vac-action__title">${action.title}</div>
      <div class="vac-action__text">${action.text}</div>
    </div>`).join('');
}

function filterLabel() {
  const kpi = KPI_DEFS.find((item) => item.id === state.activeKpi)?.label || 'Todos';
  return [
    kpi,
    state.asesor || 'Todos los asesores',
    state.tienda || 'Todas las tiendas',
    state.puesto || 'Todos los puestos',
    state.rango || 'Todos los rangos',
  ].join(' - ');
}

function populateSelect(id, rows, key, defaultLabel) {
  const select = document.getElementById(id);
  const values = Array.from(new Set(rows.map((row) => row[key]).filter(Boolean))).sort();
  select.innerHTML = `<option value="">${defaultLabel}</option>` + values.map((value) => (
    `<option value="${value}">${value}</option>`
  )).join('');
}

function populateFilters(rows) {
  populateSelect('filtro-asesor', rows, 'asesor', 'Todos los asesores');
  populateSelect('filtro-tienda', rows, 'tienda', 'Todas las tiendas');
  populateSelect('filtro-puesto', rows, 'puesto', 'Todos los puestos');

  document.getElementById('filtro-asesor').addEventListener('change', (event) => {
    state.asesor = event.target.value;
    renderAll();
  });
  document.getElementById('filtro-tienda').addEventListener('change', (event) => {
    state.tienda = event.target.value;
    renderAll();
  });
  document.getElementById('filtro-puesto').addEventListener('change', (event) => {
    state.puesto = event.target.value;
    renderAll();
  });
  document.getElementById('filtro-rango').addEventListener('change', (event) => {
    state.rango = event.target.value;
    renderAll();
  });
}

function renderAll() {
  const baseRows = baseFilteredRows();
  const rows = filteredRows();

  renderKpis(baseRows);
  document.getElementById('filter-status').textContent = `Filtro activo: ${filterLabel()} - ${n(rows.length)} colaboradores`;

  renderActions(rows);
  renderStackedHorizontal('chart-asesores', groupBy(rows, 'asesor').slice(0, 10));
  renderStackedHorizontal('chart-plazas', groupBy(rows, 'tienda').slice(0, 10));
  renderStackedHorizontal('chart-puestos', groupBy(rows, 'puesto').slice(0, 10));
  renderVencimiento('chart-vencimiento-ant', countBy(rows, 'vence_ant_bucket', ['Vencido', '0-30', '31-60', '61-90', '91-180']));
  renderDistribution('chart-distribucion', distribution(rows));
}

async function initDashboard() {
  let data = window.VACACIONES_DASHBOARD_5;
  try {
    if (!data) {
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    }
  } catch (error) {
    console.error(error);
    ['kpi-section', 'actions-list'].forEach((id) => {
      OXXO.showError(id, 'No se pudo cargar el resumen de vacaciones.');
    });
    return;
  }

  state.rows = data.rows || [];
  populateFilters(state.rows);
  document.getElementById('clear-filters').addEventListener('click', () => {
    state.activeKpi = 'all';
    state.asesor = '';
    state.tienda = '';
    state.puesto = '';
    state.rango = '';
    ['filtro-asesor', 'filtro-tienda', 'filtro-puesto', 'filtro-rango'].forEach((id) => {
      document.getElementById(id).value = '';
    });
    renderAll();
  });
  document.getElementById('snapshot-date').textContent = data.snapshot_date;
  renderAll();
  OXXO.updateFooterTime('load-time');
}

window.addEventListener('oxxo-theme-change', () => {
  Object.values(charts).forEach((chart) => chart.update('none'));
});

document.addEventListener('DOMContentLoaded', initDashboard);
