const assert = require('node:assert/strict');
const { test } = require('node:test');
const { screen, nodes, deferred, flush } = require('./helpers/screen.cjs');

function button(app, label) {
  return nodes(app.render()).find((node) => node.type === 'TouchableOpacity'
    && nodes(node).some((child) => child.type === 'Text' && child.props.children === label));
}

test('registration starts with the photo step and header steps follow the new order', () => {
  let routeName = 'Character';
  const imports = {
    '@react-navigation/native-stack': { createNativeStackNavigator: () => ({ Navigator: 'Navigator', Screen: 'Screen' }) },
    '@react-navigation/native': { useNavigation: () => ({ goBack() {} }), useRoute: () => ({ name: routeName }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../AddPlantFlowContext': { AddPlantFlowProvider: 'FlowProvider' },
    '../components/BackButton': { __esModule: true, default: 'BackButton' },
    '../../constants/colors': { Colors: {} },
    '../../constants/spacing': { Spacing: {}, Radius: {} },
    '../../constants/fonts': { Fonts: {}, FontSizes: {} },
  };
  for (const name of ['index', 'organ-select', 'analyzing', 'plant-results', 'plant-detail', 'character', 'name', 'info', 'persona']) {
    imports[`../../app/add-plant/${name}`] = { __esModule: true, default: name };
  }
  const app = screen('src/screens/AddPlantNavigator.jsx', imports);
  const navigator = nodes(app.render()).find((node) => node.type === 'Navigator');
  assert.equal(navigator.props.initialRouteName, 'Character');
  for (const [name, step] of [['Character', 1], ['AddPlantIndex', 2], ['Analyzing', 2], ['AddPlantPlantDetail', 2], ['Info', 3], ['CharacterResult', 4], ['Name', 5]]) {
    routeName = name;
    const header = navigator.props.screenOptions.header();
    const label = nodes(header.type()).find((node) => node.type === 'Text');
    assert.equal([label.props.children].flat().join(''), `${step}/5`);
  }
  app.dispose();
});

test('confirming a species goes directly to details and preserves the photo generation job', async () => {
  const navigation = [];
  const draft = { generationJobId: 'job-1', capturedPhotoUri: 'file:///plant.jpg' };
  const app = screen('app/add-plant/plant-detail.tsx', {
    './styles/plant-detail.styles': { styles: {} },
    '../../src/hooks/useAddPlantRouter': {
      useRouter: () => ({ push: (to) => navigation.push(to) }),
      useLocalSearchParams: () => ({ speciesId: '12', commonNameKo: 'test species' }),
    },
    '../../src/AddPlantFlowContext': { useAddPlantFlow: () => ({ draft, updateDraft: (patch) => Object.assign(draft, patch) }) },
    '../../src/api': { getSpecies: async () => ({ common_name_ko: 'test species', scientific_name: 'Test plant' }) },
  });
  app.render();
  await flush();
  button(app, '네').props.onPress();
  assert.equal(navigation[0].pathname, '/add-plant/info');
  assert.equal(draft.speciesId, 12);
  assert.equal(draft.generationJobId, 'job-1');
  assert.equal(draft.capturedPhotoUri, 'file:///plant.jpg');
  app.dispose();
});

test('details stay editable until Next and then open the existing job result', async () => {
  const navigation = [];
  const draft = { generationJobId: 'completed-job', commonNameKo: 'test species' };
  const app = screen('app/add-plant/info.tsx', {
    '../../constants/colors': { Colors: {} },
    './styles/info.styles': { styles: {} },
    '../../src/hooks/useAddPlantRouter': { useRouter: () => ({ push: (to) => navigation.push(to) }) },
    '../../src/AddPlantFlowContext': { useAddPlantFlow: () => ({ draft, updateDraft: (patch) => Object.assign(draft, patch) }) },
  });
  assert.equal(button(app, '다음').props.disabled, true);
  button(app, '거실').props.onPress();
  button(app, '밝은 간접광').props.onPress();
  await flush();
  assert.equal(navigation.length, 0);
  assert.equal(button(app, '다음').props.disabled, false);
  button(app, '다음').props.onPress();
  assert.equal(draft.info.location, 'LIVING_ROOM');
  assert.equal(draft.info.lightLevel, 'BRIGHT');
  assert.equal(draft.generationJobId, 'completed-job');
  assert.equal(navigation[0].pathname, '/add-plant/character-result');
  assert.equal(navigation[0].params.resumeGeneration, 'true');
  app.dispose();
});

function analyzing() {
  const request = deferred();
  const navigation = [];
  const app = screen('app/add-plant/analyzing.tsx', {
    './styles/common.styles': { common: {} },
    './styles/analyzing.styles': { styles: {} },
    '../../src/hooks/useAddPlantRouter': {
      useRouter: () => ({ replace: (to) => navigation.push(to) }),
      useLocalSearchParams: () => ({ photoUris: '[]', organs: '[]' }),
    },
    '../../services/plantnet': { identifyPlant: () => request.promise },
  }, { setInterval: () => 1, clearInterval() {}, console: { error() {} } });
  app.native.Animated.Value = class { stopAnimation() {} interpolate() { return 0; } };
  app.native.Animated.timing = () => ({ start: (done) => done?.() });
  return { ...app, request, navigation };
}

test('identification errors lead to the search fallback, not to restarting character generation', async () => {
  const app = analyzing();
  app.render();
  app.request.reject(new Error('identification unavailable'));
  await flush();
  app.runTimer(400);
  assert.equal(app.navigation[0].pathname, '/add-plant/plant-results');
  assert.equal(app.navigation[0].params.results, '[]');
  assert.equal(app.navigation[0].params.errorMsg, 'identification unavailable');
  app.dispose();

  const navigation = [];
  const results = screen('app/add-plant/plant-results.tsx', {
    './styles/common.styles': { common: {} },
    './styles/plant-results.styles': { styles: {} },
    '../../src/api': {},
    '../../src/hooks/useAddPlantRouter': {
      useRouter: () => ({ replace: (to) => navigation.push(to) }),
      useLocalSearchParams: () => ({ results: '[]', photoUris: '[]' }),
    },
  });
  button(results, '식물 다시 찾기').props.onPress();
  assert.deepEqual(navigation, ['/add-plant']);
  results.dispose();
});

test('an identification response cannot navigate after leaving that screen', async () => {
  const app = analyzing();
  app.render();
  app.dispose();
  app.request.resolve([]);
  await flush();
  assert.equal(app.navigation.length, 0);
  assert.equal(app.timers.size, 0);
});

test('leaving after identification but before its transition cancels that transition', async () => {
  const app = analyzing();
  app.render();
  app.request.resolve([]);
  await flush();
  assert.equal(app.timers.size, 1);
  app.dispose();
  assert.equal(app.timers.size, 0);
  assert.equal(app.navigation.length, 0);
});
