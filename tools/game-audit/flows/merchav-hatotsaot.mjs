/** No-pointer play-through of "merchav-hatotsaot": buttons and keyboard only. */
export default async function (page, { vp, shot, wait, log }) {
  const expect = (ok, message) => { if (!ok) throw new Error(`flow(${vp}): ${message}`); };
  const state = () => page.evaluate(() => ({ idx: window.__lesson.state.idx, ready: window.__lesson.state.sceneReady, done: window.__lesson.state.done }));
  const click = async (sel, times = 1) => {
    for (let i = 0; i < times; i += 1) { await page.click(sel); await wait(250); }
    await wait(700);
  };
  const press = async (key, times = 1) => {
    for (let i = 0; i < times; i += 1) { await page.keyboard.press(key); await wait(150); }
    await wait(700);
  };
  const focus = (sel) => page.evaluate((s) => document.querySelector(s).focus(), sel);
  const attr = (sel, a) => page.$eval(sel, (el, n) => el.getAttribute(n), a);
  const next = async () => { await click('#next'); };

  // step 0: intro
  log('step 0 intro: ' + JSON.stringify(await state()));
  await next();

  // step 1: bag, keyboard only (start 2 red, target 6)
  await focus('#hdl');
  const before = await attr('#hdl', 'aria-valuenow');
  await press('ArrowRight', 3);
  await press('ArrowLeft', 1);
  await press('ArrowRight', 2);
  const after = await attr('#hdl', 'aria-valuenow');
  log(`step 1 keyboard: ${before} -> ${after}, ${JSON.stringify(await state())}`);
  expect(after === '6', 'bag did not reach 6 red');
  expect((await state()).ready, 'bag scene not solved');
  await shot('flow-bag');
  await next();

  // step 2: quiz, correct option is opt2
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); }));
  log('step 2 quiz: ' + JSON.stringify(await state()));
  expect((await state()).done, 'quiz 2 not done');
  await next();

  // step 3: dice grid, buttons (cursor arrows and mark) for the anti-diagonal r + c = 5
  await click('#mvRight', 5);
  await click('#mark');
  for (let k = 0; k < 5; k += 1) {
    await click('#mvDown');
    await click('#mvLeft');
    await click('#mark');
  }
  log('step 3 dice buttons: ' + JSON.stringify(await state()));
  expect((await state()).ready, 'dice scene not solved');
  await shot('flow-dice');
  await next();

  // step 4
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); }));
  expect((await state()).done, 'quiz 4 not done');
  log('step 4 quiz: ' + JSON.stringify(await state()));
  await next();

  // step 5: fair spinner, buttons (start 1, need 4)
  await click('#danPlus', 3);
  log('step 5 spinner buttons: ' + JSON.stringify(await state()));
  expect((await state()).ready, 'fair scene not solved');
  await shot('flow-fair');
  await next();

  // step 6 and 7
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); }));
  expect((await state()).done, 'quiz 6 not done');
  log('step 6 quiz: ' + JSON.stringify(await state()));
  await next();
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); }));
  expect((await state()).done, 'quiz 7 not done');
  log('step 7 quiz: ' + JSON.stringify(await state()));
  await next();

  const fin = await state();
  log('finish step: ' + fin.idx);
  expect(fin.idx === 8, 'finish not reached');
  const total = await page.evaluate(() => window.__lesson.report().total);
  log('total ' + total);
  expect(total === 320, 'total is ' + total);
}
