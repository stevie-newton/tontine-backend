const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const axios = require('axios');

function load(file, mocks) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(js, { exports, Error, require: key => key in mocks ? mocks[key] : require(key) });
  return exports;
}

const errors = load('hooks/error-utils.ts', { '@/hooks/use-i18n': { getCurrentLocale: () => 'en' } });
const banners = [];
let signOuts = 0;
const { api, setApiAccessToken } = load('hooks/api-client.ts', {
  '@/constants/api': { API_BASE_URL: 'https://example.test' },
  '@/hooks/auth-session': { notifySessionExpired: () => { signOuts++; setApiAccessToken(null); } },
  '@/hooks/error-bus': { emitGlobalError: message => banners.push(message) },
  '@/hooks/error-utils': errors,
  '@/hooks/use-i18n': { getCurrentLocale: () => 'en' },
});

async function rejectRequest(url, status, detail, token = 'expired-token') {
  setApiAccessToken(token);
  api.defaults.adapter = async config => {
    throw new axios.AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
      status, data: { detail }, headers: {}, config,
    });
  };
  try { await api.get(url); assert.fail('Expected rejection'); }
  catch (error) { assert.ok(error instanceof errors.AppApiError); return error; }
}

(async () => {
  for (const url of ['/tontines', '/auth/me', '/auth/me?refresh=true']) {
    const previous = signOuts;
    const error = await rejectRequest(url, 401, 'The token has expired');
    assert.equal(signOuts, previous + 1);
    assert.equal(error.status, 401);
    assert.equal(error.shouldNotify, false);
    assert.equal(errors.getErrorMessage(error, 'Fallback error'), '');
    assert.equal(banners.length, 0);
  }
  const previous = signOuts;
  for (const token of [null, 'existing-token']) {
    const loginError = await rejectRequest('/auth/login', 401, 'Invalid phone or password', token);
    assert.equal(signOuts, previous);
    assert.equal(errors.getErrorMessage(loginError), 'Invalid phone or password');
    assert.equal(loginError.shouldNotify, false);
    assert.equal(banners.length, 0);
  }
  await rejectRequest('/tontines', 403, 'Forbidden');
  assert.equal(signOuts, previous);
  await rejectRequest('/tontines', 500, 'Server unavailable');
  assert.equal(banners.pop(), 'Server unavailable');
  await rejectRequest('/tontines', 401, 'Sign in required', null);
  assert.equal(signOuts, previous);
  assert.equal(banners.pop(), 'Sign in required');

  // A stored expired token must be removed during startup, not restored.
  const React = require('react');
  const effects = [], states = [], removed = [];
  const startupError = new errors.AppApiError({ message: '', kind: 'auth', status: 401 });
  const { AuthProvider } = load('hooks/use-auth.tsx', {
    react: { ...React, useState: initial => [initial, state => states.push(state)], useEffect: fn => effects.push(fn), useMemo: fn => fn() },
    'expo-router': { useRouter: () => ({ replace() {} }), useSegments: () => ['(auth)'] },
    '@react-native-async-storage/async-storage': {
      getItem: async key => key === 'auth.accessToken' ? 'expired-token' : '{"id":1}',
      removeItem: async key => removed.push(key),
    },
    '@/hooks/biometric-auth': {},
    '@/hooks/auth-session': { subscribeToSessionExpired: () => () => {} },
    '@/hooks/api-client': { api: { get: async () => { throw startupError; } }, setApiAccessToken() {} },
    '@/hooks/error-utils': errors,
    '@/hooks/use-i18n': { translateText: text => text },
    '@/hooks/invitation-links': {},
  });
  AuthProvider({ children: null });
  effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(removed.sort(), ['auth.accessToken', 'auth.user']);
  assert.equal(states.at(-1).accessToken, null);
  assert.equal(states.at(-1).user, null);
  assert.equal(states.at(-1).isLoading, false);
  console.log('Session expiry checks passed: silent sign-out, startup cleanup, and other errors preserved.');
})().catch(error => { console.error(error); process.exitCode = 1; });
