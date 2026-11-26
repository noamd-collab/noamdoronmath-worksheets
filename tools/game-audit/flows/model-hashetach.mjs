// No-pointer play-through for model-hashetach: buttons and keyboard only.
export default async function (page, { vp, shot, wait, log }) {
  const lesson = () => page.evaluate(() => {
    const s = window.__lesson.state;
    return { ready: !!s.sceneReady, done: !!s.done };
  });
  const click = async (sel, times = 1) => {
    for (let i = 0; i < times; i += 1) { await page.click(sel); await wait(300); }
    await wait(500);
  };
  const press = async (key, times = 1) => {
    for (let i = 0; i < times; i += 1) { await page.keyboard.press(key); await wait(150); }
    await wait(600);
  };
  const expect = (ok, message) => { if (!ok) throw new Error(`flow(${vp}): ${message}`); };
  const attr = (sel, a) => page.$eval(sel, (el, n) => el.getAttribute(n), a);
  const next = async (label) => {
    const st = await lesson();
    log(`${label}: sceneReady=${st.ready} done=${st.done}`);
    expect(st.ready || st.done, `${label} not solved: ${await page.$eval('#sceneNote', (el) => el.textContent).catch(() => '')}`);
    await click('#next');
    await wait(300);
  };

  log(`start ${vp}`);
  await click('#next'); // 0 -> 1
  // scene 1: keyboard only on the slider handle
  await page.evaluate(() => document.querySelector('#hCut').focus());
  const b0 = await attr('#hCut', 'aria-valuenow');
  await press('ArrowRight', 2);
  const b1 = await attr('#hCut', 'aria-valuenow');
  log(`scene1 keyboard: b ${b0} -> ${b1}`);
  expect(b1 === '4', 'arrow keys did not reach b = 4');
  await click('#optB'); // wrong: keeps second term unmultiplied
  const wrongNote = await page.$eval('#sceneNote', (el) => el.textContent);
  log(`scene1 wrong note: ${wrongNote.slice(0, 60)}`);
  await click('#optA');
  await shot('s1');
  await next('step1');
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); })); await next('step2');
  // scene 2: sign toggles
  await click('#chkBtn'); // (+,+) is wrong
  log(`scene2 wrong note: ${(await page.$eval('#sceneNote', (el) => el.textContent)).slice(0, 60)}`);
  await click('#tg2');
  await click('#chkBtn');
  await click('#chkBtn'); // to round two
  await click('#tg1'); await click('#tg2'); // (-,-) is wrong in round two
  await click('#chkBtn');
  await click('#tg2'); // back to (-,+): -(x - 5) = -x + 5
  await click('#chkBtn');
  await shot('s3');
  await next('step3');
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); })); await next('step4');
  // scene 3: tiles; a wrong chip first
  await click('#chip0'); // 2x in x*x tile: wrong
  log(`scene3 wrong note: ${(await page.$eval('#sceneNote', (el) => el.textContent)).slice(0, 60)}`);
  await click('#chip1'); await click('#chip3'); await click('#chip0'); await click('#chip2');
  await shot('s5');
  await next('step5');
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); })); await next('step6');
  await click('#opt' + await page.evaluate(() => { const L = window.__lesson; return L.steps[L.state.idx].opts.findIndex((o) => o.c); })); await next('step7');
  const total = await page.evaluate(() => window.__lesson.report().total);
  log(`finished, total ${total}`);
  expect(total === 320, `total ${total} is not 320`);
}
