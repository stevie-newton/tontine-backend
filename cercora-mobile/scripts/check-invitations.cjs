const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
function load(file, mocks) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2021 } }).outputText;
  vm.runInNewContext(js, { exports, require: key => key in mocks ? mocks[key] : require(key), console });
  return exports;
}
const links = load('hooks/invitation-links.ts', { 'expo-linking': { createURL: (path, { queryParams }) => `cercoramobile://${path}?${new URLSearchParams(queryParams)}` } });
for (const value of [undefined, null, '', '0', '-1', '1.5', '1e2', '01', ['2'], '9007199254740992', 'https://elsewhere.test']) assert.equal(links.parseInvitationId(value), null);
assert.equal(links.parseInvitationId('42'), 42);
assert.equal(links.createInvitationLink(42), 'cercoramobile://invitation?tontineId=42');
assert.throws(() => links.createInvitationLink(-1));

async function scenario({ signedIn, id = '42', pending = [] }) {
  let cursor = 0;
  const state = [], effects = [], posts = [], routes = [], stored = [], gets = [];
  const screen = load('app/invitation.tsx', {
    react: { ...React, useState: initial => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }]; }, useEffect: effect => effects.push(effect), useCallback: fn => fn },
    '@react-native-async-storage/async-storage': { setItem: async (...args) => stored.push(args) },
    'expo-router': { useLocalSearchParams: () => ({ tontineId: id }), useRouter: () => ({ push: route => routes.push(route), replace: route => routes.push(route) }) },
    'react-native': { ActivityIndicator: 'Loading', ScrollView: 'ScrollView', View: 'View' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@/components/ui/app-surface': { AppButton: 'Button', AppCard: 'Card', AppTypography: {}, useSurfaceColors: () => ({}) },
    '@/components/themed-text': { ThemedText: 'Text' },
    '@/hooks/api-client': { api: { get: async path => { gets.push(path); return { data: pending }; }, post: async path => posts.push(path) } },
    '@/hooks/use-auth': { useAuth: () => ({ accessToken: signedIn ? 'test' : null, user: { phone: 'test-phone' } }) },
    '@/hooks/error-utils': { getErrorMessage: e => String(e) },
    '@/hooks/invitation-links': links,
    '@/hooks/use-i18n': { useI18n: () => ({ t: key => key }) },
  }).default;
  const render = () => { cursor = 0; return screen(); };
  render();
  effects.splice(0).forEach(effect => effect());
  await new Promise(resolve => setImmediate(resolve));
  const tree = render();
  function buttons(node, found = []) {
    if (!node || typeof node !== 'object') return found;
    if (Array.isArray(node)) { node.forEach(n => buttons(n, found)); return found; }
    if (node.type === 'Button') found.push(node.props);
    buttons(node.props?.children, found);
    return found;
  }
  return { buttons: buttons(tree), posts, routes, stored, gets };
}
(async () => {
  const anonymous = await scenario({ signedIn: false });
  assert.equal(anonymous.gets.length, 0);
  await anonymous.buttons.find(b => b.label === 'Sign in').onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(anonymous.stored[0][1], '42');
  assert.equal(anonymous.routes[0], '/(auth)/login');
  const invalid = await scenario({ signedIn: true, id: '-1' });
  assert.equal(invalid.gets.length, 0);
  const wrongAccount = await scenario({ signedIn: true, pending: [{ membership_id: 100, tontine_id: 99 }] });
  assert.ok(!wrongAccount.buttons.some(b => b.label === 'Accept invitation'));
  assert.equal(wrongAccount.posts.length, 0);
  const invited = await scenario({ signedIn: true, pending: [{ membership_id: 123, tontine_id: 42, tontine_name: 'Test circle' }] });
  assert.equal(invited.posts.length, 0, 'Opening a link must never auto-accept');
  await invited.buttons.find(b => b.label === 'Accept invitation').onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(invited.posts[0], '/tontine-memberships/123/accept');
  assert.equal(invited.routes[0].params.tontineId, '42');
  console.log('Invitation checks passed: malformed links, sign-in handoff, account matching, explicit acceptance, and group navigation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
