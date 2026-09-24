const assert = require('node:assert/strict');
const { test } = require('node:test');
const { screen } = require('./helpers/screen.cjs');

/*
  request()/requestForm() 의 제한 시간과 401 처리 — 화면 전체가 여기에 얹혀 있는데
  그동안 검증이 없었다. fetch 는 응답이 없으면 스스로 끝나지 않으므로, 상한을
  걸어 둔 타이머가 실제로 요청을 끊고 사람이 읽을 수 있는 오류를 내는지 확인한다.

  screen() 은 setTimeout 을 가짜로 바꿔 주므로 runTimer(ms) 로 제한 시간이 지난
  상황을 만든다 — 테스트가 실제로 15초를 기다리지 않는다.
*/
function setup() {
  const calls = [];
  let settle;
  // 응답을 주지 않고 매달려 있는 fetch — abort 되면 그때 거절한다
  const fetchStub = (url, options = {}) => {
    calls.push({ url, options });
    return new Promise((resolve, reject) => {
      settle = { resolve, reject };
      options.signal?.addEventListener('abort', () => {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });
  };

  const app = screen('src/api.ts', {
    'expo-constants': { default: { expoConfig: { hostUri: 'localhost:8081' } } },
    'expo-file-system': { File: class {} },
  }, {
    fetch: fetchStub,
    AbortController,
    FormData,
    process: { env: { EXPO_PUBLIC_API_BASE_URL: 'https://api.test' } },
  });

  return { app, api: app.exports, calls, respond: (value) => settle.resolve(value) };
}

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

test('응답이 없는 요청은 제한 시간이 지나면 끊기고 안내 메시지를 낸다', async () => {
  const { app, api } = setup();
  const pending = api.getPlants();
  const failed = assert.rejects(pending, /서버 응답이 너무 늦어요/);

  app.runTimer(15_000);
  await failed;
});

test('제한 시간이 지나기 전에 응답이 오면 타이머는 정리된다', async () => {
  const { app, api, respond } = setup();
  const pending = api.getPlants();

  respond(jsonResponse(200, []));
  assert.deepEqual(await pending, []);
  assert.equal(app.timers.size, 0, '응답 후에도 타이머가 남으면 안 된다');
});

test('사진 업로드는 더 긴 제한 시간을 쓴다', async () => {
  const { app, api } = setup();
  const pending = api.diagnosePlantPhoto(null, '잎이 노랗게 변해요');
  const failed = assert.rejects(pending, /서버 응답이 너무 늦어요/);

  // 기본(15초)에는 끊기지 않고, AI 진단용 제한 시간에만 끊긴다
  assert.equal([...app.timers.values()].some((t) => t.delay === 15_000), false);
  app.runTimer(120_000);
  await failed;
});

test('세션 중 401 이면 등록해 둔 로그아웃 처리를 부른다', async () => {
  const { api, respond } = setup();
  let loggedOut = 0;
  api.setAuthToken('token');
  api.setUnauthorizedHandler(() => { loggedOut += 1; });

  const pending = api.getPlants();
  respond(jsonResponse(401, { detail: '인증이 필요합니다.' }));

  await assert.rejects(pending, /인증이 필요합니다/);
  assert.equal(loggedOut, 1);
});

test('/auth 의 401 은 그 화면이 직접 처리하므로 로그아웃시키지 않는다', async () => {
  const { api, respond } = setup();
  let loggedOut = 0;
  api.setAuthToken('token');
  api.setUnauthorizedHandler(() => { loggedOut += 1; });

  // 계정 삭제에서 비밀번호를 틀리면 401 이 온다 — 세션은 아직 살아 있다
  const pending = api.deleteMe('wrong-password');
  respond(jsonResponse(401, { detail: '비밀번호가 올바르지 않아요.' }));

  await assert.rejects(pending, /비밀번호가 올바르지 않아요/);
  assert.equal(loggedOut, 0);
});

test('토큰이 없으면 401 이어도 로그아웃 처리를 부르지 않는다', async () => {
  const { api, respond } = setup();
  let loggedOut = 0;
  api.setAuthToken(null);
  api.setUnauthorizedHandler(() => { loggedOut += 1; });

  const pending = api.getPlants();
  respond(jsonResponse(401, { detail: '인증이 필요합니다.' }));

  await assert.rejects(pending);
  assert.equal(loggedOut, 0);
});

test('401 이 아닌 오류는 로그아웃과 무관하다', async () => {
  const { api, respond } = setup();
  let loggedOut = 0;
  api.setAuthToken('token');
  api.setUnauthorizedHandler(() => { loggedOut += 1; });

  const pending = api.getPlants();
  respond(jsonResponse(500, { detail: '서버 오류' }));

  await assert.rejects(pending, /서버 오류/);
  assert.equal(loggedOut, 0);
});
