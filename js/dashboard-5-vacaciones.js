const DATA_URL = '../assets/data/vacaciones-dashboard-5.json';
const charts = {};
const state = {
  rows: [],
  activeKpi: 'all',
  puesto: '',
};

const KPI_DEFS = [
  { id: 'all', label: 'Dias restantes', color: 'rojo' },
  { id: 'ant', label: 'Periodo anterior', color: 'amarillo' },
  { id: 'act', label: 'Periodo actual', color: 'azul' },
  { id: 'avg', label: 'Promedio', color: 'verde' },
  { id: 'vencido', label: 'Vencidos ant.', color: 'rojo' },
  { id: 'prox30', label: 'Vencen 0-30', color: 'amarillo' },
];

function n(value, decimals = 0) {
  const num = Number(value || 0);
  return num.toLocaleString('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function pct(value, total) {
  return total ? `${((value / total) * 100).toFixed(1)}%` : '0.0%';
}

function chartTheme() {
  return OXXO.getChartThemeColors();
}

function destroyChart(id) {
  if (charts[id]) charts[id].destroy();
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
}

function bucketMatches(row, kpiId) {
  if (kpiId === 'ant') return row.periodo_anterior > 0;
  if (kpiId === 'act') return row.periodo_actual > 0;
  if (kpiId === 'avg') return row.dias_restantes > 0;
  if (kpiId === 'vencido') return row.vence_ant_bucket === 'Vencido';
  if (kpiId === 'prox30') return row.vence_ant_bucket === '0-30';
  return true;
}

function filteredRows() {
  return state.rows.filter((row) => {
    if (state.puesto && row.puesto !== state.puesto) return false;
    return bucketMatches(row, state.activeKpi);
  });
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
    .map((item) => ({
      ...item,
      promedio: item.empleados ? item.dias_restantes / item.empleados : 0,
    }))
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
  const buckets = [
    { label: '0', test: (v) => v === 0 },
    { label: '1-5', test: (v) => v > 0 && v <= 5 },
    { label: '6-10', test: (v) => v > 5 && v <= 10 },
    { label: '11-15', test: (v) => v > 10 && v <= 15 },
    { label: '16-20', test: (v) => v > 15 && v <= 20 },
    { label: '21-30', test: (v) => v > 20 && v <= 30 },
    { label: '31+', test: (v) => v > 30 },
  ];
  return buckets.map((bucket) => ({
    label: bucket.label,
    empleados: rows.filter((row) => bucket.test(Number(row.dias_restantes) || 0)).length,
  }));
}

function renderHorizontalBar(id, rows, key, label, color) {
  const canvas = document.getElementById(id);
  if (!canvas || !OXXO.ensureChartReady(canvas)) return;
  destroyChart(id);
  const theme = chartTheme();
  charts[id] = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: rows.map((row) => OXXO.truncate(row.label, 18)),
      datasets: [{
        label,
        data: rows.map((row) => row[key]),
        backgroundColor: color,
        borderRadius: 6,
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
          backgroundColor: theme.tooltipBg,
          callbacks: { label: (ctx) => ` ${label}: ${n(ctx.raw, 1)}` },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: theme.grid },
          ticks: { color: theme.muted, callback: (v) => n(v) },
        },
        y: {
          grid: { display: false },
          ticks: { color: theme.muted },
        },
      },
    },
  });
}

function renderDoughnut(id, rows, valueKey) {
  const canvas = document.getElementById(id);
  if (!canvas || !OXXO.ensureChartReady(canvas)) return;
  destroyChart(id);
  const theme = chartTheme();
  charts[id] = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: rows.map((row) => row.label),
      datasets: [{
        data: rows.map((row) => row[valueKey]),
        backgroundColor: ['#E30613', '#F2A52B', '#FFCD56', '#198754', '#6F6664', '#2A1718'],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '64%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: theme.text, boxWidth: 12, padding: 12, font: { family: 'Barlow', size: 11 } },
        },
        tooltip: { backgroundColor: theme.tooltipBg },
      },
    },
  });
}

function renderDistribution(id, rows) {
  const canvas = document.getElementById(id);
  if (!canvas || !OXXO.ensureChartReady(canvas)) return;
  destroyChart(id);
  const theme = chartTheme();
  charts[id] = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: rows.map((row) => row.label),
      datasets: [{
        label: 'Colaboradores',
        data: rows.map((row) => row.empleados),
        backgroundColor: '#2A1718',
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: theme.tooltipBg },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: theme.muted } },
        y: { beginAtZero: true, grid: { color: theme.grid }, ticks: { color: theme.muted, callback: (v) => n(v) } },
      },
    },
  });
}

