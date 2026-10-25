const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const axios = require('axios');

function load(file, mocks) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2021 },
  }).outputText;
  vm.runInNewContext(js, { exports, require: key => key in mocks ? mocks[key] : require(key) });
  return exports;
}

const locale = { getCurrentLocale: () => 'en' };
const bus = load('hooks/error-bus.ts', {});
const errors = load('hooks/error-utils.ts', { '@/hooks/use-i18n': locale });
let expirations = 0;
let client;
client = load('hooks/api-client.ts', {
  '@/constants/api': { API_BASE_URL: 'https://example.invalid' },
  '@/hooks/auth-session': { notifySessionExpired: () => { expirations++; client.setApiAccessToken(null); } },
  '@/hooks/error-bus': bus,
  '@/hooks/error-utils': errors,
  '@/hooks/use-i18n': locale,
});
const messages = [];
bus.subscribeToGlobalError(message => messages.push(message));

// Use Axios's real request/interceptor pipeline without making network calls.
const pending = [];
client.api.defaults.adapter = config => new Promise((resolve, reject) => {
  pending.push(status => reject(new axios.AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, {}, {
    status, statusText: 'Error', headers: {}, config, data: {},
  })));
});
async function request(path) {
  const result = client.api.get(path).catch(error => error);
  await new Promise(resolve => setImmediate(resolve));
  return { result, fail: pending.shift() };
}

(async () => {
  client.setApiAccessToken('expired-token');
  const expired = await request('/auth/me');
  const late = await request('/tontines');
  bus.emitGlobalError('Previous error');
  expired.fail(401);
  const expiryError = await expired.result;
  assert.equal(expirations, 1);
  assert.equal(messages.at(-1), null, 'Expiry clears an existing banner');
  assert.equal(expiryError.message, '');
  assert.equal(expiryError.shouldNotify, false);

  late.fail(500);
  const lateError = await late.result;
  assert.equal(lateError.message, '');
  assert.equal(messages.length, 2, 'Late errors cannot bring the banner back');

  client.setApiAccessToken('old-token');
  const stale = await request('/tontines');
  client.setApiAccessToken('new-token');
  stale.fail(401);
  await stale.result;
  assert.equal(expirations, 1, 'An old request cannot sign out a new session');
  assert.equal(client.api.defaults.headers.common.Authorization, 'Bearer new-token');

  const serverError = await request('/tontines');
  serverError.fail(500);
  await serverError.result;
  assert.ok(messages.at(-1), 'Current-session server failures still show a banner');

  client.setApiAccessToken(null);
  const login = await request('/auth/login');
  login.fail(401);
  const loginError = await login.result;
  assert.equal(expirations, 1);
  assert.equal(loginError.shouldNotify, false);
  assert.ok(loginError.message, 'Login errors remain available to the form');
  console.log('Session error checks passed: banner clearing, late requests, replaced sessions, server errors, and login failures.');
})().catch(error => { console.error(error); process.exitCode = 1; });
