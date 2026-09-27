const assert = require('node:assert/strict');
const { test } = require('node:test');
const { screen, deferred, flush } = require('./helpers/screen.cjs');

function provider(options = {}) {
  const saved = [], notifications = [], requests = [];
  const scope = options.scope ?? 'https://api.test|1';
  const app = screen('src/AddPlantFlowContext.tsx', {
    './api': { getCharacterGeneration: (id, signal) => {
      const response = deferred(); requests.push({ id, signal, ...response }); return response.promise;
    } },
    './notifications': { notifyCharacterGenerationReady: async (...args) => {
      if (options.notificationFailure) throw new Error('notifications unavailable');
      notifications.push(args);
    } },
    './registrationStorage': {
      loadRegistrationDraft: (actual, initial) => {
        assert.equal(actual, scope);
        return options.restored ? { ...initial, ...options.restored } : null;
      },
      saveRegistrationDraft: (actual, draft) => {
        assert.equal(actual, scope); saved.push({ ...draft });
        if (options.saveFailure) throw new Error('disk full');
      },
    },
  });
  const value = () => app.render({ scope }, 'AddPlantFlowProvider').props.value;
  return { ...app, value, saved, notifications, requests };
}

test('background completion keeps an explicitly preserved navigation exit', async () => {
  const app = provider();
  app.value().updateDraft({ generationJobId: 'job-1' });
  app.value().backgroundGeneration();
  app.value();
  app.requests[0].resolve({ id: 'job-1', status: 'completed' });
  await flush();
  assert.equal(app.value().draft.generationBackgrounded, false);
  assert.equal(app.value().consumePreservedExit(), true);
  assert.equal(app.value().consumePreservedExit(), false);
  assert.equal(app.value().draft.generationJobId, 'job-1');
  assert.equal(app.saved.at(-1).notifiedJobId, 'job-1');
  assert.equal(app.notifications[0][1].jobId, 'job-1');
  app.dispose();
});

test('more than five network failures back off and still detect completion', async () => {
  const app = provider({ restored: { generationJobId: 'job-1', generationBackgrounded: true } });
  app.value();
  for (const delay of [4000, 8000, 16000, 30000, 30000, 30000]) {
    app.requests.at(-1).reject(new Error('offline'));
    await flush();
    assert.equal(app.value().draft.generationBackgrounded, true);
    app.runTimer(delay);
  }
  app.requests.at(-1).resolve({ status: 'completed' });
  await flush();
  assert.equal(app.notifications.length, 1);
  assert.equal(app.value().draft.notifiedJobId, 'job-1');
  app.dispose();
});

test('app suspension aborts polling and foreground return checks immediately', async () => {
  const app = provider({ restored: { generationJobId: 'job-1', generationBackgrounded: true } });
  app.value();
  const old = app.requests[0];
  app.setAppState('background');
  assert.equal(old.signal.aborted, true);
  old.resolve({ status: 'completed' });
  await flush();
  assert.equal(app.notifications.length, 0);
  assert.equal(app.timers.size, 0);
  app.setAppState('active');
  assert.equal(app.requests.length, 2);
  app.requests[1].resolve({ status: 'completed' });
  await flush();
  assert.equal(app.notifications.length, 1);
  app.dispose();
});

test('late results after cancellation cannot notify or restore the removed draft', async () => {
  const app = provider({ restored: { generationJobId: 'job-1', generationBackgrounded: true } });
  app.value().resetDraft();
  app.value();
  app.requests[0].resolve({ status: 'completed' });
  await flush();
  assert.equal(app.notifications.length, 0);
  assert.equal(app.saved.at(-1).generationJobId, null);
  app.dispose();
});

test('a missing or forbidden job stops polling with a visible explanation', async () => {
  const app = provider({ restored: { generationJobId: 'job-1', generationBackgrounded: true } });
  app.value();
  app.requests[0].reject(Object.assign(new Error('gone'), { status: 404 }));
  await flush();
  assert.equal(app.value().draft.generationBackgrounded, false);
  assert.equal(app.alerts.length, 1);
  assert.equal(app.timers.size, 0);
  app.dispose();
});