function renderKpis(rows) {
  const m = metrics(rows);
  const cards = [
    {
      id: 'all',
      value: n(m.dias_restantes, 1),
      delta: `${n(m.con_pendientes)} colaboradores con saldo`,
    },
    {
      id: 'ant',
      value: n(m.periodo_anterior, 1),
      delta: `${n(m.con_periodo_anterior)} colaboradores`,
    },
    {
      id: 'act',
      value: n(m.periodo_actual, 1),
      delta: `${pct(m.periodo_actual, m.dias_restantes)} del saldo`,
    },
    {
      id: 'avg',
      value: n(m.promedio, 1),
      delta: 'dias por colaborador',
    },
    {
      id: 'vencido',
      value: n(m.ant_vencido),
      delta: 'requieren accion inmediata',
    },
    {
      id: 'prox30',
      value: n(m.ant_0_30),
      delta: 'periodo anterior',
    },
  ];

  document.getElementById('kpi-section').innerHTML = cards.map((card) => {
    const def = KPI_DEFS.find((item) => item.id === card.id);
    const active = state.activeKpi === card.id ? ' is-active' : '';
    const deltaClass = ['all', 'act', 'avg'].includes(card.id) ? 'neu' : 'neg';
    return `
      <button class="kpi-card ${def.color}${active}" type="button" data-kpi-filter="${card.id}">
        <div class="kpi-card__label">${def.label}</div>
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

function renderRiskList(rows) {
  const riskRows = countBy(rows, 'vence_ant_bucket', ['Vencido', '0-30', '31-60', '61-90']).slice(0, 4);
  const total = riskRows.reduce((acc, row) => acc + row.empleados, 0);
  document.getElementById('risk-list').innerHTML = riskRows.map((row, index) => `
    <div class="vac-risk-row">
      <div>
        <div class="vac-risk-row__label">${row.label}</div>
        <div class="vac-risk-row__sub">${n(row.dias_restantes, 1)} dias pendientes ant.</div>
      </div>
      <strong>${n(row.empleados)}</strong>
      <div class="vac-risk-row__bar"><span style="width:${pct(row.empleados, total)};background:${index === 0 ? '#E30613' : '#F2A52B'}"></span></div>
    </div>`).join('');
}

function filterLabel() {
  const kpi = KPI_DEFS.find((item) => item.id === state.activeKpi)?.label || 'Todos';
  const puesto = state.puesto || 'Todos los puestos';
  return `Filtro activo: ${kpi} · ${puesto}`;
}

function populatePuestoFilter(rows) {
  const select = document.getElementById('filtro-puesto');
  const puestos = Array.from(new Set(rows.map((row) => row.puesto).filter(Boolean))).sort();
  select.innerHTML = '<option value="">Todos los puestos</option>' + puestos.map((puesto) => (
    `<option value="${puesto}">${puesto}</option>`
  )).join('');
  select.addEventListener('change', () => {
    state.puesto = select.value;
    renderAll();
  });
}

function renderAll() {
  const baseRows = state.rows.filter((row) => !state.puesto || row.puesto === state.puesto);
  const rows = filteredRows();

  renderKpis(baseRows);
  document.getElementById('filter-status').textContent = `${filterLabel()} · ${n(rows.length)} colaboradores`;

  renderRiskList(rows);
  renderHorizontalBar('chart-asesores', groupBy(rows, 'asesor').slice(0, 10), 'dias_restantes', 'Dias restantes', '#E30613');
  renderHorizontalBar('chart-plazas', groupBy(rows, 'tienda').slice(0, 10), 'dias_restantes', 'Dias restantes', '#E30613');
  renderHorizontalBar('chart-puestos', groupBy(rows, 'puesto').slice(0, 10), 'dias_restantes', 'Dias restantes', '#F2A52B');
  renderDoughnut(
    'chart-vencimiento-ant',
    countBy(rows, 'bucket_ant', ['Ya vencieron sus dias', '0 a 50 dias', '51 a 100 dias', '101 a 150 dias', 'Mas de 150 dias'])
      .filter((row) => row.label !== 'Sin periodo anterior'),
    'empleados',
  );
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
    ['kpi-section', 'risk-list'].forEach((id) => {
      OXXO.showError(id, 'No se pudo cargar el resumen de vacaciones.');
    });
    return;
  }

  state.rows = data.rows || [];
  populatePuestoFilter(state.rows);
  document.getElementById('clear-filters').addEventListener('click', () => {
    state.activeKpi = 'all';
    state.puesto = '';
    document.getElementById('filtro-puesto').value = '';
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
