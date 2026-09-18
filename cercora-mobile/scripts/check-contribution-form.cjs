const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

async function scenario({ available = true, fail = false } = {}) {
  let cursor = 0, first = true, resolveUpload, rejectUpload;
  const state = [], effects = [], cleanups = [], submissions = [], removed = [], routes = [];
  const proof = { uri: 'file:///cache/proof.jpg', bytes: 300, width: 100, height: 200 };
  const t = key => key;
  const source = ts.transpileModule(fs.readFileSync('app/(tabs)/tontines/[tontineId]/cycles/[cycleId]/contribute.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mocks = {
    react: { ...React,
      useState: initial => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }]; },
      useRef: initial => { const index = cursor++; if (!(index in state)) state[index] = { current: initial }; return state[index]; },
      useEffect: effect => { if (first) effects.push(effect); },
    },
    '@expo/vector-icons/Ionicons': 'Icon',
    'expo-image': { Image: 'Image' },
    'expo-router': { Stack: { Screen: 'StackScreen' }, useRouter: () => ({ replace: route => routes.push(route) }), useLocalSearchParams: () => ({ tontineId: '2', cycleId: '3' }) },
    'react-native': { ActivityIndicator: 'Loading', KeyboardAvoidingView: 'Keyboard', Platform: { OS: 'android' }, ScrollView: 'Scroll', StyleSheet: { create: x => x }, TextInput: 'Input', View: 'View' },
    '@/components/themed-text': { ThemedText: 'Text' },
    '@/components/ui/app-surface': { AppButton: 'Button', AppCard: 'Card', AppTypography: {}, useSurfaceColors: () => ({}) },
    '@/hooks/api-client': { api: { get: async url => ({ data: url.includes('/status') ? { available } : { id: 2, name: 'Family circle', contribution_amount: 100 } }) } },
    '@/hooks/error-utils': { getErrorMessage: e => e.message },
    '@/hooks/payment-proof': {
      PaymentProofSelectionError: class extends Error {},
      choosePaymentProof: async () => proof,
      discardPaymentProof: async value => { if (value) removed.push(value); },
      submitContribution: (values, image) => { submissions.push({ values, image }); return new Promise((resolve, reject) => { resolveUpload = resolve; rejectUpload = reject; }); },
    },
    '@/hooks/use-i18n': { useI18n: () => ({ t, locale: 'en' }) },
  };
  const exported = {};
  vm.runInNewContext(source, { exports: exported, require: key => key in mocks ? mocks[key] : require(key), AbortController });
  function render() { cursor = 0; const tree = exported.default(); first = false; return tree; }
  function elements(node, result = []) {
    if (!node || typeof node !== 'object') return result;
    if (Array.isArray(node)) { node.forEach(child => elements(child, result)); return result; }
    if (node.props) { result.push(node); elements(node.props.children, result); }
    return result;
  }
  const settle = () => new Promise(resolve => setImmediate(resolve));
  render();
  effects.forEach(effect => cleanups.push(effect()));
  await settle();
  let nodes = elements(render());
  const button = label => elements(render()).find(node => node.type === 'Button' && node.props.label === label)?.props;
  assert.equal(button('Submit contribution').disabled, true, 'Reference must be provided');
  nodes.find(node => node.type === 'Input' && node.props.accessibilityLabel === 'Transaction reference').props.onChangeText('ABC123');
  if (available) {
    button('Add payment proof').onPress();
    await settle();
    assert.ok(elements(render()).some(node => node.type === 'Image'));
  } else assert.equal(button('Add payment proof'), undefined);
  const submitButton = button('Submit contribution');
  assert.equal(submitButton.disabled, false);
  submitButton.onPress();
  submitButton.onPress();
  assert.equal(submissions.length, 1, 'Repeated tap must not duplicate the upload');
  assert.equal(submissions[0].image, available ? proof : null);
  if (fail) {
    rejectUpload(new Error('Upload failed'));
    await settle();
    nodes = elements(render());
    assert.ok(nodes.some(node => node.type === 'Text' && node.props.children === 'Upload failed'));
    assert.ok(!nodes.some(node => node.props.children === 'Contribution submitted'));
    assert.equal(routes.length, 0);
    assert.ok(nodes.some(node => node.type === 'Image'), 'Keep screenshot available for retry');
    // Navigating away during a retry must wait for native file streaming to finish.
    button('Submit contribution').onPress();
    cleanups.forEach(fn => fn?.());
    assert.equal(removed.length, 0);
    rejectUpload(new Error('Upload failed'));
    await settle();
    assert.equal(removed.length, 1);
  } else {
    resolveUpload({ id: 9, amount: 100, transaction_reference: 'ABC123', proof_available: available });
    await settle();
    nodes = elements(render());
    assert.ok(nodes.some(node => node.props.children === 'Contribution submitted'));
    assert.ok(nodes.some(node => node.props.children === 'Awaiting beneficiary confirmation. Your payment is not confirmed yet.'));
    assert.equal(button('Submit contribution'), undefined);
    assert.equal(routes.length, 0, 'Success receipt must be shown before navigation');
    submitButton.onPress();
    assert.equal(submissions.length, 1);
  }
}
(async () => {
  await scenario();
  await scenario({ available: false });
  await scenario({ fail: true });
  console.log('Contribution form checks passed: optional proof, required reference, duplicate taps, receipt, retry, and upload-safe navigation cleanup.');
})().catch(error => { console.error(error); process.exitCode = 1; });
