const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const photoBytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

// Native modules need a device. Exercise the real Expo multipart encoder here,
// with a File double that has the same bytes/name/type interface as native File.
function loadTs(relativePath, imports = {}, globals = {}) {
  const filename = path.join(root, relativePath);
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    module, exports: module.exports, Blob, TextEncoder, Uint8Array,
    console, process: { env: {} }, ...globals,
    require(id) {
      assert.ok(Object.hasOwn(imports, id), `Unexpected import: ${id}`);
      return imports[id];
    },
  }, { filename });
  return module.exports;
}

class NativeFile {
  constructor(uri) { this.uri = uri; }
  get name() { return this.uri.split('/').at(-1); }
  get type() { return this.name.endsWith('.png') ? 'image/png' : 'image/jpeg'; }
  async bytes() { return photoBytes; }
}

function setup({ offline = false } = {}) {
  class FormData { constructor() { this._parts = []; } }
  loadTs('node_modules/expo/src/winter/FormData.ts').installFormDataPatch(FormData);
  const { convertFormDataAsync } = loadTs(
    'node_modules/expo/src/winter/fetch/convertFormData.ts',
    { '../../utils/blobUtils': { blobToArrayBufferAsync: (blob) => blob.arrayBuffer() } },
  );
  const calls = [];
  const globals = {
    FormData,
    async fetch(url, options) {
      if (offline) throw new TypeError('Network request failed');
      const { body, boundary } = await convertFormDataAsync(options.body, 'test-boundary');
      calls.push({ url, options, body: Buffer.from(body), boundary });
      return { ok: true, json: async () => ({ results: [] }) };
    },
  };
  const imports = {
    'expo-constants': { __esModule: true, default: { expoConfig: { hostUri: 'localhost:8081' } } },
    'expo-file-system': { File: NativeFile },
    'expo-image-manipulator': {
      SaveFormat: { JPEG: 'jpeg' },
      ImageManipulator: {
        manipulate: () => ({
          renderAsync: async () => ({ saveAsync: async () => ({ uri: 'file:///converted.jpg' }) }),
        }),
      },
    },
  };
  return { calls, globals, convertFormDataAsync,
    api: loadTs('src/api.ts', imports, globals),
    plantnet: loadTs('services/plantnet.ts', imports, globals) };
}

test('SDK 57 rejects the old uri-only multipart part', async () => {
  const { globals, convertFormDataAsync } = setup();
  const form = new globals.FormData();
  form.append('file', { uri: 'file:///photo.png', name: 'photo.png', type: 'image/png' });
  await assert.rejects(convertFormDataAsync(form), /Unsupported FormDataPart/);
});

test('character generation and background endpoints send image bytes with auth', async () => {
  const { api, calls } = setup();
  api.setAuthToken('test-token');
  const photo = { uri: 'file:///photo.png' };
  await api.startCharacterGeneration(photo);
  await api.preprocessPlantImage(photo);
  await api.removeGeneratedImageBackground(photo);
  assert.equal(calls.length, 3);
  assert.ok(calls[0].url.endsWith('/api/character-generations'));
  for (const { options, body } of calls) {
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.equal(options.headers['Content-Type'], undefined);
    assert.match(body.toString(), /name="file"; filename="photo.png"/);
    assert.match(body.toString(), /content-type: image\/png/);
    assert.ok(body.includes(Buffer.from(photoBytes)));
  }
});

test('diagnosis preserves image and text fields', async () => {
  const { api, calls } = setup();
  await api.diagnosePlantPhoto({ uri: 'file:///photo.png' }, 'dry leaves', 42, 9);
  const body = calls[0].body.toString();
  assert.match(body, /name="file"; filename="photo.png"/);
  assert.match(body, /name="symptom_text"\r\n\r\ndry leaves/);
  assert.match(body, /name="plant_id"\r\n\r\n42/);
  assert.match(body, /name="session_id"\r\n\r\n9/);
});

test('text-only diagnosis still works without a file', async () => {
  const { api, calls } = setup();
  await api.diagnosePlantPhoto(null, 'dry leaves');
  assert.doesNotMatch(calls[0].body.toString(), /filename=/);
  assert.match(calls[0].body.toString(), /dry leaves/);
});

test('PlantNet sends multiple photos with matching MIME types and organs', async () => {
  const { plantnet, calls } = setup();
  await plantnet.identifyPlant(['file:///leaf.png', 'file:///flower.heic'], ['leaf', 'flower']);
  const body = calls[0].body.toString();
  assert.equal((body.match(/name="images"/g) || []).length, 2);
  assert.match(body, /filename="leaf.png"\r\ncontent-type: image\/png/);
  assert.match(body, /filename="converted.jpg"\r\ncontent-type: image\/jpeg/);
  assert.match(body, /name="organs"\r\n\r\nleaf/);
  assert.match(body, /name="organs"\r\n\r\nflower/);
});

test('lost server connection does not incorrectly tell users to change their PC IP', async () => {
  const { api } = setup({ offline: true });
  for (const request of [
    () => api.getCharacterGeneration('test-job'),
    () => api.startCharacterGeneration({ uri: 'file:///photo.png' }),
  ]) {
    await assert.rejects(request(), (error) => {
      assert.match(error.message, /서버 연결이 끊겼어요/);
      assert.doesNotMatch(error.message, /PC IP/);
      return true;
    });
  }
});
