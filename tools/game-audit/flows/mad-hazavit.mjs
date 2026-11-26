// No-pointer play-through for mad-hazavit: only clicks on buttons and key presses.
export default async function (page, { vp, shot, wait, log }) {
  const expect = (ok, message) => { if (!ok) throw new Error(`flow: ${message}`); };
  const state = () => page.evaluate(() => {
    const s = window.__lesson && window.__lesson.state;
    return s ? { idx: s.idx, ready: !!s.sceneReady, done: !!s.done } : null;
  });
  const click = async (sel, times = 1) => {
    for (let i = 0; i < times; i += 1) { await page.click(sel); await wait(120); }
    await wait(600);
  };
  const press = async (key, times = 1) => {
    for (let i = 0; i < times; i += 1) { await page.keyboard.press(key); await wait(60); }
    await wait(600);
  };
  const focus = (sel) => page.evaluate((s) => document.querySelector(s).focus(), sel);
  const val = (sel) => page.$eval(sel, (el) => el.getAttribute('aria-valuenow'));
  const step = (d) => `#sceneExtra [data-delta="${d}"]`;
  const quiz = async (name) => {
    const k = await page.evaluate(() => {
      const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c);
    });
    await click(`#opt${k}`);
    log(`${name} opt${k} ${JSON.stringify(await state())}`);
    await click('#next');
  };

  log(`start vp=${vp}`);
  await click('#next');

  // step 1: keyboard only. 30 -> 65, confirm; 65 -> 140, confirm.
  await focus('#hR');
  await press('PageUp', 7);
  log(`scene1 a=${await val('#hR')}`);
  expect(await val('#hR') === '65', 'scene 1 did not reach 65');
  await click('#okBtn');
  await focus('#hR');
  await press('PageUp', 15);
  log(`scene1 a=${await val('#hR')}`);
  await click('#okBtn');
  const s1 = await state();
  log(`scene1 keyboard ${JSON.stringify(s1)}`);
  expect(s1.ready, 'scene 1 not solved');
  await shot('s1');
  await click('#next');

  await quiz('quiz2');

  // step 3: buttons. 45 -> 105 (obtuse), 90 (right), 180 (straight), 360 (full).
  await click(step(10), 6); await click('#okBtn');
  await click(step(-10), 1); await click(step(-1), 5); await click('#okBtn');
  await click(step(10), 9); await click('#okBtn');
  await click(step(10), 18); await click('#okBtn');
  const s3 = await state();
  log(`scene3 buttons ${JSON.stringify(s3)}`);
  expect(s3.ready, 'scene 3 not solved');
  await shot('s3');
  await click('#next');

  await quiz('quiz4');

  // step 5: buttons. 20 -> 52 (to 90); then 40 -> 63 (to 180).
  await click(step(10), 3); await click(step(1), 2); await click('#okBtn');
  await click(step(10), 2); await click(step(1), 3); await click('#okBtn');
  const s5 = await state();
  log(`scene5 buttons ${JSON.stringify(s5)}`);
  expect(s5.ready, 'scene 5 not solved');
  await shot('s5');
  await click('#next');

  await quiz('quiz6');
  await quiz('quiz7');

  const total = await page.evaluate(() => window.__lesson.report().total);
  log(`finished idx=${(await state()).idx}, total ${total}`);
  expect(total === 320, `total was ${total}, expected 320`);
}
