// Zero-pointer play-through for kod-batzadim: the program is built with the
// on-screen command buttons and run with "הרץ מההתחלה", never with a drag.
// Each scene has one goal on the grid, so the flow clears the program and
// builds a shortest path: the build and debug scenes end at (2,2), the loop
// scene at (3,1).
export default async function (page, { vp, shot, wait, log }) {
  const expect = (ok, message) => { if (!ok) throw new Error(`flow(${vp}): ${message}`); };
  const state = () => page.evaluate(() => {
    const s = window.__lesson && window.__lesson.state;
    return s ? { idx: s.idx, ready: !!s.sceneReady, done: !!s.done } : null;
  });
  const note = () => page.$eval('#sceneNote', (el) => el.textContent).catch(() => '');
  const click = async (sel, times = 1) => {
    for (let i = 0; i < times; i += 1) { await page.click(sel); await wait(110); }
    await wait(400);
  };

  // (2,2) for the build and debug scenes, (3,1) for the loop scene.
  const PROGRAMS = {
    1: ['addR', 'addR', 'addU', 'addU'],
    3: ['addR', 'addR', 'addU', 'addU'],
  };
  // The loop scene wants the repeat block, three times, not single steps.
  const LOOP = { step: 5, repeat: 3 };

  log(`start vp=${vp}`);
  await click('#next');

  let guard = 0;
  for (;;) {
    guard += 1;
    if (guard > 20) throw new Error('flow: too many steps');
    const s = await state();
    const mode = await page.evaluate((k) => window.__lesson.steps[k].mode, s.idx);
    if (mode === 'finish') break;
    if (mode === 'scene') {
      await click('#clearCode');
      if (s.idx === LOOP.step) {
        await click('#repeatPlus', LOOP.repeat - 1);
        await click('#addB');
      } else {
        for (const cmd of PROGRAMS[s.idx] || []) await click(`#${cmd}`);
      }
      await click('#runCode');
      await wait(900);
      const after = await state();
      log(`scene${s.idx} ${JSON.stringify(after)}`);
      expect(after.ready, `scene ${s.idx} not solved: ${await note()}`);
      await shot(`s${s.idx}`);
    } else if (mode === 'quiz') {
      const k = await page.evaluate(() => {
        const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c);
      });
      await click(`#opt${k}`);
      const q = await state();
      log(`quiz${s.idx} opt${k} ${JSON.stringify(q)}`);
      expect(q.done, `quiz ${s.idx} not solved`);
    }
    await click('#next');
  }
  const total = await page.evaluate(() => window.__lesson.report().total);
  log(`finished, total ${total}`);
  expect(total === 320, `total ${total}, expected 320`);
}
