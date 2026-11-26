// Zero-pointer play-through for kefel-bezek: buttons and keys only.
// Scene steps carry no points, so the solver may try every handle value; the
// quiz answers come from the page.
export default async function (page, { vp, shot, wait, log }) {
  const expect = (ok, message) => { if (!ok) throw new Error(`flow(${vp}): ${message}`); };
  const state = () => page.evaluate(() => {
    const s = window.__lesson && window.__lesson.state;
    return s ? { idx: s.idx, ready: !!s.sceneReady, done: !!s.done } : null;
  });
  const note = () => page.$eval('#sceneNote', (el) => el.textContent).catch(() => '');
  const click = async (sel, times = 1) => {
    for (let i = 0; i < times; i += 1) { await page.click(sel); await wait(120); }
    await wait(500);
  };
  const press = async (key, times = 1) => {
    for (let i = 0; i < times; i += 1) { await page.keyboard.press(key); await wait(70); }
    await wait(450);
  };
  const focus = (sel) => page.evaluate((s) => document.querySelector(s).focus(), sel);
  const info = (sel) => page.$eval(sel, (el) => ({
    now: Number(el.getAttribute('aria-valuenow')),
    min: Number(el.getAttribute('aria-valuemin')),
    max: Number(el.getAttribute('aria-valuemax')),
  }));

  // Walk the handle across its whole range, confirming each value.
  const sweep = async (handleSel, confirmSel) => {
    const { min, max } = await info(handleSel);
    await focus(handleSel);
    await press('Home');
    for (let v = min; v <= max; v += 1) {
      if (confirmSel) await click(confirmSel); else await press('Enter');
      const s = await state();
      if (s.ready) return true;
      if (v < max) await press('ArrowRight');
    }
    return false;
  };

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
      // A scene may hold several rounds (two equations, or four cards): sweep,
      // and if the scene is not ready yet, sweep again from the minimum.
      let ok = false;
      for (let round = 0; round < 6 && !ok; round += 1) {
        ok = await sweep('#bezekHandle', '#bezekCheck');
        if (!ok) ok = await sweep('#bezekHandle', null);
      }
      log(`scene${s.idx} ${JSON.stringify(await state())}`);
      expect(ok, `scene ${s.idx} not solved: ${await note()}`);
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
