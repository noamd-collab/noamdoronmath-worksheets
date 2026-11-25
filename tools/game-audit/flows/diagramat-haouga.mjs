// No-pointer play-through for diagramat-haouga: only clicks on buttons and key presses.
export default async function (page, { vp, shot, wait, log }) {
  const expect = (ok, message) => { if (!ok) throw new Error(`flow: ${message}`); };
  const state = () => page.evaluate(() => {
    const s = window.__lesson && window.__lesson.state;
    return s ? { ready: !!s.sceneReady, done: !!s.done } : null;
  });
  const click = async (sel, times = 1) => {
    for (let i = 0; i < times; i += 1) { await page.click(sel); await wait(150); }
    await wait(700);
  };
  const press = async (key, times = 1) => {
    for (let i = 0; i < times; i += 1) { await page.keyboard.press(key); await wait(100); }
    await wait(700);
  };
  const val = (sel) => page.$eval(sel, (el) => el.getAttribute('aria-valuenow')).catch(() => null);

  log(`start vp=${vp}`);
  await click('#next'); // intro -> scene 1

  // ---- step 1: keyboard only: 50% -> 35% ----
  await page.evaluate(() => document.querySelector('#h1').focus());
  const b1 = await val('#h1');
  await press('ArrowLeft', 15);
  const a1 = await val('#h1');
  log(`scene1 keyboard ${b1} -> ${a1}; ${JSON.stringify(await state())}`);
  expect(a1 === '35', 'scene 1 did not reach 35');
  await shot('s1');
  await click('#next');

  // ---- step 2: quiz, correct = option 2 ----
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); }));
  log(`quiz2 ${JSON.stringify(await state())}`);
  await click('#next');

  // ---- step 3: buttons: [20,20,20,20] -> [25,35,30,10] ----
  await click('#cat0'); await click('#dp5', 1);
  await click('#cat1'); await click('#dp5', 3);
  await click('#cat2'); await click('#dp5', 2);
  await click('#cat3'); await click('#dm5', 2);
  log(`scene3 buttons ${JSON.stringify(await state())}`);
  await shot('s3');
  await click('#next');

  // ---- step 4: quiz, correct = option 1 ----
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); }));
  log(`quiz4 ${JSON.stringify(await state())}`);
  await click('#next');

  // ---- step 5: buttons: 40% -> 10% ----
  await click('#dm5', 6);
  log(`scene5 buttons ${JSON.stringify(await state())}`);
  await shot('s5');
  await click('#next');

  // ---- steps 6 and 7: quizzes ----
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); }));
  log(`quiz6 ${JSON.stringify(await state())}`);
  await click('#next');
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); }));
  log(`quiz7 ${JSON.stringify(await state())}`);
  await click('#next');

  const total = await page.evaluate(() => (window.__lesson ? window.__lesson.report().total : null));
  log(`finished, total ${total}`);
  expect(total === 320, `total was ${total}, expected 320`);
}
