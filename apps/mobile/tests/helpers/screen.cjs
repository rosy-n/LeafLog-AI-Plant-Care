const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise screen callbacks and effect cleanup; native UI still needs device QA.
function screen(relativePath, imports = {}, globals = {}) {
  const hooks = [];
  let cursor = 0;
  const pending = [];
  const focusEffects = new Set();
  const timers = new Map();
  let timerId = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const i = cursor++;
      hooks[i] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [hooks[i].value, (value) => {
        hooks[i].value = typeof value === 'function' ? value(hooks[i].value) : value;
      }];
    },
    useRef(initial) {
      const i = cursor++;
      hooks[i] ??= { current: initial };
      return hooks[i];
    },
    useMemo(fn, deps) {
      const i = cursor++;
      if (!same(hooks[i]?.deps, deps)) hooks[i] = { value: fn(), deps };
      return hooks[i].value;
    },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!same(hooks[i]?.deps, deps)) {
        pending.push(() => {
          hooks[i]?.cleanup?.();
          hooks[i] = { deps, cleanup: fn() };
        });
      }
    },
  };
  const alerts = [];
  const native = Object.fromEntries([
    'View', 'Text', 'TextInput', 'Image', 'ScrollView', 'TouchableOpacity', 'Pressable',
    'KeyboardAvoidingView', 'ActivityIndicator', 'StatusBar', 'Modal',
  ].map((name) => [name, name]));
  Object.assign(native, {
    Alert: { alert: (...args) => alerts.push(args) },
    Platform: { OS: 'ios' },
    StyleSheet: { create: (v) => v, absoluteFill: {} },
    Animated: {
      Value: class { setValue() {} interpolate() { return 0; } },
      timing: () => ({ start() {} }),
    },
    AppState: { addEventListener: () => ({ remove() {} }) },
  });
  const defaults = {
    react: { __esModule: true, default: react, ...react },
    'react-native': native,
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@react-navigation/native': {
      useFocusEffect: (fn) => react.useEffect(() => {
        const effect = { fn, cleanup: fn() };
        focusEffects.add(effect);
        return () => { effect.cleanup?.(); focusEffects.delete(effect); };
      }, [fn]),
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
  };
  const filename = path.resolve(__dirname, '../..', relativePath);
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  defaults['react/jsx-runtime'] = {
    jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }),
  };
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    module, exports: module.exports, console,
    setTimeout(fn, delay) { timers.set(++timerId, { fn, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    ...globals,
    require(id) {
      if (id.endsWith('.png')) return id;
      if (Object.hasOwn(imports, id)) return imports[id];
      if (Object.hasOwn(defaults, id)) return defaults[id];
      assert.fail(`Unexpected import: ${id}`);
    },
  }, { filename });
  return {
    alerts, timers, native, exports: module.exports,
    render(props = {}) {
      cursor = 0;
      const tree = module.exports.default(props);
      pending.splice(0).forEach((fn) => fn());
      return tree;
    },
    runTimer(delay) {
      const entry = [...timers].find(([, timer]) => timer.delay === delay);
      assert.ok(entry, `Missing timer: ${delay}`);
      timers.delete(entry[0]);
      return entry[1].fn();
    },
    dispose() { hooks.forEach((hook) => hook?.cleanup?.()); },
    blur() { focusEffects.forEach((effect) => { effect.cleanup?.(); effect.cleanup = undefined; }); },
    focus() { focusEffects.forEach((effect) => { effect.cleanup = effect.fn(); }); },
  };
}

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

module.exports = { screen, nodes, deferred, flush };
