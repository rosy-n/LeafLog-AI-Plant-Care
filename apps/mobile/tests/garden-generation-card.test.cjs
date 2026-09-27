const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { screen, nodes } = require('./helpers/screen.cjs');

function constants(name) {
  const file = path.resolve(__dirname, `../constants/${name}.ts`);
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  const module = { exports: {} };
  new Function('module', 'exports', outputText)(module, module.exports);
  return module.exports;
}

function card(outcome = 'working', percent = 8) {
  const app = screen('src/components/GardenGenerationCard.tsx', {
    '../../constants/colors': constants('colors'),
    '../../constants/fonts': constants('fonts'),
    '../../constants/spacing': constants('spacing'),
  });
  let presses = 0;
  const tree = app.render({
    progress: { outcome, percent, shortLabel: {
      working: '만드는 중…', completed: '완성! 고르기', failed: '생성 실패',
    }[outcome] },
    onPress: () => { presses += 1; },
  });
  return { app, tree, presses: () => presses };
}

test('garden progress and label share one centered touch target', () => {
  const { app, tree, presses } = card();
  assert.equal(tree.type, 'TouchableOpacity');
  assert.equal(nodes(tree).filter(node => node.type === 'TouchableOpacity').length, 1);
  const texts = nodes(tree).filter(node => node.type === 'Text');
  assert.deepEqual(texts.map(node => node.props.children), ['8%', '만드는 중…']);
  for (const text of texts) assert.equal(text.props.style.textAlign, 'center');
  assert.match(tree.props.accessibilityLabel, /8%/);
  tree.props.onPress();
  assert.equal(presses(), 1);
  const track = nodes(tree).find(node => node.props.accessibilityRole === 'progressbar');
  assert.equal(track.props.accessibilityValue.now, 8);
  assert.ok(nodes(track).some(node => node.props.style?.some?.(style => style.width === '8%')));
  app.dispose();
});

test('garden status keeps the same frame for progress, completion and failure', () => {
  let frame;
  for (const outcome of ['working', 'completed', 'failed']) {
    const { app, tree } = card(outcome, outcome === 'working' ? 99 : 100);
    const style = tree.props.style;
    assert.equal(style.width, '100%');
    assert.equal(style.maxWidth, 100);
    assert.equal(style.aspectRatio, 1);
    frame ??= JSON.stringify(style);
    assert.equal(JSON.stringify(style), frame);
    // 320px screen: 40px gutter, three columns, 8px gap per pending slot.
    const available = (320 - 40) / 3 - 8;
    assert.ok(Math.min(available, style.maxWidth) > 80);
    const label = nodes(tree).find(node => node.type === 'Text' && node.props.numberOfLines);
    assert.equal(label.props.numberOfLines, 2);
    assert.equal(label.props.style.letterSpacing, 0);
    if (outcome !== 'working') {
      assert.ok(!nodes(tree).some(node => node.props.accessibilityRole === 'progressbar'));
      assert.ok(!nodes(tree).some(node => node.type === 'Text' && /100%/.test(node.props.children)));
      assert.equal(nodes(tree).find(node => node.type === 'Icon').props.name,
        outcome === 'failed' ? 'alert-circle-outline' : 'checkmark-circle-outline');
    }
    app.dispose();
  }
});

test('garden pending item uses the unified card without the old negative name margin', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/screens/GardenScreen.jsx'), 'utf8');
  const pending = source.slice(source.indexOf('if (item.pendingRegistration)'), source.indexOf('const accessory = decorations'));
  assert.match(pending, /<GardenGenerationCard/);
  assert.match(pending, /progress=\{item.progress\}/);
  assert.match(pending, /registrationResumeScreen\(draft\)/);
  assert.doesNotMatch(pending, /styles\.(nameRow|plantName|pendingBox)/);
});
