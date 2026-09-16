const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { Slot } = require('@radix-ui/react-slot');
const { Pressable, StyleSheet, Text } = require('react-native-web');

// Link asChild uses a Radix Slot, which spreads the child's style into an object.
// Raw arrays become numeric CSS properties and throw during browser rendering.
function renderLinkStyle(style) {
  return renderToStaticMarkup(React.createElement(Slot, { style: undefined },
    React.createElement(Pressable, { style }, React.createElement(Text, null, 'Members'))));
}
assert.match(renderLinkStyle([{ padding: 12 }, { borderBottomWidth: 1 }]), /0:\[object Object\]/);

const source = ts.createSourceFile('detail.tsx', fs.readFileSync('app/(tabs)/tontines/[tontineId].tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const styles = { navigationRow: { padding: 12 }, navigationRowBorder: { borderBottomWidth: 1 } };
let checked = 0;
function visit(node) {
  if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'Link') {
    for (const child of node.children) {
      if (!ts.isJsxElement(child) || child.openingElement.tagName.getText(source) !== 'Pressable') continue;
      const attr = child.openingElement.attributes.properties.find(a => a.name?.getText(source) === 'style');
      const expression = attr?.initializer?.expression;
      if (!expression || !expression.getText(source).includes('navigationRowBorder')) continue;
      const style = vm.runInNewContext(expression.getText(source), { styles, StyleSheet });
      assert.equal(Array.isArray(style), false);
      const markup = renderLinkStyle(style);
      assert.doesNotMatch(markup, /\d+:\[object Object\]/);
      checked++;
    }
  }
  ts.forEachChild(node, visit);
}
visit(source);
assert.equal(checked, 4);
console.log('Link style regression checks passed for all four group navigation links.');
