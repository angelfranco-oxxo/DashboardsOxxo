const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const documentStub = {
  readyState: 'loading', body: null, head: { appendChild() {} },
  addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
  getElementsByTagName() { return []; }, getElementById() { return null; },
  querySelector() { return null; }, querySelectorAll() { return []; },
  createElement() { return { style: {}, dataset: {}, addEventListener() {}, remove() {} }; }
};
const sandbox = {
  console, document: documentStub,
  location: { pathname: '/admin.html', origin: 'https://example.test', href: 'https://example.test/admin.html' },
  history: { state: null, replaceState() {} },
  sessionStorage: { getItem() { return null; }, setItem() {} },
  localStorage: { getItem() { return null; }, setItem() {} },
  navigator: {}, CustomEvent: function CustomEvent() {},
  URL, Request, Response, Blob, AbortController,
  setTimeout, clearTimeout, Map, Set, Date, Promise
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/config.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/core.js'), 'utf8'), sandbox);

(async () => {
  sandbox.fetch = (_url, options = {}) => new Promise((_resolve, reject) => {
    options.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  });
  const started = Date.now();
  await assert.rejects(() => sandbox.OXXO.fetchWithTimeout('https://example.test/hung', {}, 1000), /aborted/);
  assert(Date.now() - started < 1600, 'la solicitud bloqueada no se cortó a tiempo');

  sandbox.fetch = async () => new Response('ok', { status: 200 });
  const response = await sandbox.OXXO.fetchWithTimeout('https://example.test/fast', {}, 1000);
  assert.equal(await response.text(), 'ok');
  console.log('timeout de red: solicitud bloqueada y respuesta rápida correctas');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