test('failed local storage warns once but keeps the live registration', () => {
  const app = provider({ saveFailure: true });
  app.value().updateDraft({ generationJobId: 'job-1' });
  app.value().updateDraft({ nickname: 'plant' });
  assert.equal(app.value().draft.generationJobId, 'job-1');
  assert.equal(app.alerts.length, 1);
  app.dispose();
});

test('leaving mid-form preserves the accepted job, while finish and explicit cancel clear it', () => {
  const app = provider();
  app.value().updateDraft({ generationJobId: 'job-1', commonNameKo: 'plant', infoInput: { soilNote: 'half typed' } });
  app.value().handleRegistrationExit();
  assert.equal(app.value().draft.generationBackgrounded, true);
  assert.equal(app.value().draft.infoInput.soilNote, 'half typed');
  app.value().updateDraft({ createdPlantId: 9 });
  app.value().handleRegistrationExit();
  assert.equal(app.value().draft.generationJobId, null);
  app.value().updateDraft({ generationJobId: 'job-2' });
  app.value().cancelGeneration();
  app.value().handleRegistrationExit();
  assert.equal(app.value().draft.generationJobId, null);
  app.dispose();
});

test('a new job clears old completion and rejects old poll reports', () => {
  const app = provider();
  app.value().updateDraft({ generationJobId: 'job-1' });
  app.value().updateDraft({ generationOutcome: 'completed', notifiedJobId: 'job-1' });
  app.value().reportGeneration({ jobId: 'job-1', status: 'completed', progress: 100, message: '' });
  app.value().updateDraft({ generationJobId: 'job-2' });
  assert.equal(app.value().draft.generationOutcome, null);
  assert.equal(app.value().draft.notifiedJobId, null);
  assert.equal(app.value().generation, null);
  app.value().reportGeneration({ jobId: 'job-1', status: 'completed', progress: 100, message: '' });
  assert.equal(app.value().generation, null);
  app.dispose();
});

test('notification failures cannot hide a completed result or cause endless polling', async () => {
  const app = provider({ notificationFailure: true, restored: { generationJobId: 'job-1', generationBackgrounded: true } });
  app.value();
  app.requests[0].resolve({ status: 'completed', progress: 100 });
  await flush();
  assert.equal(app.value().draft.generationOutcome, 'completed');
  assert.equal(app.value().draft.generationBackgrounded, false);
  assert.equal(app.timers.size, 0);
  app.dispose();
});

function storage() {
  const files = new Map();
  class Directory { constructor() { this.exists = true; } }
  class File {
    constructor(_dir, name) { this.name = name; }
    get exists() { return files.has(this.name); }
    get size() { return files.get(this.name)?.length ?? 0; }
    textSync() { return files.get(this.name); }
    write(text) { files.set(this.name, text); }
    delete() { files.delete(this.name); }
  }
  const app = screen('src/registrationStorage.ts', {
    'expo-file-system': { Directory, File, Paths: { document: 'document' } },
  });
  const context = provider();
  const initial = context.value().draft;
  context.dispose();
  return { files, api: app.exports, initial };
}

test('restart restores only the same account and server without signed result URLs', () => {
  const { api, initial } = storage();
  const scope = 'https://api.test|1';
  api.saveRegistrationDraft(scope, { ...initial, generationJobId: 'job-1', commonNameKo: 'plant',
    capturedPhotoUri: 'file:///photo.jpg', characterImageUrl: 'https://s3.test/?secret=expired',
    speciesImageUrl: 'https://species.test/?signature=expired' });
  const restored = api.loadRegistrationDraft(scope, initial);
  assert.equal(restored.generationJobId, 'job-1');
  assert.equal(restored.generationBackgrounded, true);
  assert.equal(restored.characterImageUrl, null);
  assert.equal(restored.speciesImageUrl, null);
  assert.equal(api.loadRegistrationDraft('https://api.test|2', initial), null);
  assert.equal(api.loadRegistrationDraft('https://another.test|1', initial), null);
  api.saveRegistrationDraft(scope, initial);
  assert.equal(api.loadRegistrationDraft(scope, initial), null);
});

