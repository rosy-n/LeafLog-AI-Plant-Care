const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { screen, nodes } = require('./helpers/screen.cjs');

test('the app shell provides safe-area context above navigation and floating overlays', () => {
  // Only render the real app shell; child screens and their side effects stay mocked.
  const source = ts.createSourceFile('App.js', readFileSync(path.resolve(__dirname, '../App.js'), 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const imports = {};
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const id = statement.moduleSpecifier.text;
    if (id === 'react' || id === 'react-native') continue;
    const stub = { __esModule: true, default: id };
    const named = statement.importClause?.namedBindings;
    if (named && ts.isNamedImports(named)) {
      for (const element of named.elements) stub[element.propertyName?.text ?? element.name.text] = element.name.text;
    }
    imports[id] = stub;
  }
  imports['@react-navigation/native-stack'] = { createNativeStackNavigator: () => ({}) };
  const metrics = { insets: { top: 47, bottom: 34, left: 0, right: 0 } };
  imports['react-native-safe-area-context'] = { SafeAreaProvider: 'SafeAreaProvider', initialWindowMetrics: metrics };
  const app = screen('App.js', imports);
  const tree = app.render({ user: { id: 1 }, onLogout() {} });
  assert.equal(tree.type, 'SafeAreaProvider');
  assert.equal(tree.props.initialMetrics, metrics);
  assert.ok(nodes(tree).some(node => node.type === 'BackgroundMusicProvider'));
  assert.ok(nodes(tree).some(node => typeof node.type === 'function' && node.type.name === 'MainAppContent'));
  app.dispose();
});
