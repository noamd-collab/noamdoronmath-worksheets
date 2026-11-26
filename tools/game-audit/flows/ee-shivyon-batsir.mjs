export default async function (page, { vp, shot, wait, log }) {
  const read = (sel) => page.$eval(sel, (el) => (el.textContent || '').trim()).catch(() => null);
  const press = async (key, times = 1) => {
    for (let i = 0; i < times; i += 1) { await page.keyboard.press(key); await wait(150); }
    await wait(700);
  };
  const click = async (sel) => { await page.click(sel); await wait(700); };
  const expect = (ok, message) => { if (!ok) throw new Error(`flow: ${message}`); };
  const ready = () => page.evaluate(() => { const s = window.__lesson.state; return { ready: !!s.sceneReady, done: !!s.done, idx: s.idx }; });
  const focus = (sel) => page.evaluate((s) => document.querySelector(s).focus(), sel);
  const quiz = async () => {
    const k = await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); });
    await click('#opt' + k); const s = await ready(); log(`quiz step ${s.idx}: opt${k} done=${s.done}`); expect(s.done, 'quiz not solved'); await click('#next');
  };

  log(`${vp} start: ${await read('h1')}`);
  await click('#next');
  // scene 1: keyboard on the handle, then the two toggles
  await focus('#markHandle');
  await press('ArrowLeft', 2);
  log(`scene1 reading: ${await read('[data-read]')}`);
  await click('#dirBtn');
  log(`scene1 reading: ${await read('[data-read]')}`);
  await click('#circBtn');
  let s = await ready();
  log(`scene1 ready=${s.ready} reading ${await read('[data-read]')}`);
  expect(s.ready, 'scene 1 not solved');
  await shot('scene1');
  await click('#next');
  await quiz(0);
  // scene 2: buttons; first the typical error (no flip)
  await click('#opSub4');
  await click('#opDivN3');
  log(`scene2 wrong: ${await read('[data-line]')} | ${await read('#sceneNote')}`);
  expect((await ready()).ready === false, 'scene 2 solved without the flip');
  await click('#flipSign');
  s = await ready();
  log(`scene2 ready=${s.ready} line ${await read('[data-line]')}`);
  expect(s.ready, 'scene 2 not solved');
  await shot('scene2');
  await click('#next');
  await quiz(2);
  // scene 3: buttons
  for (let i = 0; i < 4; i += 1) await click('#tPlus');
  for (let i = 0; i < 4; i += 1) await click('#tMinus');
  s = await ready();
  log(`scene3 ready=${s.ready} ${await read('[data-count]')}`);
  expect(s.ready, 'scene 3 not solved');
  await shot('scene3');
  await click('#next');
  await quiz(3);
  await quiz(1);
  const total = await page.evaluate(() => window.__lesson.report().total);
  log(`finished at step ${(await ready()).idx}, total ${total}`);
  expect(total === 320, `total ${total}`);
}