test('corrupt or expired drafts are ignored and finished notifications do not repeat', () => {
  const { api, initial, files } = storage();
  api.saveRegistrationDraft('scope', { ...initial, generationJobId: 'job-1', notifiedJobId: 'job-1', generationOutcome: 'completed' });
  assert.equal(api.loadRegistrationDraft('scope', initial).generationBackgrounded, false);
  const [key, serialized] = [...files][0];
  const expired = JSON.parse(serialized);
  expired.savedAt = 0;
  files.set(key, JSON.stringify(expired));
  assert.equal(api.loadRegistrationDraft('scope', initial), null);
  files.set(key, '{invalid');
  assert.equal(api.loadRegistrationDraft('scope', initial), null);
});

test('resume goes to the first unfinished step and refetches the result before selection', () => {
  const { api, initial } = storage();
  assert.equal(api.registrationResumeScreen(initial), 'Character');
  const draft = { ...initial, generationJobId: 'job-1' };
  assert.equal(api.registrationResumeScreen(draft), 'AddPlantIndex');
  draft.commonNameKo = 'plant';
  assert.equal(api.registrationResumeScreen(draft), 'Info');
  draft.info = {};
  assert.equal(api.registrationResumeScreen(draft), 'CharacterResult');
});

test('partial details survive restart without skipping the unfinished step', () => {
  const { api, initial } = storage();
  const infoInput = { location: '거실', lightLevel: null, potType: null, plantHeight: '25',
    potDiameter: '', soilNote: '분갈이흙', lastWatered: { month: 9, day: 27 }, lastRepotted: null };
  api.saveRegistrationDraft('scope', { ...initial, generationJobId: 'job-1', commonNameKo: 'plant', infoInput,
    generationOutcome: 'completed', nickname: 'unfinished' });
  const restored = api.loadRegistrationDraft('scope', initial);
  assert.equal(restored.infoInput.soilNote, '분갈이흙');
  assert.equal(restored.infoInput.lightLevel, null);
  assert.equal(restored.nickname, 'unfinished');
  assert.equal(api.registrationResumeScreen(restored), 'Info');
  api.saveRegistrationDraft('scope', { ...restored, createdPlantId: 7 });
  assert.equal(api.loadRegistrationDraft('scope', initial), null);
});

test('a result can be resumed days later but not beyond the local retention window', () => {
  const { api, initial, files } = storage();
  api.saveRegistrationDraft('scope', { ...initial, generationJobId: 'job-1', generationOutcome: 'completed' });
  const [key, value] = [...files][0];
  const stored = JSON.parse(value);
  stored.savedAt = Date.now() - 3 * 86400000;
  files.set(key, JSON.stringify(stored));
  assert.equal(api.loadRegistrationDraft('scope', initial).generationJobId, 'job-1');
  stored.savedAt = Date.now() - 8 * 86400000;
  files.set(key, JSON.stringify(stored));
  assert.equal(api.loadRegistrationDraft('scope', initial), null);
});

test('cold-start notification waits for navigation and ignores another account or job', async () => {
  const navigations = [], listeners = new Set();
  const response = (scope, jobId) => ({ notification: { request: {
    identifier: scope + jobId, content: { data: { kind: 'CHARACTER_READY', scope, jobId } },
  } } });
  const scope = 'https://api.test|1';
  const context = { scope, draft: { generationJobId: 'job-1', commonNameKo: 'plant', info: {} } };
  const app = screen('src/RegistrationNotificationListener.tsx', {
    './AddPlantFlowContext': { useAddPlantFlow: () => context },
    './registrationStorage': { registrationResumeScreen: () => 'CharacterResult' },
    'expo-notifications': {
      addNotificationResponseReceivedListener: fn => { listeners.add(fn); return { remove: () => listeners.delete(fn) }; },
      getLastNotificationResponseAsync: async () => response(scope, 'job-1'),
      clearLastNotificationResponseAsync: async () => {},
    },
  });
  const props = { ready: false, navigationRef: { current: { navigate: (...args) => navigations.push(args) } } };
  app.render(props);
  await flush();
  assert.equal(navigations.length, 0);
  props.ready = true;
  app.render(props);
  await flush();
  assert.equal(navigations.length, 1);
  for (const fn of listeners) {
    fn(response(scope, 'job-1'));
    fn(response(scope, 'older-job'));
    fn(response('another-account', 'job-1'));
  }
  assert.equal(navigations.length, 1);
  assert.equal(navigations[0][1].params.resumeGeneration, 'true');
  app.dispose();
  assert.equal(listeners.size, 0);
});
