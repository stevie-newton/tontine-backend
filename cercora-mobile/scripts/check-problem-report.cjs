const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function load(file, mocks) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, Error, require: key => key in mocks ? mocks[key] : require(key) });
  return exports;
}

const settle = () => new Promise(resolve => setImmediate(resolve));
const plain = value => JSON.parse(JSON.stringify(value));
const valid = {
  location: '  Joining a tontine  ',
  description: '  The join button stays disabled after I enter the code.  ',
  requesterName: '  Beta Tester  ',
  requesterPhone: '+1 (514) 555-0123',
};

function reportClient({ platform = 'android', version = '1.0.2', post = async () => ({ data: { id: 42 } }) } = {}) {
  return load('hooks/problem-report.ts', {
    'expo-constants': { expoConfig: { version, extra: { token: 'PRIVATE_CONFIG_TOKEN', logs: ['PRIVATE_LOG'] } }, deviceName: 'PRIVATE_DEVICE_ID' },
    'react-native': { Platform: { OS: platform, Version: 35 } },
    '@/hooks/api-client': { api: { post } },
  });
}

async function checkValidationAndPayloads() {
  const requests = [];
  const client = reportClient({ post: async (...args) => { requests.push(args); return { data: { id: 42 } }; } });
  const invalid = [
    {},
    { location: ' \n ' },
    { location: 'x'.repeat(121) },
    { description: '' },
    { description: 'too short' },
    { description: 'x'.repeat(3001) },
    { requesterName: ' ' },
    { requesterName: 'x'.repeat(101) },
    { requesterPhone: 'bad phone' },
    { requesterPhone: '+123456' },
    { requesterPhone: '+1234567890123456' },
  ];
  for (const [index, change] of invalid.entries()) {
    const values = index === 0 ? { location: '', description: '', requesterName: '', requesterPhone: '' } : { ...valid, ...change };
    assert.ok(Object.keys(client.getProblemReportErrors(values)).length > 0);
    await assert.rejects(client.submitProblemReport(values, 'en', 'profile'));
  }
  assert.equal(requests.length, 0, 'Invalid reports must never reach the API');
  assert.deepEqual(plain(await client.submitProblemReport(valid, 'fr', 'profile')), { id: 42 });
  const [url, payload, options] = requests[0];
  assert.equal(url, '/support/ticket');
  assert.deepEqual(Object.keys(payload).sort(), ['message', 'requester_name', 'requester_phone']);
  assert.equal(payload.requester_name, 'Beta Tester');
  assert.equal(payload.requester_phone, '+15145550123');
  assert.equal(payload.message, [
    'Cercora beta feedback',
    'Where I got stuck: Joining a tontine',
    '',
    'What happened:',
    'The join button stays disabled after I enter the code.',
    '',
    'App version: 1.0.2',
    'Platform: android',
    'OS version: 35',
    'Language: fr',
    'Opened from: profile',
  ].join('\n'), 'Only user text and allow-listed software context should be transmitted');
  assert.equal(options.timeout, 30000);

  const webRequests = [];
  const webClient = reportClient({ platform: 'web', version: null, post: async (...args) => { webRequests.push(args); return { data: { id: 1 } }; } });
  await webClient.submitProblemReport(valid, 'PRIVATE_LOCALE', '/tontines/99?token=PRIVATE_ROUTE_TOKEN');
  const webMessage = webRequests[0][1].message;
  assert.match(webMessage, /App version: unknown/);
  assert.match(webMessage, /Platform: web\nLanguage: en\nOpened from: direct$/);
  assert.doesNotMatch(webMessage, /PRIVATE_|OS version|tontines\/99/);

  for (const data of [null, {}, { id: 0 }, { id: -1 }, { id: 1.5 }, { id: '42' }, { id: Number.MAX_SAFE_INTEGER + 1 }]) {
    const badResponseClient = reportClient({ post: async () => ({ data }) });
    await assert.rejects(badResponseClient.submitProblemReport(valid, 'en', 'sign-in'), /could not confirm/);
  }
}

