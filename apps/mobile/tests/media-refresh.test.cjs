const assert = require('node:assert/strict');
const { test } = require('node:test');
const { screen, deferred, flush } = require('./helpers/screen.cjs');

const oldUrl = 'https://test-bucket.s3.ap-northeast-2.amazonaws.com/plant.png?X-Amz-Date=20260907T010000Z&X-Amz-Expires=3600';
const newUrl = 'https://test-bucket.s3.ap-northeast-2.amazonaws.com/plant.png?X-Amz-Date=20260907T020000Z&X-Amz-Expires=3600';
function setup(refreshMediaUrl = async () => ({ url: newUrl })) {
  let token = 'account-one';
  const app = screen('src/hooks/useMediaSource.js', {
    '../api': { getAuthToken: () => token, refreshMediaUrl },
  }, { URL });
  return { app, setToken(value) { token = value; } };
}

test('signed URL expiry is parsed; local and external images are untouched', () => {
  const { app } = setup();
  const expiry = app.exports.signedUrlExpiry;
  assert.equal(expiry(oldUrl), Date.UTC(2026, 8, 7, 2));
  for (const uri of [null, 1, 'file:///photo.png', 'https://elsewhere.test/photo.png',
    oldUrl.replace('https:', 'http:'), oldUrl.replace('20260907T010000Z', 'bad')]) {
    assert.equal(expiry(uri), null);
  }
});

test('image errors refresh the source without changing the original registration URL', async () => {
  const { app } = setup();
  const first = app.render({ uri: oldUrl });
  await first.refresh();
  const next = app.render({ uri: oldUrl });
  assert.equal(next.source.uri, newUrl);
  app.dispose();
  assert.equal(app.timers.size, 0);
});

test('an old refresh cannot replace a newly selected plant image', async () => {
  const pending = deferred();
  const { app } = setup(() => pending.promise);
  const previous = app.render({ uri: oldUrl });
  previous.refresh();
  app.render({ uri: 'https://another.test/plant.png' });
  pending.resolve({ url: newUrl });
  await flush();
  assert.equal(app.render({ uri: 'https://another.test/plant.png' }).source.uri, 'https://another.test/plant.png');
});

test('logout discards an in-flight private image refresh', async () => {
  const pending = deferred();
  const { app, setToken } = setup(() => pending.promise);
  app.render({ uri: oldUrl }).refresh();
  setToken(null);
  pending.resolve({ url: newUrl });
  await flush();
  assert.equal(app.render({ uri: oldUrl }).source.uri, oldUrl);
});

test('repeated failures do not create an image refresh loop', async () => {
  let count = 0;
  const { app } = setup(async () => { count += 1; throw new Error('offline'); });
  const image = app.render({ uri: oldUrl });
  await image.refresh();
  await image.refresh();
  assert.equal(count, 1);
  app.dispose();
});
