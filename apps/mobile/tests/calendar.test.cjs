const assert = require('node:assert/strict');
const { test } = require('node:test');
const { screen, nodes, deferred, flush } = require('./helpers/screen.cjs');

function setup() {
  let clock = new Date(2026, 8, 6, 12).getTime();
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } }
  const picker = deferred();
  const care = deferred();
  const app = screen('src/screens/CalendarScreen.tsx', {
    '../../constants/fonts': { Fonts: {}, FontSizes: {} },
    '../../constants/colors': { Colors: {}, GreenTint: {}, Paper: {}, Shadow: {} },
    '../../constants/spacing': { Spacing: {}, Radius: {} },
    '../../constants/layout': { screenContent: {} },
    '../components/ScreenHeader': { __esModule: true, default: 'ScreenHeader' },
    '../components/ActionButton': { __esModule: true, default: 'ActionButton' },
    '../data/plants': { plantImages: {} },
    '../api': { getCareRecords: () => care.promise, getDiaryMonth: async () => [] },
    'expo-image-picker': { launchImageLibraryAsync: () => picker.promise },
  }, { Date: Clock });
  const props = { navigation: {}, route: { params: { openDiary: true } }, plants: [] };
  return { ...app, props, picker, care, advance: (ms) => { clock += ms; },
    render: (overrides = {}) => app.render({ ...props, ...overrides }),
  };
}

test('opening the diary after midnight uses the current date, not module import time', () => {
  const app = setup();
  app.advance(24 * 60 * 60 * 1000);
  const labels = nodes(app.render()).filter((n) => n.type === 'Text').map((n) => n.props.children);
  assert.ok(labels.includes('7일 월요일'));
});

test('calendar date refresh timer is cleared when leaving the screen', () => {
  const app = setup();
  app.render();
  assert.equal(app.timers.size, 1);
  app.dispose();
  assert.equal(app.timers.size, 0);
});

test('a photo selected for an earlier day cannot fill a different day', async () => {
  const app = setup();
  app.render();
  await flush();
  const firstFrame = nodes(app.render()).find((n) => n.type?.name === 'PhotoFrame');
  const pending = firstFrame.props.onPress();
  const nextDay = nodes(app.render()).find((n) => n.type === 'TouchableOpacity'
    && nodes(n).some((child) => child.type === 'Text' && child.props.children === 7));
  nextDay.props.onPress();
  app.picker.resolve({ canceled: false, assets: [{ uri: 'file:///day6.jpg' }] });
  await pending;
  const frames = nodes(app.render()).filter((n) => n.type?.name === 'PhotoFrame');
  assert.ok(frames.every((n) => n.props.uri === null));
});

test('calendar photo selection still fills the selected day', async () => {
  const app = setup();
  app.render();
  await flush();
  const frame = nodes(app.render()).find((n) => n.type?.name === 'PhotoFrame');
  const pending = frame.props.onPress();
  app.picker.resolve({ canceled: false, assets: [{ uri: 'file:///day6.jpg' }] });
  await pending;
  assert.equal(nodes(app.render()).find((n) => n.type?.name === 'PhotoFrame').props.uri, 'file:///day6.jpg');
});

test('a photo picker failure shows a recoverable alert', async () => {
  const app = setup();
  app.render();
  await flush();
  const pending = nodes(app.render()).find((n) => n.type?.name === 'PhotoFrame').props.onPress();
  app.picker.reject(new Error('permission denied'));
  await pending;
  assert.equal(app.alerts[0][0], '사진 선택 실패');
});

test('removing the last plant during a care request cannot leave a loading spinner', async () => {
  const app = setup();
  const plants = [{ id: '1', name: 'plant' }];
  app.render({ plants });
  await flush();
  assert.ok(nodes(app.render({ plants })).some((n) => n.type === 'ActivityIndicator'));
  app.render();
  assert.ok(!nodes(app.render()).some((n) => n.type === 'ActivityIndicator'));
  app.care.resolve([]);
  await flush();
});