// Runs component event handlers and effects without a native renderer or network.
function hookHarness() {
  let cursor = 0;
  const values = [], dependencies = [], cleanups = [], pending = [];
  const react = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial;
      return [values[index], value => { values[index] = typeof value === 'function' ? value(values[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = { current: initial };
      return values[index];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!deps || !dependencies[index] || deps.some((value, i) => !Object.is(value, dependencies[index][i]))) {
        dependencies[index] = deps;
        pending.push(() => { cleanups[index]?.(); cleanups[index] = effect(); });
      }
    },
    useMemo(factory) { cursor++; return factory(); },
  };
  return {
    react,
    render(component) {
      cursor = 0;
      const tree = component();
      pending.splice(0).forEach(effect => effect());
      return tree;
    },
    unmount() { cleanups.forEach(cleanup => cleanup?.()); },
  };
}

function elements(node, result = []) {
  if (Array.isArray(node)) node.forEach(child => elements(child, result));
  else if (node && typeof node === 'object' && node.props) {
    result.push(node);
    elements(node.props.children, result);
  }
  return result;
}

function screenScenario({ authenticated = false, origin = 'sign-in', response } = {}) {
  const harness = hookHarness();
  const submissions = [], routes = [], pending = [];
  const helper = reportClient({ post: (...args) => {
    submissions.push(args);
    if (response) return Promise.resolve(response);
    return new Promise((resolve, reject) => pending.push({ resolve, reject }));
  } });
  const Screen = load('app/report-problem.tsx', {
    react: harness.react,
    '@expo/vector-icons/Ionicons': 'Icon',
    'expo-router': { useRouter: () => ({ canGoBack: () => false, back() { routes.push('back'); }, replace(route) { routes.push(route); } }), useLocalSearchParams: () => ({ from: origin, token: 'PRIVATE_ROUTE_TOKEN' }) },
    'react-native': { KeyboardAvoidingView: 'Keyboard', Platform: { OS: 'android' }, Pressable: 'Pressable', ScrollView: 'Scroll', StyleSheet: { create: x => x }, TextInput: 'Input', View: 'View' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeArea' },
    '@/components/phone-input': { PhoneInput: 'Phone' },
    '@/components/themed-text': { ThemedText: 'Text' },
    '@/components/ui/app-surface': { AppButton: 'Button', AppCard: 'Card', AppTypography: {}, useSurfaceColors: () => ({}) },
    '@/hooks/problem-report': helper,
    '@/hooks/use-auth': { useAuth: () => ({ accessToken: authenticated ? 'PRIVATE_ACCESS_TOKEN' : null, user: authenticated ? { name: '  Member Name  ', phone: '+1 (514) 555-0199', id: 77, privateValue: 'PRIVATE_USER_CONTEXT' } : null }) },
    '@/hooks/use-i18n': { useI18n: () => ({ t: (text, vars) => text.replace('{{id}}', vars?.id ?? '{{id}}'), locale: 'en' }) },
    '@/hooks/use-theme-color': { useThemeColor: () => '#111111' },
  }).default;
  const nodes = () => elements(harness.render(Screen));
  const input = label => nodes().find(node => node.type === 'Input' && node.props.accessibilityLabel === label)?.props;
  const button = label => nodes().find(node => node.type === 'Button' && node.props.label === label)?.props;
  const fill = () => {
    input('Where did you get stuck?').onChangeText(valid.location);
    input('What happened?').onChangeText(valid.description);
    if (!authenticated) {
      input('Your name').onChangeText(valid.requesterName);
      nodes().find(node => node.type === 'Phone').props.onChangeText(valid.requesterPhone);
    }
  };
  nodes();
  return { nodes, input, button, fill, submissions, routes, pending, unmount: harness.unmount };
}

async function checkForm() {
  const guest = screenScenario();
  assert.equal(guest.input('Where did you get stuck?').value, 'Signing in');
  guest.button('Send report').onPress();
  assert.equal(guest.submissions.length, 0);
  guest.input('What happened?').onChangeText(valid.description);
  guest.button('Send report').onPress();
  assert.equal(guest.submissions.length, 0, 'Guest contact details are required before sending');
  guest.fill();
  const staleSubmit = guest.button('Send report').onPress;
  staleSubmit();
  staleSubmit();
  assert.equal(guest.submissions.length, 1, 'Repeated taps must send only one request');
  assert.ok(guest.button('Sending report...').disabled);
  assert.equal(guest.button('Done'), undefined, 'Do not show success before the server confirms receipt');
  assert.equal(guest.submissions[0][0], '/support/ticket');
  assert.equal(guest.submissions[0][1].requester_name, 'Beta Tester');
  assert.equal(guest.submissions[0][1].requester_phone, '+15145550123');
  guest.pending[0].reject(new Error('Network timeout'));
  await settle();
  assert.equal(guest.submissions.length, 1, 'A timeout must not automatically resubmit a saved report');
  assert.equal(guest.input('What happened?').value, valid.description);
  assert.equal(guest.input('Where did you get stuck?').value, valid.location);
  assert.equal(guest.input('Your name').value, valid.requesterName);
  assert.ok(guest.nodes().some(node => node.props.accessibilityRole === 'alert' && node.props.children.includes('could not confirm')));
  guest.button('Send report').onPress();
  assert.equal(guest.submissions.length, 2, 'A deliberate manual retry is supported');
  guest.pending[1].resolve({ data: { id: 42 } });
  await settle();
  assert.ok(guest.nodes().some(node => node.props.children === 'Report received'));
  assert.ok(guest.nodes().some(node => node.props.children === 'Report #42'));
  assert.equal(guest.button('Send report'), undefined);
  assert.equal(guest.routes.length, 0, 'Keep the receipt visible until the tester chooses Done');
  staleSubmit();
  assert.equal(guest.submissions.length, 2, 'Stale submit callbacks must not duplicate successful reports');
  guest.button('Done').onPress();
  assert.deepEqual(guest.routes, ['/(auth)/login']);
  guest.unmount();

  const member = screenScenario({ authenticated: true, origin: 'profile' });
  assert.equal(member.input('Your name'), undefined);
  member.fill();
  member.button('Send report').onPress();
  const payload = member.submissions[0][1];
  assert.equal(member.submissions[0][0], '/support/ticket');
  assert.equal(payload.requester_name, 'Member Name');
  assert.equal(payload.requester_phone, '+15145550199');
  assert.match(payload.message, /Opened from: profile$/);
  assert.doesNotMatch(JSON.stringify(payload), /PRIVATE_/);
  member.pending[0].resolve({ data: { id: 51 } });
  await settle();
  member.button('Done').onPress();
  assert.deepEqual(member.routes, ['/(tabs)/profile']);
  member.unmount();

  const unconfirmed = screenScenario({ response: { data: { id: 0 } } });
  unconfirmed.fill();
  unconfirmed.button('Send report').onPress();
  await settle();
  assert.equal(unconfirmed.button('Done'), undefined, 'An invalid ticket ID must not produce a success receipt');
  assert.equal(unconfirmed.input('What happened?').value, valid.description);
  assert.ok(unconfirmed.button('Send report'));
  unconfirmed.unmount();
}

async function checkGuestRoute(route) {
  const harness = hookHarness();
  const redirects = [];
  const router = { replace: target => redirects.push(target) };
  const segments = [route];
  const { AuthProvider } = load('hooks/use-auth.tsx', {
    react: harness.react,
    'expo-router': { useRouter: () => router, useSegments: () => segments },
    '@react-native-async-storage/async-storage': { getItem: async () => null, removeItem: async () => {} },
    '@/hooks/biometric-auth': { getBiometricStatus: async () => ({ isAvailable: false, isEnabled: false, label: 'Face ID' }) },
    '@/hooks/auth-session': { subscribeToSessionExpired: () => () => {} },
    '@/hooks/api-client': { api: {}, setApiAccessToken() {} },
    '@/hooks/error-utils': { getErrorMessage: error => error.message, normalizeApiError: error => error },
    '@/hooks/use-i18n': { translateText: text => text },
    '@/hooks/invitation-links': { PENDING_INVITATION_KEY: 'pending.invitation', parseInvitationId: () => null },
  });
  harness.render(() => AuthProvider({ children: null }));
  await settle();
  harness.render(() => AuthProvider({ children: null }));
  await settle();
  assert.deepEqual(redirects, route === 'report-problem' ? [] : ['/(auth)/login'], 'Public feedback remains accessible while ordinary app screens require sign-in');
  harness.unmount();
}

(async () => {
  await checkValidationAndPayloads();
  await checkForm();
  await checkGuestRoute('report-problem');
  await checkGuestRoute('(tabs)');
  console.log('Problem report checks passed: validation, guest/member submission, private metadata, duplicate taps, confirmed receipts, manual retry, and logged-out access.');
})().catch(error => { console.error(error); process.exitCode = 1; });
