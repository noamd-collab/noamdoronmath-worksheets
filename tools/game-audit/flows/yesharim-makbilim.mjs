/** No-pointer play-through of "ישרים מקבילים": buttons and keyboard only. */
export default async function (page, { vp, shot, wait, log }) {
  const expect = (ok, message) => { if (!ok) throw new Error(`flow: ${message}`); };
  const click = async (sel, times = 1) => {
    for (let i = 0; i < times; i += 1) { await page.click(sel); await wait(200); }
    await wait(700);
  };
  const press = async (key, times = 1) => {
    for (let i = 0; i < times; i += 1) { await page.keyboard.press(key); await wait(150); }
    await wait(700);
  };
  const st = () => page.evaluate(() => ({ r: !!window.__lesson.state.sceneReady, d: !!window.__lesson.state.done, i: window.__lesson.state.idx }));
  const focus = (sel) => page.evaluate((s) => document.querySelector(s).focus(), sel);
  const val = (sel) => page.$eval(sel, (el) => el.getAttribute('aria-valuenow')).catch(() => null);
  log(`${vp}: start`);
  await click('#next'); // 0 -> 1
  // step 1: corresponding angles 1 and 5, theta by keyboard only
  await click('[data-i="1"]');
  await click('[data-i="5"]');
  await focus('#hT');
  const before = await val('#hT');
  await press('ArrowRight', 3);
  const after = await val('#hT');
  log(`step1 keyboard theta ${before} -> ${after}, state ${JSON.stringify(await st())}`);
  expect(before !== after, 'arrow keys did not move the handle');
  expect((await st()).r, 'scene 1 not solved');
  await shot('s1');
  await click('#next');
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); })); await click('#next'); // quiz step 2
  // step 3: alternate angles 3 and 5, then guess 122 with buttons
  await click('[data-i="3"]');
  await click('[data-i="5"]');
  await click('[data-g="10"]', 3);
  await click('[data-g="1"]', 2);
  await click('#chk');
  log(`step3 state ${JSON.stringify(await st())}`);
  expect((await st()).r, 'scene 3 not solved');
  await shot('s3');
  await click('#next');
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); })); await click('#next'); // quiz step 4
  // step 5: co-interior 3 and 6, theta by buttons, then tilt
  await click('[data-i="3"]');
  await click('[data-i="6"]');
  await click('[data-d="5"]', 2);
  await click('[data-d="-5"]', 4);
  await click('#tiltBtn');
  log(`step5 state ${JSON.stringify(await st())}`);
  expect((await st()).r, 'scene 5 not solved');
  await shot('s5');
  await click('#next');
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); })); await click('#next'); // quiz step 6
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); })); await click('#next'); // quiz step 7
  const total = await page.evaluate(() => window.__lesson.report().total);
  log(`finished, idx ${(await st()).i}, total ${total}`);
  expect(total === 320, `total ${total}`);
}
