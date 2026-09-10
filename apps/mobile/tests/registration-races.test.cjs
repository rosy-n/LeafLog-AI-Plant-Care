const assert = require('node:assert/strict');
const { test } = require('node:test');
const { screen, nodes, deferred, flush } = require('./helpers/screen.cjs');

function setupSearch() {
  const requests = [];
  const navigation = [];
  const updates = [];
  const draft = { capturedPhotoUri: 'file:///character-photo.jpg', generationJobId: 'job-1' };
  const app = screen('app/add-plant/index.tsx', {
    '../../constants/colors': { Colors: {} },
    './styles/index.styles': { styles: {} },
    '../../src/hooks/useAddPlantRouter': { useRouter: () => ({ push: (to) => navigation.push(to) }) },
    '../../src/AddPlantFlowContext': { useAddPlantFlow: () => ({ draft, updateDraft(patch) { updates.push(patch); Object.assign(draft, patch); } }) },
    'expo-image-picker': {},
    '../../src/api': { searchSpecies(query) {
      const request = { query, ...deferred() };
      requests.push(request);
      return request.promise;
    } },
  });
  return { ...app, requests, navigation, updates, draft,
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

function setupCharacter(resume = false, availability = async () => ({ enabled: true, message: null })) {
  const job = deferred();
  const polls = [];
  const progress = [];
  const navigation = [];
  const updates = [];
  const uploads = [];
  const draft = { capturedPhotoUri: null, generationJobId: resume ? 'job-1' : null };
  const app = screen('app/add-plant/character.tsx', {
    '../../constants/colors': { Colors: {} },
    './styles/character.styles': { styles: {} },
    './styles/common.styles': { common: {} },
    '../../src/hooks/useAddPlantRouter': {
      useRouter: () => ({ push: (path) => navigation.push(path), replace: (path) => navigation.push(path) }),
      useLocalSearchParams: () => resume ? { resumeGeneration: 'true' } : {},
    },
    '../../src/AddPlantFlowContext': {
      useAddPlantFlow: () => ({ draft, updateDraft: (v) => { updates.push(v); Object.assign(draft, v); } }),
    },
    '../../src/components/PlantImage': { __esModule: true, default: 'PlantImage' },
    '../../src/data/characterExpressions': { hasFaceRemovedChecksum: () => false },
    '../../src/api': {
      getCharacterGenerationAvailability: availability,
      startCharacterGeneration: (photo) => { uploads.push(photo); return job.promise; },
      getCharacterGeneration: () => {
        const request = polls.length === 0 ? job : deferred();
        polls.push(request);
        return request.promise;
      },
    },
    'expo-image-picker': {
      requestCameraPermissionsAsync: async () => ({ status: 'granted' }),
      launchCameraAsync: async () => ({ canceled: false, assets: [{ uri: 'file:///plant.jpg' }] }),
    },
  });
  app.native.Animated.timing = (_value, options) => ({ start() { progress.push(options.toValue); } });
  async function begin() {
    function button(label) {
      return nodes(app.render()).find((n) => n.type === 'TouchableOpacity'
        && nodes(n).some((child) => child.type === 'Text' && child.props.children === label));
    }
    button('사진 촬영 가이드').props.onPress();
    await button('사진 촬영 시작').props.onPress();
    const choice = app.alerts.at(-1)[2].find((b) => b.text === '카메라로 찍기');
    await choice.onPress();
    return button('캐릭터 만들기').props.onPress();
  }
  return { ...app, begin, job, navigation, updates, polls, progress, uploads, draft };
}

test('paused generation prevents taking a photo or uploading and can be checked again', async () => {
  let enabled = false;
  const app = setupCharacter(false, async () => ({ enabled, message: 'Temporarily unavailable' }));
  const button = (label) => nodes(app.render()).find((n) => n.type === 'TouchableOpacity'
    && nodes(n).some((child) => child.type === 'Text' && child.props.children === label));
  button('사진 촬영 가이드').props.onPress();
  await button('사진 촬영 시작').props.onPress();
  assert.equal(app.alerts.length, 0);
  assert.equal(app.uploads.length, 0);
  assert.equal(app.updates.length, 0);
  assert.equal(app.navigation.length, 0);
  assert.ok(nodes(app.render()).some((n) => n.type === 'Text' && n.props.children === 'Temporarily unavailable'));
  enabled = true;
  await button('다시 확인').props.onPress();
  assert.equal(app.alerts.at(-1)[0], '사진 선택');
  app.dispose();
});

test('an availability response cannot open the camera picker after leaving', async () => {
  const availability = deferred();
  const app = setupCharacter(false, () => availability.promise);
  const button = (label) => nodes(app.render()).find((n) => n.type === 'TouchableOpacity'
    && nodes(n).some((child) => child.type === 'Text' && child.props.children === label));
  button('사진 촬영 가이드').props.onPress();
  const pending = button('사진 촬영 시작').props.onPress();
  app.blur();
  availability.resolve({ enabled: true, message: null });
  await pending;
  assert.equal(app.alerts.length, 0);
  app.dispose();
});

test('an availability error stays on the guide instead of starting an upload', async () => {
  const app = setupCharacter(false, async () => { throw new Error('offline'); });
  const button = (label) => nodes(app.render()).find((n) => n.type === 'TouchableOpacity'
    && nodes(n).some((child) => child.type === 'Text' && child.props.children === label));
  button('사진 촬영 가이드').props.onPress();
  await button('사진 촬영 시작').props.onPress();
  assert.equal(app.uploads.length, 0);
  assert.equal(app.alerts.length, 0);
  assert.ok(button('다시 확인'));
  app.dispose();
});

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

test('accepting a photo generation job advances to species selection without waiting for candidates', async () => {
  const app = setupCharacter();
  const pending = app.begin();
  await flush();
  app.job.resolve({ id: 'job-1', message: 'queued' });
  await pending;
  assert.deepEqual(app.navigation, ['/add-plant']);
  assert.equal(app.updates[0].generationJobId, 'job-1');
  assert.equal(app.updates[0].capturedPhotoUri, 'file:///plant.jpg');
});

test('returning to the first photo step reuses the job instead of generating again', async () => {
  const app = setupCharacter();
  const pending = app.begin();
  await flush();
  app.job.resolve({ id: 'job-1', status: 'queued', message: 'queued' });
  await pending;
  app.render();
  app.blur();
  app.focus();
  const next = nodes(app.render()).find((n) => n.type === 'TouchableOpacity'
    && nodes(n).some((child) => child.type === 'Text' && child.props.children === '다음'));
  assert.ok(next);
  await next.props.onPress();
  assert.equal(app.uploads.length, 1);
  assert.equal(app.polls.length, 0);
  assert.equal(app.draft.generationJobId, 'job-1');
  app.dispose();
});

test('even an already completed generation job still goes to species selection first', async () => {
  const app = setupCharacter();
  const pending = app.begin();
  await flush();
  app.job.resolve({ id: 'job-1', status: 'completed', progress: 100, candidates: [] });
  await pending;
  assert.deepEqual(app.navigation, ['/add-plant']);
  assert.equal(app.polls.length, 0);
  app.dispose();
});

test('species identification can reuse the character photo without clearing the generation job', () => {
  const app = setupSearch();
  const photoButton = nodes(app.render()).find((n) => n.type === 'TouchableOpacity'
    && nodes(n).some((child) => child.type === 'Text' && child.props.children === '사진으로 찾기'));
  photoButton.props.onPress();
  const reuse = app.alerts.at(-1)[2].find((choice) => choice.text === '방금 선택한 사진 사용');
  reuse.onPress();
  assert.equal(app.navigation[0].pathname, '/add-plant/organ-select');
  assert.deepEqual(JSON.parse(app.navigation[0].params.photoUris), ['file:///character-photo.jpg']);
  assert.equal(app.draft.generationJobId, 'job-1');
  assert.equal(app.draft.identificationPhotoUri, app.draft.capturedPhotoUri);
  app.dispose();
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

test('photo identification choices keep camera, library and cancel available within the Android limit', () => {
  const app = setupSearch();
  const photoButton = nodes(app.render()).find((n) => n.type === 'TouchableOpacity'
    && nodes(n).some((child) => child.type === 'Text' && child.props.children === '사진으로 찾기'));
  photoButton.props.onPress();
  const choices = app.alerts.at(-1)[2];
  assert.equal(choices.length, 3);
  choices.find((choice) => choice.text === '다른 사진 선택').onPress();
  assert.deepEqual(Array.from(app.alerts.at(-1)[2], (choice) => choice.text),
    ['사진 라이브러리에서 선택', '카메라로 찍기', '취소']);
  assert.equal(app.navigation.length, 0);
  assert.equal(app.draft.generationJobId, 'job-1');
  app.dispose();
});

test('generation progress follows polling but never goes backwards on retry', async () => {
  const app = setupCharacter(true);
  app.render();
  app.job.resolve({ id: 'job-1', status: 'generating', progress: 38, message: 'sampling' });
  await flush();
  assert.equal(app.progress.at(-1), .38);
  app.runTimer(2000);
  await flush();
  app.polls[1].resolve({ id: 'job-1', status: 'generating', progress: 20, message: 'retry' });
  await flush();
  assert.equal(app.progress.at(-1), .38);
  assert.ok(nodes(app.render()).some((n) => n.type === 'ActivityIndicator'));
  app.runTimer(2000);
  await flush();
  app.polls[2].resolve({ id: 'job-1', status: 'postprocessing', progress: 95, message: 'finishing' });
  await flush();
  assert.equal(app.progress.at(-1), .95);
  app.dispose();
});

test('unfinished work cannot display 100 percent and completion opens candidates', async () => {
  const app = setupCharacter(true);
  app.render();
  app.job.resolve({ id: 'job-1', status: 'postprocessing', progress: 100, message: 'finishing' });
  await flush();
  assert.equal(app.progress.at(-1), .99);
  assert.ok(!nodes(app.render()).some((n) => n.props.accessibilityRole === 'radio'));
  app.runTimer(2000);
  await flush();
  app.polls[1].resolve({ id: 'job-1', status: 'completed', progress: 100,
    candidates: [1, 2, 3].map((id) => ({ id: String(id), image_url: `https://example.test/${id}.png` })) });
  await flush();
  assert.equal(app.progress.at(-1), 1);
  assert.equal(nodes(app.render()).filter((n) => n.props.accessibilityRole === 'radio').length, 3);
  assert.equal(app.timers.size, 0);
  app.dispose();
});

test('late poll after leaving cannot update progress or open the result', async () => {
  const app = setupCharacter(true);
  app.render();
  app.job.resolve({ id: 'job-1', status: 'generating', progress: 50, message: 'sampling' });
  await flush();
  app.runTimer(2000);
  await flush();
  app.blur();
  app.polls[1].resolve({ id: 'job-1', status: 'completed', progress: 100, candidates: [] });
  await flush();
  assert.equal(app.progress.at(-1), .5);
  assert.equal(app.alerts.length, 0);
  app.dispose();
});
