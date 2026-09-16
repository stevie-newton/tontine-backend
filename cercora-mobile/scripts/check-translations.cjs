const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
function load(file, mocks, extra = '') {
  const compiled = ts.transpileModule(read(file) + extra, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name),
    Intl,
  }, { filename: file });
  return exports;
}

// Expose internals only in this isolated test module, without changing the app API.
const i18n = load('hooks/use-i18n.tsx', {
  '@react-native-async-storage/async-storage': {},
}, '\nexport const testOnly = { translate, frTranslations, enTranslations, I18nContext, setCurrentLocale };');
const { translate, frTranslations, enTranslations, I18nContext, setCurrentLocale } = i18n.testOnly;
const failures = [];
function checkKey(key, file) {
  if (/[a-zA-Z]/.test(key) && !Object.hasOwn(frTranslations, key)) failures.push(`${file}: ${key}`);
}

function scan(directory) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { scan(file); continue; }
    if (!/\.tsx?$/.test(file) || file === path.join('hooks', 'use-i18n.tsx')) continue;
    const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
    function literalKeys(node) {
      if (ts.isStringLiteralLike(node)) checkKey(node.text, file);
      if (ts.isConditionalExpression(node)) {
        literalKeys(node.whenTrue);
        literalKeys(node.whenFalse);
      }
      if (ts.isBinaryExpression(node)) {
        literalKeys(node.left);
        literalKeys(node.right);
      }
    }
    function visit(node) {
      if (ts.isCallExpression(node) && ['t', 'translateText', 'setMessage', 'setPushError'].includes(node.expression.getText(source))) {
        if (node.arguments[0]) literalKeys(node.arguments[0]);
      }
      if (ts.isJsxText(node)) {
        const text = node.text.trim();
        // h is the language-independent abbreviation for hours.
        if (text !== 'h') checkKey(text, file);
      }
      if (ts.isJsxAttribute(node) && ['accessibilityLabel', 'accessibilityHint', 'placeholder', 'title', 'subtitle', 'label'].includes(node.name.getText(source))) {
        if (node.initializer && ts.isStringLiteral(node.initializer)) checkKey(node.initializer.text, file);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
['app', 'components', 'hooks'].forEach(scan);
assert.deepEqual(failures, [], `Missing French translations:\n${failures.join('\n')}`);

// Both languages must retain the same interpolation parameters.
const placeholders = (text) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
for (const [key, value] of Object.entries(frTranslations)) {
  assert.deepEqual(placeholders(value), placeholders(enTranslations[key] ?? key), key);
  assert.ok(value.trim(), `Empty translation: ${key}`);
}
assert.equal(translate('fr', 'Open a group or create a new savings circle.'), 'Ouvrez un groupe ou créez une nouvelle tontine.');
assert.equal(translate('fr', '{{count}} group(s)', { count: 4 }), '4 groupe(s)');
assert.equal(translate('en', '{{count}} group(s)', { count: 4 }), '4 group(s)');
for (const locale of ['en', 'fr']) {
  assert.equal(translate(locale, 'Tontine Famille'), 'Tontine Famille');
  assert.equal(translate(locale, 'New tontine'), 'New tontine');
}

// Simulate switching both ways while the non-React locale still has its old value.
const { ThemedText } = load('components/themed-text.tsx', {
  'react-native': { Text: 'span', StyleSheet: { create: (styles) => styles } },
  '@/constants/theme': { Fonts: {} },
  '@/hooks/use-theme-color': { useThemeColor: () => '#000' },
  '@/hooks/use-i18n': i18n,
});
for (const locale of ['en', 'fr', 'en']) {
  setCurrentLocale(locale === 'en' ? 'fr' : 'en');
  const markup = renderToStaticMarkup(React.createElement(I18nContext.Provider, {
    value: { locale, t: (key, params) => translate(locale, key, params) },
  }, React.createElement(ThemedText, null, 'New password')));
  assert.ok(markup.includes(locale === 'fr' ? 'Nouveau mot de passe' : 'New password'), markup);
}
console.log(`Translation checks passed: ${Object.keys(frTranslations).length} French entries, UI coverage, placeholders, and switching in both directions.`);
