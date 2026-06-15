const DATA_URL = '../assets/data/vacaciones-dashboard-5.json';
const charts = {};

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

function rowsToLabels(rows) {
  return rows.map((row) => OXXO.truncate(row.label, 18));
}

function chartTheme() {
  return OXXO.getChartThemeColors();
}

function destroyChart(id) {
  if (charts[id]) charts[id].destroy();
}

function renderHorizontalBar(id, rows, key, label, color) {
  const canvas = document.getElementById(id);
  if (!canvas || !OXXO.ensureChartReady(canvas)) return;
  destroyChart(id);
  const theme = chartTheme();
  charts[id] = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: rowsToLabels(rows),
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
          callbacks: {
            label: (ctx) => ` ${label}: ${n(ctx.raw, 1)}`,
          },
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

function renderStackedRegion(id, rows) {
  const canvas = document.getElementById(id);
  if (!canvas || !OXXO.ensureChartReady(canvas)) return;
  destroyChart(id);
  const theme = chartTheme();
  charts[id] = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: rows.map((row) => row.label),
      datasets: [
        {
          label: 'Periodo anterior',
          data: rows.map((row) => row.periodo_anterior),
          backgroundColor: '#E30613',
          borderRadius: 5,
        },
        {
          label: 'Periodo actual',
          data: rows.map((row) => row.periodo_actual),
          backgroundColor: '#F2A52B',
          borderRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: theme.text, boxWidth: 12, font: { family: 'Barlow', size: 12 } },
        },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${n(ctx.raw, 1)} dias`,
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: theme.muted },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: theme.grid },
          ticks: { color: theme.muted, callback: (v) => n(v) },
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
  const colors = ['#E30613', '#F2A52B', '#FFCD56', '#198754', '#6F6664', '#2A1718'];
  charts[id] = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: rows.map((row) => row.label),
      datasets: [{
        data: rows.map((row) => row[valueKey]),
        backgroundColor: colors,
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

function renderKpis(data) {
  const k = data.kpis;
  document.getElementById('kpi-section').innerHTML = `
    <div class="kpi-card rojo">
      <div class="kpi-card__label">Dias restantes</div>
      <div class="kpi-card__value">${n(k.dias_restantes, 1)}</div>
      <div class="kpi-card__delta neg">${n(k.con_pendientes)} colaboradores con saldo</div>
    </div>
    <div class="kpi-card amarillo">
      <div class="kpi-card__label">Periodo anterior</div>
      <div class="kpi-card__value">${n(k.periodo_anterior, 1)}</div>
      <div class="kpi-card__delta neg">${n(k.con_periodo_anterior)} colaboradores</div>
    </div>
    <div class="kpi-card azul">
      <div class="kpi-card__label">Periodo actual</div>
      <div class="kpi-card__value">${n(k.periodo_actual, 1)}</div>
      <div class="kpi-card__delta neu">${pct(k.periodo_actual, k.dias_restantes)} del saldo</div>
    </div>
    <div class="kpi-card verde">
      <div class="kpi-card__label">Promedio</div>
      <div class="kpi-card__value">${n(k.promedio, 1)}</div>
      <div class="kpi-card__delta neu">dias por colaborador</div>
    </div>
    <div class="kpi-card rojo">
      <div class="kpi-card__label">Vencidos ant.</div>
      <div class="kpi-card__value">${n(k.ant_vencido)}</div>
      <div class="kpi-card__delta neg">requieren accion inmediata</div>
    </div>
    <div class="kpi-card amarillo">
      <div class="kpi-card__label">Vencen 0-30</div>
      <div class="kpi-card__value">${n(k.ant_0_30)}</div>
      <div class="kpi-card__delta neg">periodo anterior</div>
    </div>`;
}

function renderRiskList(data) {
  const rows = data.vence_ant.slice(0, 4);
  const total = rows.reduce((sum, row) => sum + row.empleados, 0);
  document.getElementById('risk-list').innerHTML = rows.map((row, index) => `
    <div class="vac-risk-row">
      <div>
        <div class="vac-risk-row__label">${row.label}</div>
        <div class="vac-risk-row__sub">${n(row.dias_restantes, 1)} dias pendientes ant.</div>
      </div>
      <strong>${n(row.empleados)}</strong>
      <div class="vac-risk-row__bar"><span style="width:${pct(row.empleados, total)};background:${index === 0 ? '#E30613' : '#F2A52B'}"></span></div>
    </div>`).join('');
}

function renderDataTable(id, rows, columns) {
  const el = document.getElementById(id);
  if (!el) return;
  const thead = columns.map((col) => `<th style="text-align:${col.align || 'left'}">${col.label}</th>`).join('');
  const tbody = rows.map((row) => `
    <tr>${columns.map((col) => {
      const value = row[col.key];
      const text = col.num ? n(value, col.decimals || 0) : value;
      return `<td style="text-align:${col.align || 'left'}">${text}</td>`;
    }).join('')}</tr>`).join('');
  el.innerHTML = `<div class="table-wrapper"><table class="data-table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div>`;
}

function renderHeatmap(data) {
  const matrix = data.matrix_region_posicion;
  const max = Math.max(...matrix.rows.flatMap((row) => row.values), 1);
  const header = matrix.columns.map((col) => `<th>${col}</th>`).join('');
  const body = matrix.rows.map((row) => `
    <tr>
      <td>${row.region}</td>
      ${row.values.map((value) => {
        const alpha = Math.max(0.08, value / max * 0.9);
        return `<td style="background:rgba(227,6,19,${alpha.toFixed(2)})">${n(value, 1)}</td>`;
      }).join('')}
    </tr>`).join('');
  document.getElementById('heatmap-region-posicion').innerHTML = `
    <div class="table-wrapper">
      <table class="data-table vac-heatmap">
        <thead><tr><th>Region</th>${header}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
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

  renderKpis(data);
  renderRiskList(data);
  renderHorizontalBar('chart-asesores', data.asesor_top.slice(0, 10), 'dias_restantes', 'Dias restantes', '#E30613');
  renderHorizontalBar('chart-plazas', data.plaza_top.slice(0, 10), 'dias_restantes', 'Dias restantes', '#E30613');
  renderHorizontalBar('chart-puestos', data.puesto_top.slice(0, 10), 'dias_restantes', 'Dias restantes', '#F2A52B');
  renderDoughnut('chart-vencimiento-ant', data.bucket_ant.filter((row) => row.label !== 'Sin periodo anterior'), 'empleados');
  renderDistribution('chart-distribucion', data.distribucion_total);
  document.getElementById('snapshot-date').textContent = data.snapshot_date;
  OXXO.updateFooterTime('load-time');
}

window.addEventListener('oxxo-theme-change', () => {
  Object.values(charts).forEach((chart) => chart.update('none'));
});

document.addEventListener('DOMContentLoaded', initDashboard);
