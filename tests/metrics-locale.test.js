// Google gviz sirve las hojas con el formato del Sheet (es-MX), asi que los
// numeros llegan con COMA decimal: "0,96", "1,0435", "0,939". metricsNum()
// trataba una sola coma con exactamente 3 decimales como separador de miles,
// asi que "0,939" se leia 939 y "1,125" se leia 1125. En Dashboard 11 esas
// columnas son porcentajes: 93.9% se volvia 939% e inflaba KPIs, dona y
// ranking de asesores (Oaxaca SEM 35 mostraba 105.8% de cumplimiento total
// contra el 76.81% del Excel de origen).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const sandbox = {
  console,
  document: {
    readyState: 'loading',
    body: null,
    documentElement: { dataset: {} },
    head: { appendChild() {} },
    addEventListener() {},
    getElementsByTagName() { return []; },
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return { style: {}, dataset: {}, addEventListener() {}, remove() {} }; }
  },
  location: { pathname: '/index.html', origin: 'https://example.test', href: 'https://example.test/' },
  history: { state: null, replaceState() {} },
  sessionStorage: { getItem() { return null; }, setItem() {} },
  localStorage: { getItem() { return null; }, setItem() {} },
  navigator: {},
  CustomEvent: function CustomEvent() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
  matchMedia() { return { matches: false, addEventListener() {}, addListener() {} }; },
  URL, Request, Response, Blob, setTimeout, clearTimeout, Map, Set, Date, Promise
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/config.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/core.js'), 'utf8'), sandbox);
const { metricsNum } = sandbox.OXXO;

// Coma decimal es-MX: cualquier cantidad de decimales, incluidos los 3 que
// antes se confundian con miles.
assert.equal(metricsNum('0,96'), 0.96);
assert.equal(metricsNum('1,04'), 1.04);
assert.equal(metricsNum('52,00'), 52);
assert.equal(metricsNum('0,939'), 0.939);
assert.equal(metricsNum('0,871'), 0.871);
assert.equal(metricsNum('1,125'), 1.125);
assert.equal(metricsNum('1,0435'), 1.0435);
assert.equal(metricsNum('2,234592627'), 2.234592627);

// Miles reales: en las publicaciones siempre llegan con coma Y punto, y
// varias comas solo admiten lectura de miles.
assert.equal(metricsNum('1,113.75'), 1113.75);
assert.equal(metricsNum('2,351.25'), 2351.25);
assert.equal(metricsNum('1,234,567'), 1234567);
assert.equal(metricsNum('1.234,56'), 1234.56);
assert.equal(metricsNum('$1,500.50'), 1500.5);
assert.equal(metricsNum('12,5%'), 12.5);
assert.equal(metricsNum(''), 0);
assert.equal(metricsNum('abc'), 0);

// El pct() real de Dashboard 11, extraido del HTML publicado para que el
// tablero y esta prueba no se separen.
const d11 = fs.readFileSync(path.join(root, 'dashboards/dashboard-11.html'), 'utf8');
const pctSource = d11.match(/function pct\(v\)\{[\s\S]*?\n/);
assert.ok(pctSource, 'no se encontro pct() en dashboard-11.html');
const pct = new Function('OXXO', `${pctSource[0]}; return pct;`)(sandbox.OXXO);

// Muestra real de la publicacion SEM 35 (Oaxaca) tal como la entrega gviz.
const muestra = ['0,96', '1,04', '1', '0,939', '0,871', '1,125', '0,8571', '0,5'];
const esperado = [96, 104, 100, 93.9, 87.1, 112.5, 85.71, 50];
muestra.forEach((raw, i) => {
  assert.ok(Math.abs(pct(raw) - esperado[i]) < 1e-9, `pct("${raw}") = ${pct(raw)}, se esperaba ${esperado[i]}`);
});
// Ningun porcentaje de una base sana puede pasar de 3 digitos.
muestra.forEach((raw) => assert.ok(pct(raw) <= 200, `pct("${raw}") se disparo a ${pct(raw)}`));

console.log('metricsLocale: coma decimal es-MX y porcentajes de Dashboard 11 correctos');
