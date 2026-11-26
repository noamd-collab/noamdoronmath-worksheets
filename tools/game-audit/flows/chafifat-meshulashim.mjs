// No-pointer play-through for chafifat-meshulashim: only clicks on buttons and key presses.
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
  const part = (k) => `#sceneExtra .pbtn[data-k="${k}"]`;
  const mv = (dir, id) => `#sceneExtra .mv[data-dir="${dir}"][data-id="${id}"]`;
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

  // step 1: keyboard only. Rotate 0 -> 105 (7 x 15), move (110,190) -> (250,130).
  await focus('#mv');
  await press('PageUp', 7);
  await press('ArrowRight', 14);
  await press('ArrowUp', 6);
  const s1 = await state();
  log(`scene1 keyboard ${JSON.stringify(s1)}`);
  expect(s1.ready, 'scene 1 not solved');
  await shot('s1');
  await click('#next');

  await quiz('quiz2');

  // step 3: buttons. SSS (locks), AAA (similar only), SSA with two triangles.
  for (const k of ['AB', 'BC', 'CA']) await click(part(k));
  await click('#clearBtn');
  for (const k of ['A', 'B', 'C']) await click(part(k));
  await click('#clearBtn');
  for (const k of ['AB', 'BC', 'A']) await click(part(k));
  const s3 = await state();
  log(`scene3 buttons ${JSON.stringify(s3)}`);
  expect(s3.ready, 'scene 3 not solved');
  await shot('s3');
  await click('#next');

  await quiz('quiz4');

  // step 5: buttons. [4,1,5,3,2] -> [1,5,3,2,4] -> [1,3,2,4,5].
  await click(mv('down', 4), 4);
  await click(mv('down', 5), 3);
  await click('#checkBtn');
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
