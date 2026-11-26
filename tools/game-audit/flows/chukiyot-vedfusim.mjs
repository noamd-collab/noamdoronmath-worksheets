// No-pointer play-through for chukiyot-vedfusim: buttons and keyboard only.
export default async function (page, { vp, shot, wait, log }) {
  const read = (sel) => page.$eval(sel, (el) => (el.textContent || '').trim()).catch(() => null);
  const state = () => page.evaluate(() => ({
    idx: window.__lesson.state.idx,
    ready: window.__lesson.state.sceneReady,
    done: window.__lesson.state.done
  }));
  const press = async (key, times = 1) => {
    for (let i = 0; i < times; i += 1) { await page.keyboard.press(key); await wait(150); }
    await wait(700);
  };
  const click = async (sel, times = 1) => {
    for (let i = 0; i < times; i += 1) { await page.click(sel); await wait(200); }
    await wait(700);
  };
  const expect = (ok, message) => { if (!ok) throw new Error(`flow(${vp}): ${message}`); };

  // step 0: intro
  log(`start: ${await read('#title')}`);
  await click('#next');

  // step 1: build shape 5 with the keyboard only
  await page.evaluate(() => document.querySelector('#hN').focus());
  const before = await page.$eval('#hN', (e) => e.getAttribute('aria-valuenow'));
  await press('ArrowRight', 4);
  const after = await page.$eval('#hN', (e) => e.getAttribute('aria-valuenow'));
  log(`scene1 keyboard: ${before} -> ${after}`);
  expect(before === '1' && after === '5', 'arrow keys did not move the handle to 5');
  let s = await state();
  log(`step ${s.idx} sceneReady=${s.ready}`);
  expect(s.ready, 'scene 1 not solved');
  await shot('scene1');
  await click('#next');

  // step 2: quiz, correct option index 2
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); }));
  s = await state(); log(`step ${s.idx} quiz done=${s.done}`); expect(s.done, 'quiz 1 not solved');
  await click('#next');

  // step 3: a = 3, b = 1 with the on-screen buttons (wrong first: b = 1 only)
  await click('[data-key="b"][data-delta="1"]');
  log(`wrong a: ${await read('#sceneNote')}`);
  await click('[data-key="a"][data-delta="1"]', 2);
  s = await state(); log(`step ${s.idx} sceneReady=${s.ready}`); expect(s.ready, 'scene 2 not solved');
  await shot('scene2');
  await click('#next');

  // step 4: quiz, correct option index 0
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); }));
  s = await state(); log(`step ${s.idx} quiz done=${s.done}`); expect(s.done, 'quiz 2 not solved');
  await click('#next');

  // step 5: use the rule: 50th term, then three membership questions
  await click('#c0');
  log(`wrong term: ${await read('#sceneNote')}`);
  await click('#c2');
  await click('#cn');
  await click('#c0'); await click('#cn');
  await click('#c1'); await click('#cn');
  await click('#c0');
  s = await state(); log(`step ${s.idx} sceneReady=${s.ready}`); expect(s.ready, 'scene 3 not solved');
  await shot('scene3');
  await click('#next');

  // step 6: quiz, correct option index 3
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); }));
  s = await state(); log(`step ${s.idx} quiz done=${s.done}`); expect(s.done, 'quiz 3 not solved');
  await click('#next');

  // step 7: quiz, correct option index 1
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); }));
  s = await state(); log(`step ${s.idx} quiz done=${s.done}`); expect(s.done, 'quiz 4 not solved');
  await click('#next');

  s = await state();
  expect(s.idx === 8, 'finish step not reached');
  const total = await page.evaluate(() => window.__lesson.report().total);
  log(`finished at step ${s.idx}, total ${total}`);
  expect(total === 320, `total is ${total}, expected 320`);
}
