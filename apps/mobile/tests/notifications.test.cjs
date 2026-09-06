const assert = require('node:assert/strict');
const { test } = require('node:test');
const { screen } = require('./helpers/screen.cjs');

function setup(platform, enabled = true) {
  const calls = [];
  const notifications = {
    setNotificationHandler() {},
    AndroidImportance: { DEFAULT: 3 },
    SchedulableTriggerInputTypes: { DATE: 'date' },
    setNotificationChannelAsync: async (id) => calls.push(['channel', id]),
    getPermissionsAsync: async () => ({ granted: false, canAskAgain: true }),
    requestPermissionsAsync: async () => { calls.push(['permission']); return { granted: true }; },
    cancelScheduledNotificationAsync: async (id) => calls.push(['cancel', id]),
    scheduleNotificationAsync: async (request) => calls.push(['schedule', request]),
  };
  const app = screen('src/notifications.ts', {
    'react-native': { Platform: { OS: platform } },
    'expo-notifications': notifications,
    './api': {},
    './notificationSettings': { loadNotificationSettings: async () => ({ enabled, hour: 9, minute: 30 }) },
  });
  return { calls, api: app.exports };
}

test('Android creates its channel before permission and attaches it to the trigger', async () => {
  const { api, calls } = setup('android');
  assert.equal(await api.scheduleWateringReminder(42, 'plant', '2099-01-01'), true);
  assert.ok(calls.findIndex(([kind]) => kind === 'channel') < calls.findIndex(([kind]) => kind === 'permission'));
  const request = calls.find(([kind]) => kind === 'schedule')[1];
  assert.equal(request.trigger.channelId, 'watering');
  assert.equal(request.content.channelId, undefined);
  assert.equal(request.identifier, 'watering-42');
  assert.equal(request.content.data.plantId, '42');
});

test('iOS reminders remain date based without an Android channel', async () => {
  const { api, calls } = setup('ios');
  await api.scheduleWateringReminder(42, 'plant', '2099-01-01');
  assert.ok(!calls.some(([kind]) => kind === 'channel'));
  const request = calls.find(([kind]) => kind === 'schedule')[1];
  assert.equal(request.trigger.type, 'date');
  assert.equal(request.trigger.channelId, undefined);
  assert.equal(request.trigger.date.getHours(), 9);
  assert.equal(request.trigger.date.getMinutes(), 30);
});

test('disabled reminders only cancel the previous schedule', async () => {
  const { api, calls } = setup('android', false);
  assert.equal(await api.scheduleWateringReminder(42, 'plant', '2099-01-01'), false);
  assert.deepEqual(calls, [['cancel', 'watering-42']]);
});
