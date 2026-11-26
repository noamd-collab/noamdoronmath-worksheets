// No-pointer play-through for tavlat-hashkichut: only clicks on buttons and key presses.
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
  const st = (k, d) => `#sceneExtra [data-k="${k}"][data-delta="${d}"]`;
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

  // step 1: keyboard only. [5,5,5,5] -> [8,6,2,4] (dog, cat, bird, fish; total 20).
  await focus('#h0'); await press('ArrowUp', 3);
  await focus('#h1'); await press('ArrowUp', 1);
  await focus('#h2'); await press('ArrowDown', 3);
  await focus('#h3'); await press('ArrowDown', 1);
  await click('#chk');
  const s1 = await state();
  log(`scene1 keyboard ${JSON.stringify(s1)}`);
  expect(s1.ready, 'scene 1 not solved');
  await shot('s1');
  await click('#next');

  await quiz('quiz2');

  // step 3: buttons. [10,10,10,10] -> [40,30,10,20].
  await click(st(0, 5), 6);
  await click(st(1, 5), 4);
  await click(st(3, 5), 2);
  await click('#chk');
  const s3 = await state();
  log(`scene3 buttons ${JSON.stringify(s3)}`);
  expect(s3.ready, 'scene 3 not solved');
  await shot('s3');
  await click('#next');

  await quiz('quiz4');

  // step 5: buttons. bars [30,30,30,30] -> [50,45,48,40], axis 0 -> 30 -> 0.
  await click(st('b0', 5), 4);
  await click(st('b1', 5), 3);
  await click(st('b2', 5), 3); await click(st('b2', 1), 3);
  await click(st('b3', 5), 2);
  await click(st('ax', 10), 3);
  await shot('s5-axis30');
  await click(st('ax', -10), 3);
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
