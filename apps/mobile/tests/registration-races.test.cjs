const assert = require('node:assert/strict');
const { test } = require('node:test');
const { screen, nodes, deferred, flush } = require('./helpers/screen.cjs');

function setupSearch() {
  const requests = [];
  const app = screen('app/add-plant/index.tsx', {
    '../../constants/colors': { Colors: {} },
    './styles/index.styles': { styles: {} },
    '../../src/hooks/useAddPlantRouter': { useRouter: () => ({ push() {} }) },
    '../../src/AddPlantFlowContext': { useAddPlantFlow: () => ({ updateDraft() {} }) },
    'expo-image-picker': {},
    '../../src/api': { searchSpecies(query) {
      const request = { query, ...deferred() };
      requests.push(request);
      return request.promise;
    } },
  });
  return { ...app, requests,
    input: () => nodes(app.render()).find((n) => n.type === 'TextInput').props,
    labels: () => nodes(app.render()).filter((n) => n.type === 'Text').map((n) => n.props.children).flat(),
  };
}
const row = (name, id) => ({ species_id: id, common_name_ko: name });

test('a slow old species search cannot replace newer results', async () => {
  const app = setupSearch();
  app.input().onChangeText('old');
  const first = app.runTimer(500);
  app.input().onChangeText('new');
  const second = app.runTimer(500);
  app.requests[1].resolve([row('new result', 2)]);
  await second;
  app.requests[0].resolve([row('old result', 1)]);
  await first;
  assert.ok(app.labels().includes('new result'));
  assert.ok(!app.labels().includes('old result'));
});

test('clearing a search invalidates old results before the next debounce fires', async () => {
  const app = setupSearch();
  app.input().onChangeText('old');
  const first = app.runTimer(500);
  app.input().onChangeText('');
  app.input().onChangeText('new');
  app.requests[0].resolve([row('old result', 1)]);
  await first;
  assert.ok(!app.labels().includes('old result'));
});

test('leaving the search screen clears its pending request timer', () => {
  const app = setupSearch();
  app.input().onChangeText('plant');
  app.dispose();
  assert.equal(app.timers.size, 0);
});

test('an old search failure does not show an alert after leaving the screen', async () => {
  const app = setupSearch();
  app.input().onChangeText('plant');
  const pending = app.runTimer(500);
  app.dispose();
  app.requests[0].reject(new Error('offline'));
  await pending;
  assert.equal(app.alerts.length, 0);
});

test('cancelling search clears the pending debounce and loading indicator', () => {
  const app = setupSearch();
  app.input().onFocus();
  app.input().onChangeText('plant');
  const cancel = nodes(app.render()).find((n) => n.type === 'TouchableOpacity'
    && nodes(n).some((child) => child.type === 'Text' && child.props.children === '취소'));
  cancel.props.onPress();
  assert.equal(app.timers.size, 0);
  assert.equal(app.input().value, '');
  assert.ok(!nodes(app.render()).some((n) => n.type === 'ActivityIndicator'));
});

function setupCharacter(resume = false) {
  const job = deferred();
  const navigation = [];
  const updates = [];
  const app = screen('app/add-plant/character.tsx', {
    '../../constants/colors': { Colors: {} },
    './styles/character.styles': { styles: {} },
    './styles/common.styles': { common: {} },
    '../../src/hooks/useAddPlantRouter': {
      useRouter: () => ({ replace: (path) => navigation.push(path) }),
      useLocalSearchParams: () => resume ? { resumeGeneration: 'true' } : {},
    },
    '../../src/AddPlantFlowContext': {
      useAddPlantFlow: () => ({ draft: { capturedPhotoUri: null, generationJobId: resume ? 'job-1' : null }, updateDraft: (v) => updates.push(v) }),
    },
    '../../src/components/PlantImage': { __esModule: true, default: 'PlantImage' },
    '../../src/data/characterExpressions': { hasFaceRemovedChecksum: () => false },
    '../../src/api': { startCharacterGeneration: () => job.promise, getCharacterGeneration: () => job.promise },
    'expo-image-picker': {
      requestCameraPermissionsAsync: async () => ({ status: 'granted' }),
      launchCameraAsync: async () => ({ canceled: false, assets: [{ uri: 'file:///plant.jpg' }] }),
    },
  });
  async function begin() {
    function button(label) {
      return nodes(app.render()).find((n) => n.type === 'TouchableOpacity'
        && nodes(n).some((child) => child.type === 'Text' && child.props.children === label));
    }
    button('사진 촬영 가이드').props.onPress();
    button('사진 촬영 시작').props.onPress();
    const choice = app.alerts.at(-1)[2].find((b) => b.text === '카메라로 찍기');
    await choice.onPress();
    return button('캐릭터 만들기').props.onPress();
  }
  return { ...app, begin, job, navigation, updates };
}

test('a generation response after leaving cannot change the draft or navigate', async () => {
  const app = setupCharacter();
  const pending = app.begin();
  await flush();
  app.dispose();
  app.job.resolve({ id: 'job-1', message: 'queued' });
  await pending;
  assert.equal(app.navigation.length, 0);
  assert.equal(app.updates.length, 0);
});

test('a generation upload failure after leaving does not open an error alert', async () => {
  const app = setupCharacter();
  const pending = app.begin();
  await flush();
  app.dispose();
  const previousAlerts = app.alerts.length;
  app.job.reject(new Error('offline'));
  await pending;
  assert.equal(app.alerts.length, previousAlerts);
});

test('successful generation still advances to plant information with its job ID', async () => {
  const app = setupCharacter();
  const pending = app.begin();
  await flush();
  app.job.resolve({ id: 'job-1', message: 'queued' });
  await pending;
  assert.deepEqual(app.navigation, ['/add-plant/info']);
  assert.equal(app.updates[0].generationJobId, 'job-1');
  assert.equal(app.updates[0].capturedPhotoUri, 'file:///plant.jpg');
});

test('back navigation from the name screen keeps the selected completed character', async () => {
  const app = setupCharacter(true);
  app.render();
  app.job.resolve({ id: 'job-1', status: 'completed', progress: 100,
    candidates: [1, 2, 3].map((id) => ({ id: String(id), image_url: `https://example.test/${id}.png` })) });
  await flush();
  const first = nodes(app.render()).find((n) => n.props.accessibilityRole === 'radio');
  first.props.onPress();
  app.render();
  app.blur();
  app.focus();
  const chosen = nodes(app.render()).filter((n) => n.props.accessibilityRole === 'radio'
    && n.props.accessibilityState.selected);
  assert.equal(chosen.length, 1);
  assert.equal(chosen[0].props.accessibilityLabel, '1번 도트 캐릭터');
});
