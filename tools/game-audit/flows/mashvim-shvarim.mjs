// Zero-pointer play-through for mashvim-shvarim: keys and the on-screen check.
// The slider in every scene is found in the page, and each scene is swept until
// it reports ready, so the flow never hard-codes a fraction.
export default async function (page, { vp, shot, wait, log }) {
  const expect = (ok, message) => { if (!ok) throw new Error(`flow(${vp}): ${message}`); };
  const state = () => page.evaluate(() => {
    const s = window.__lesson && window.__lesson.state;
    return s ? { idx: s.idx, ready: !!s.sceneReady, done: !!s.done } : null;
  });
  const note = () => page.$eval('#sceneNote', (el) => el.textContent).catch(() => '');
  const click = async (sel, times = 1) => {
    for (let i = 0; i < times; i += 1) { await page.click(sel); await wait(110); }
    await wait(450);
  };
  const press = async (key, times = 1) => {
    for (let i = 0; i < times; i += 1) { await page.keyboard.press(key); await wait(70); }
    await wait(400);
  };

  const scene = () => page.evaluate(() => {
    const handle = document.querySelector('#sceneSvg [role="slider"]');
    const buttons = [...document.querySelectorAll('#sceneExtra button, #card button')]
      .filter((b) => b.id !== 'next' && b.id !== 'soundBtn' && /בדוק|אשר/.test(b.textContent));
    const plus = [...document.querySelectorAll('#sceneExtra button, #card button')]
      .find((b) => /\+/.test(b.textContent) && b.id !== 'next');
    const minus = [...document.querySelectorAll('#sceneExtra button, #card button')]
      .find((b) => /−|-/.test(b.textContent) && b.id !== 'next');
    return {
      handle: handle ? `#${handle.id}` : null,
      min: handle ? Number(handle.getAttribute('aria-valuemin')) : 0,
      max: handle ? Number(handle.getAttribute('aria-valuemax')) : 0,
      check: buttons.length ? `#${buttons[0].id}` : null,
      plus: plus ? `#${plus.id}` : null,
      minus: minus ? `#${minus.id}` : null,
    };
  });

  const sweep = async () => {
    const { handle, min, max, check, plus, minus } = await scene();
    if (!handle) return false;
    // The stepper buttons keep the value in reach after a wrong check; the
    // slider keeps focus only while it is not re-rendered.
    if (minus) await click(minus, 12);
    else { await page.evaluate((s) => document.querySelector(s).focus(), handle); await press('Home'); }
    for (let v = min; v <= max; v += 1) {
      if (check) await click(check); else await press('Enter');
      if ((await state()).ready) return true;
      if (v < max) { if (plus) await click(plus); else await press('ArrowRight'); }
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
      let ok = false;
      for (let round = 0; round < 4 && !ok; round += 1) ok = await sweep();
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
