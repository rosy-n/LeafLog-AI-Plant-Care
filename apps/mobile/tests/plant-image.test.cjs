const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Test render decisions and native image callbacks without needing a simulator.
function setup() {
  let state = [];
  let cursor = 0;
  const warnings = [];
  const createElement = (type, props, ...children) => ({
    type, key: props?.key, props: { ...props, children },
  });
  const react = {
    __esModule: true,
    default: { createElement },
    useState(initial) {
      const i = cursor++;
      if (!(i in state)) state[i] = initial;
      return [state[i], (next) => { state[i] = next; }];
    },
  };
  const Image = Object.assign(function Image() {}, {
    resolveAssetSource: (source) => ({ uri: typeof source === 'number' ? `asset:${source}` : source.uri,
      width: 1024, height: 1024 }),
  });
  const imports = {
    react,
    'react-native': { Image, View: 'View', ActivityIndicator: 'Spinner',
      StyleSheet: { create: (value) => value, absoluteFill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 } } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '../data/plants': { plantImages: { spaghetti: 1 } },
    './DecorImage': { __esModule: true, default: 'DecorImage' },
    '../hooks/useMediaSource': { __esModule: true, default: (source) => ({ source, refresh() {} }) },
  };
  const filename = path.resolve(__dirname, '../src/components/PlantImage.jsx');
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    module, exports: module.exports,
    console: { warn: (message) => warnings.push(message) },
    require: (id) => { assert.ok(Object.hasOwn(imports, id)); return imports[id]; },
  });
  return {
    Image, warnings, PlantImage: module.exports.default,
    render(element) { cursor = 0; return element.type(element.props); },
    remount() { state = []; },
  };
}

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
const props = {
  uri: 'http://example.test/plant.png', expressionSource: 2,
  expressionBounds: [300, 600, 700, 800], effectSource: 3,
};

test('face and effect wait for the base image, then appear above it', () => {
  const app = setup();
  const element = app.PlantImage(props);
  let rendered = nodes(app.render(element));
  assert.equal(rendered.filter((n) => n.type === app.Image).length, 1);
  assert.ok(rendered.some((n) => n.type === 'Spinner'));
  rendered.find((n) => n.type === app.Image).props.onLoad();
  rendered = nodes(app.render(element));
  assert.equal(rendered.filter((n) => n.type === app.Image).length, 3);
  assert.ok(!rendered.some((n) => n.type === 'Spinner'));
});

test('failed base images never leave a floating face or effect', () => {
  const app = setup();
  const element = app.PlantImage(props);
  nodes(app.render(element)).find((n) => n.type === app.Image).props.onError();
  const rendered = nodes(app.render(element));
  assert.equal(rendered.filter((n) => n.type === app.Image).length, 1);
  assert.ok(rendered.some((n) => n.type === 'Icon'));
  assert.equal(app.warnings.length, 1);
});

test('replacing the plant image resets the loaded state through a new key', () => {
  const app = setup();
  const original = app.PlantImage(props);
  nodes(app.render(original)).find((n) => n.type === app.Image).props.onLoad();
  const replacement = app.PlantImage({ ...props, uri: 'http://example.test/new.png' });
  assert.notEqual(replacement.key, original.key);
  app.remount();
  assert.equal(nodes(app.render(replacement)).filter((n) => n.type === app.Image).length, 1);
});

test('changing expression does not reload an already loaded plant', () => {
  const app = setup();
  const original = app.PlantImage(props);
  nodes(app.render(original)).find((n) => n.type === app.Image).props.onLoad();
  const blinking = app.PlantImage({ ...props, expressionSource: 4 });
  assert.equal(blinking.key, original.key);
  const rendered = nodes(app.render(blinking));
  assert.ok(rendered.some((n) => n.type === app.Image && n.props.source === 4));
  assert.ok(!rendered.some((n) => n.type === 'Spinner'));
});

test('bundled effects keep priority over old full-pot remote preview images', () => {
  const app = setup();
  const element = app.PlantImage({ ...props, effectSource: null,
    effectRemote: { uri: 'http://example.test/preview.png' }, effectFallback: 5 });
  nodes(app.render(element)).find((n) => n.type === app.Image).props.onLoad();
  const decor = nodes(app.render(element)).find((n) => n.type === 'DecorImage');
  assert.equal(decor.props.remote, null);
  assert.equal(decor.props.fallback, 5);
});
