// Dashboard 1 publica en "Dias Vacantes" valores que NO son antiguedad: las
// tiendas nuevas traen un serial de fecha corrupto de la fuente (2/10/1901 ->
// 641 dias) y los meses finalizados vienen sin dias. Sumarlos rompia las
// cifras que la gente usa para priorizar coberturas: en Oaxaca sep-26, 6 de
// 59 filas inflaban el promedio general de 11.4 a 75.4 dias y el KPI
// "Vacante mas antigua" reportaba 641 dias cuando la real llevaba 57.
// Aparte, el new Chart() de la grafica de barras no estaba protegido: si el
// CDN de Chart.js no cargaba, renderOverview() lanzaba y renderTabla() -que
// corre despues- dejaba la tabla de detalle en "Cargando datos..." .
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'dashboards/dashboard-1.html'), 'utf8');

function extraer(nombre) {
  const re = new RegExp(`function ${nombre}\\(([\\s\\S]*?)\\n\\}`);
  const hit = html.match(re);
  assert.ok(hit, `no se encontro ${nombre}() en dashboard-1.html`);
  return hit[0];
}

const api = new Function(
  `${extraer('esTiendaNueva')}\n${extraer('sinAntiguedadReal')}\n${extraer('diasReales')}\n` +
  'return { esTiendaNueva, sinAntiguedadReal, diasReales };'
)();

const nueva      = { dias: 641, diasRaw: '2/10/1901' };
const sinDias    = { dias: 0,   diasRaw: '' };
const finalizado = { dias: 0,   diasRaw: 'Mes finalizado' };
const real       = { dias: 57,  diasRaw: '57' };
const cero       = { dias: 0,   diasRaw: '0' };

// Lo que no es antiguedad no cuenta como antiguedad.
assert.equal(api.sinAntiguedadReal(nueva), true);
assert.equal(api.sinAntiguedadReal(sinDias), true);
assert.equal(api.sinAntiguedadReal(finalizado), true);
assert.equal(api.diasReales(nueva), null);
assert.equal(api.diasReales(finalizado), null);

// Una vacante real si cuenta, incluida la de cero dias (abierta hoy).
assert.equal(api.sinAntiguedadReal(real), false);
assert.equal(api.diasReales(real), 57);
assert.equal(api.sinAntiguedadReal(cero), false);
assert.equal(api.diasReales(cero), 0);

// El promedio y el maximo con la mezcla real de Oaxaca sep-26: 6 placeholder
// entre filas verdaderas no deben mover ninguna de las dos cifras.
const muestra = [nueva, nueva, nueva, real, { dias: 34, diasRaw: '34' }, finalizado, cero];
const conAntiguedad = muestra.map(api.diasReales).filter(d => d !== null);
assert.deepEqual(conAntiguedad, [57, 34, 0]);
assert.equal(Math.max(...conAntiguedad), 57, 'el maximo no puede ser el 641 de una tienda nueva');
assert.equal(+(conAntiguedad.reduce((a, b) => a + b, 0) / conAntiguedad.length).toFixed(1), 30.3);

// El calculo del KPI "Vacante mas antigua" filtra antes de sacar el maximo.
assert.match(
  html,
  /const conAntiguedad\s*=\s*allData\.filter\(r=>!sinAntiguedadReal\(r\)\);\s*const maxDias\s*=\s*Math\.max\(\.\.\.conAntiguedad/,
  'el KPI "Vacante mas antigua" volvio a leer allData sin filtrar'
);

// Las dos graficas quedan protegidas si Chart.js no cargo.
const usosDeChart = html.match(/_ci\s*=\s*new Chart\(/g) || [];
assert.equal(usosDeChart.length, 2, 'cambio la cantidad de graficas: revisa que todas tengan guarda');
const guardas = html.match(/typeof Chart === 'undefined'/g) || [];
assert.equal(guardas.length, 2, 'alguna grafica se quedo sin la guarda de Chart.js');

// El semaforo de antiguedad tiene un solo criterio (3/6 dias). El viejo
// colorDias() (7/15) quedaba muerto en el archivo invitando a reintroducirlo.
assert.ok(!/function colorDias\(/.test(html), 'volvio el semaforo duplicado colorDias()');
assert.ok(/function vaColorDias\(/.test(html), 'falta vaColorDias(), el semaforo vigente');

console.log('dashboard-1: antiguedad real, guardas de Chart.js y semaforo unico');
