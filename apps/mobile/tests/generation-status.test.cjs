const assert = require('node:assert/strict');
const { test } = require('node:test');
const { screen, nodes } = require('./helpers/screen.cjs');

// 정원 목록 마지막 칸과 하단 알림이 함께 쓰는 계산 — 실제 구현을 그대로 불러온다.
const { registrationProgressView } = (() => {
  const ts = require('typescript');
  const fs = require('node:fs');
  const path = require('node:path');
  const file = path.resolve(__dirname, '../src/registrationProgress.ts');
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function('module', 'exports', outputText)(module, module.exports);
  return module.exports;
})();

// 하단 진행 알림 — 알림(푸시)을 놓쳐도 진행 상황을 보고 이어서 진행할 수 있어야 한다.
function statusBar(context, props = {}) {
  const navigations = [];
  const app = screen('src/GenerationStatusBar.tsx', {
    './AddPlantFlowContext': { useAddPlantFlow: () => context },
    './registrationStorage': { registrationResumeScreen: () => 'CharacterResult' },
    './registrationProgress': { registrationProgressView },
    '../constants/colors': { Colors: {}, Glass: {}, GreenTint: {} },
    '../constants/fonts': { Fonts: {}, FontSizes: {} },
    '../constants/spacing': { Spacing: {}, Radius: {} },
  });
  const rendered = app.render({
    navigation: { navigate: (...args) => navigations.push(args) }, ...props,
  });
  const texts = nodes(rendered).filter(n => n.type === 'Text').map(n => n.props.children);
  const bars = nodes(rendered).filter(n => n.props?.style?.some?.(s => s && s.width));
  return { app, rendered, texts, navigations, bars };
}

test('the status bar shows live progress and opens the registration flow', () => {
  const draft = { generationJobId: 'job-1', createdPlantId: null, generationOutcome: null };
  const view = statusBar({ draft, generation: { jobId: 'job-1', status: 'generating', progress: 42, message: '후보 2/3' } });
  assert.ok(view.texts.includes('캐릭터 생성 중'));
  assert.ok(view.texts.includes('후보 2/3'));
  assert.ok(view.bars.some(bar => bar.props.style.some(s => s && s.width === '42%')));
  nodes(view.rendered).find(n => n.type === 'TouchableOpacity').props.onPress();
  assert.equal(view.navigations[0][0], 'AddPlant');
  assert.equal(view.navigations[0][1].params.resumeGeneration, 'true');
  view.app.dispose();
});

test('a finished job shows the result invitation even without live progress', () => {
  const draft = { generationJobId: 'job-1', createdPlantId: null, generationOutcome: 'completed' };
  const view = statusBar({ draft, generation: null });
  assert.ok(view.texts.includes('캐릭터 완성!'));
  assert.ok(view.bars.some(bar => bar.props.style.some(s => s && s.width === '100%')));
  view.app.dispose();
});

test('a failed job invites a retry instead of showing progress', () => {
  const draft = { generationJobId: 'job-1', createdPlantId: null, generationOutcome: 'failed' };
  const view = statusBar({ draft, generation: null });
  assert.ok(view.texts.includes('캐릭터 생성 실패'));
  assert.ok(view.texts.includes('눌러서 다시 시도하기'));
  view.app.dispose();
});

test('the bar stays hidden without a job, after registration, and inside the flow', () => {
  const live = { jobId: 'job-1', status: 'generating', progress: 10, message: '진행 중' };
  for (const [draft, props] of [
    [{ generationJobId: null, createdPlantId: null, generationOutcome: null }, {}],
    [{ generationJobId: 'job-1', createdPlantId: 7, generationOutcome: 'completed' }, {}],
    [{ generationJobId: 'job-1', createdPlantId: null, generationOutcome: null }, { hidden: true }],
  ]) {
    const view = statusBar({ draft, generation: live }, props);
    assert.equal(view.rendered, null);
    view.app.dispose();
  }
});

test('dismissing hides the bar until the job finishes', () => {
  const draft = { generationJobId: 'job-1', createdPlantId: null, generationOutcome: null };
  const context = { draft, generation: null };
  const app = screen('src/GenerationStatusBar.tsx', {
    './AddPlantFlowContext': { useAddPlantFlow: () => context },
    './registrationStorage': { registrationResumeScreen: () => 'CharacterResult' },
    './registrationProgress': { registrationProgressView },
    '../constants/colors': { Colors: {}, Glass: {}, GreenTint: {} },
    '../constants/fonts': { Fonts: {}, FontSizes: {} },
    '../constants/spacing': { Spacing: {}, Radius: {} },
  });
  const props = { navigation: { navigate() {} } };
  const close = nodes(app.render(props)).filter(n => n.type === 'TouchableOpacity').at(-1);
  close.props.onPress();
  assert.equal(app.render(props), null, '진행 중 알림은 닫힌다');

  // 결과는 놓치면 안 되므로 완료되면 다시 보여준다
  draft.generationOutcome = 'completed';
  const reopened = app.render(props);
  assert.ok(reopened);
  assert.ok(nodes(reopened).some(n => n.type === 'Text' && n.props.children === '캐릭터 완성!'));

  // 다음 생성도 다시 보여야 한다
  draft.generationJobId = 'job-2';
  draft.generationOutcome = null;
  assert.ok(app.render(props));
  app.dispose();
});


test('the garden card and status bar agree on one progress view', () => {
  const working = registrationProgressView(
    { generationJobId: 'job-1', createdPlantId: null, generationOutcome: null },
    { jobId: 'job-1', status: 'generating', progress: 68.4, message: '후보 3/3' });
  assert.equal(working.outcome, 'working');
  assert.equal(working.percent, 68);
  assert.equal(working.shortLabel, '만드는 중…');
  assert.equal(working.hint, '후보 3/3');

  // 끝나기 전에는 100%로 보이지 않는다
  assert.equal(registrationProgressView(
    { generationJobId: 'job-1', createdPlantId: null, generationOutcome: null },
    { jobId: 'job-1', status: 'postprocessing', progress: 100, message: '' }).percent, 99);

  // 다른 작업의 진행 상황은 쓰지 않는다
  assert.equal(registrationProgressView(
    { generationJobId: 'job-2', createdPlantId: null, generationOutcome: null },
    { jobId: 'job-1', status: 'generating', progress: 50, message: '' }).percent, 0);

  // 앱을 껐다 켜도 마지막 결과를 보여준다
  assert.equal(registrationProgressView(
    { generationJobId: 'job-1', createdPlantId: null, generationOutcome: 'completed' }, null).shortLabel, '완성! 고르기');
  assert.equal(registrationProgressView(
    { generationJobId: 'job-1', createdPlantId: null, generationOutcome: 'failed' }, null).shortLabel, '생성 실패');

  // 등록이 끝났거나 진행 중인 작업이 없으면 자리를 차지하지 않는다
  assert.equal(registrationProgressView({ generationJobId: 'job-1', createdPlantId: 9 }, null), null);
  assert.equal(registrationProgressView({ generationJobId: null, createdPlantId: null }, null), null);
});

test('live work wins over a previously persisted terminal outcome', () => {
  for (const generationOutcome of ['completed', 'failed']) {
    const view = registrationProgressView({ generationJobId: 'job-2', generationOutcome },
      { jobId: 'job-2', status: 'generating', progress: 12, message: '작업 중' });
    assert.equal(view.outcome, 'working');
    assert.equal(view.percent, 12);
  }
});
