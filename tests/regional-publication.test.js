const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const sandbox = { console, Date, Set, Map, JSON, Math };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/admin-upload.gs'), 'utf8'), sandbox);

const evaluate = (source) => vm.runInContext(source, sandbox);

assert.deepEqual(
  JSON.parse(evaluate(`JSON.stringify(normalizeScopeColumns([' Plaza ', 'Region', 'plaza', '', 'Zona', 'CR']))`)),
  ['Plaza', 'Region', 'Zona']
);

assert.deepEqual(
  JSON.parse(evaluate(`JSON.stringify(scopeKeysFromObjects([
    {Region:'Sureste',Plaza:'Oaxaca'},
    {Region:'Sureste',Plaza:'Oaxaca'},
    {Region:'Sureste',Plaza:'Tuxtla'}
  ], ['Region','Plaza']))`)),
  ['sureste::oaxaca', 'sureste::tuxtla']
);

assert.equal(evaluate(`scopeKeyFromArray(['Mes','Region','Plaza'], ['ago-26','Sureste','Oaxaca'], ['Region','Plaza'])`), 'sureste::oaxaca');
assert.equal(evaluate(`scopeKeyFromArray(['Mes','Region','Plaza'], ['ago-26','','Oaxaca'], ['Region','Plaza'])`), '');

assert.doesNotThrow(() => evaluate(`validatePublicationRequest(
  'Dashboard_1_Diario',
  [{Plaza:'Oaxaca',Asesor:'AT',Mes:'ago-26'}],
  'replacePeriod','Mes',['ago-26'],['Plaza','Asesor'],['Plaza']
)`));

assert.throws(
  () => evaluate(`validatePublicationRequest(
    'Dashboard_1_Diario',
    [{Plaza:'',Asesor:'AT',Mes:'ago-26'}],
    'replacePeriod','Mes',['ago-26'],['Asesor'],['Plaza']
  )`),
  /alcance contiene filas vacias/i
);

console.log('publicacion regional: 6 pruebas correctas');
