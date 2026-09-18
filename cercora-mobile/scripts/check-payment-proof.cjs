const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const calls = [], deleted = [], revoked = [];
let platform = 'android', pickResult = { canceled: true }, failUpload = false;
let saved = { uri: 'file:///cache/proof.jpg', width: 1080, height: 1920, base64: 'YWJj' };
let renders = 0, released = 0, resize = null;
class MockFormData {
  fields = [];
  append(...args) { this.fields.push(args); }
}
const code = ts.transpileModule(fs.readFileSync('hooks/payment-proof.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
}).outputText;
const exportsObject = {};
const mocks = {
  'expo-image-picker': { launchImageLibraryAsync: async () => pickResult },
  'expo-image-manipulator': {
    SaveFormat: { JPEG: 'jpeg' },
    ImageManipulator: { manipulate: () => ({
      resize: value => { resize = value; }, release: () => released++,
      renderAsync: async () => { renders++; return { uri: 'blob:intermediate', saveAsync: async () => saved, release: () => released++ }; },
    }) },
  },
  'expo-file-system/legacy': { cacheDirectory: 'file:///cache/', deleteAsync: async uri => deleted.push(uri) },
  'react-native': { Platform: { get OS() { return platform; } } },
  '@/hooks/use-i18n': { translateText: text => text },
  '@/hooks/api-client': { api: { post: async (...args) => {
    calls.push(args);
    if (failUpload) throw new Error('Upload failed');
    args[2]?.onUploadProgress?.({ loaded: 5, total: 10 });
    return { data: { id: 4, amount: '100', transaction_reference: 'ABC123', proof_available: args[0].endsWith('with-proof') } };
  } } },
};
vm.runInNewContext(code, {
  exports: exportsObject, require: key => mocks[key], FormData: MockFormData, URL: { revokeObjectURL: uri => revoked.push(uri) },
  fetch: async () => ({ blob: async () => 'browser-image-blob' }), Error,
});
const { choosePaymentProof, discardPaymentProof, submitContribution, MAX_PROOF_BYTES } = exportsObject;
const values = { cycleId: 3, amount: '100,00', reference: ' ABC123 ' };
(async () => {
  assert.equal(await choosePaymentProof(), null);
  assert.equal(renders, 0);
  pickResult = { canceled: false, assets: [{ uri: 'file:///photos/original.png', width: 1080, height: 3000 }] };
  const proof = await choosePaymentProof();
  assert.equal(proof.bytes, 3);
  assert.equal(resize.height, 2400);
  assert.equal(released, 2);
  await discardPaymentProof(proof);
  await discardPaymentProof({ ...proof, uri: 'file:///photos/original.png' });
  assert.deepEqual(deleted, ['file:///cache/proof.jpg']);
  const noProof = await submitContribution(values, null);
  assert.equal(noProof.proof_available, false);
  assert.equal(calls.at(-1)[0], '/contributions/');
  assert.equal(calls.at(-1)[1].amount, '100.00');
  assert.equal(calls.at(-1)[1].transaction_reference, 'ABC123');
  let progress;
  const receipt = await submitContribution(values, proof, value => { progress = value; });
  assert.equal(receipt.proof_available, true);
  assert.equal(progress, 50);
  const native = calls.at(-1);
  assert.equal(native[0], '/contributions/with-proof');
  assert.equal(native[1].fields.filter(([name]) => name === 'proof').length, 1);
  assert.equal(native[1].fields.find(([name]) => name === 'proof')[1].type, 'image/jpeg');
  assert.equal(native[2].headers['Content-Type'], 'multipart/form-data');
  platform = 'web';
  saved = { ...saved, uri: 'blob:processed' };
  pickResult.assets[0].uri = 'blob:original';
  const browserProof = await choosePaymentProof();
  assert.deepEqual(revoked, ['blob:intermediate', 'blob:original']);
  await discardPaymentProof(browserProof);
  assert.equal(revoked.at(-1), 'blob:processed');
  await submitContribution(values, proof);
  assert.equal(calls.at(-1)[1].fields.find(([name]) => name === 'proof')[1], 'browser-image-blob');
  assert.equal(calls.at(-1)[2].headers, undefined);
  const count = calls.length;
  for (const invalid of [{ ...values, reference: '' }, { ...values, amount: '0' }, { ...values, amount: '10.123' }, { ...values, cycleId: -1 }]) {
    await assert.rejects(submitContribution(invalid, null));
  }
  await assert.rejects(submitContribution(values, { ...proof, bytes: MAX_PROOF_BYTES + 1 }));
  assert.equal(calls.length, count);
  failUpload = true;
  await assert.rejects(submitContribution(values, proof), /Upload failed/);
  assert.equal(calls.length, count + 1, 'Failed upload must not silently fall back to a submission without proof');
  pickResult = { canceled: false, assets: [{ uri: 'oversized', width: 10000, height: 10000 }] };
  await assert.rejects(choosePaymentProof(), /megapixels/);
  console.log('Payment proof checks passed: picker cancellation, compression, cache cleanup, native/web upload, required reference, size limits, failure propagation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
