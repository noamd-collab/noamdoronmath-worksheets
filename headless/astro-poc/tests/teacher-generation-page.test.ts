import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transform as compileAstro } from '@astrojs/compiler';
import { build } from 'esbuild';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { parseHTML } from 'linkedom';
import { TEACHER_PRIVATE_HEADERS } from '../src/lib/teacherAccess';

const require = createRequire(import.meta.url);


// Render the real page's server branches. Authentication itself has separate
// request/token tests; this fixture substitutes only its four possible results
// and the shared site shell, so it never contacts Auth, a worker or a model.
async function compileComponent(relative: string) {
  const file = new URL(relative,import.meta.url);
  const options = { internalURL: 'astro/compiler-runtime', resultScopedSlot: true,
    renderScript: true, resolvePath: (specifier: string) => specifier };
  const compiled = await compileAstro(readFileSync(file, 'utf8'), {
    ...options, filename: fileURLToPath(file),
  });
  const shell = await compileAstro(`<!doctype html><html lang="he" dir="rtl"><head><title>{Astro.props.title}</title></head><body><slot /></body></html>`, options);
  const bundled = await build({
    stdin: { contents: compiled.code, loader: 'ts', resolveDir: dirname(fileURLToPath(file)) },
    bundle: true, write: false, format: 'esm', platform: 'node',
    plugins: [{ name: 'teacher-page-test', setup(builder) {
      builder.onResolve({ filter: /BaseLayout\.astro$/ }, () => ({ path: 'shell', namespace: 'fixture' }));
      builder.onResolve({ filter: /\/teacherAccess$/ }, () => ({ path: 'access', namespace: 'fixture' }));
      builder.onLoad({ filter: /^shell$/, namespace: 'fixture' }, () => ({ contents: shell.code, loader: 'ts' }));
      builder.onLoad({ filter: /^access$/, namespace: 'fixture' }, () => ({ loader: 'js', contents: `
        export const TEACHER_PRIVATE_HEADERS = ${JSON.stringify(TEACHER_PRIVATE_HEADERS)};
        export async function requireGoogleTeacher(request) {
          const result = request.headers.get('x-test-access');
          if (result === 'owner' || result === 'teacher') return {ok:true,userId:'test-'+result,expiresAt:9999999999};
          const status = Number(result);
          if (![401,403,503].includes(status)) throw new Error('Missing access fixture');
          return {ok:false,status};
        }
      ` }));
      builder.onResolve({ filter: /\.css$|\?astro&type=style/ }, args => ({ path: args.path, namespace: 'style' }));
      builder.onLoad({ filter: /.*/, namespace: 'style' }, () => ({ contents: '', loader: 'js' }));
      builder.onResolve({ filter: /^astro\/(compiler-runtime|runtime\/)/ }, args => ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }));
    } }],
  });
  return (await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)).default;
}
const component = compileComponent('../src/pages/teachers/generate.astro');
const landing = compileComponent('../src/components/TeacherComingSoon.astro');

test('the public trial hero links directly to generation only while the verified window is open', async()=>{
  const container=await AstroContainer.create();
  for(const active of [true,false]) {
    const html=await container.renderToString(await landing,{props:{trial:{active,startsAt:'2026-11-22T15:00:00Z',endsAt:'2026-11-25T15:00:00Z'}}});
    const hero=parseHTML(html).document.querySelector('.hero')!;
    const primary=hero.querySelector('.coming-soon-actions .button.primary')!;
    assert.equal(primary.getAttribute('href'),active?'/teachers/generate':'/teachers/start');
    assert.equal(Boolean(hero.querySelector('a[href="/teachers/generate"]')),active);
    assert.ok(hero.querySelector('a[href="/teachers/start"]'));
    if(active) {
      assert.match(primary.textContent,/ליצירת דף עבודה בחינם/);
      assert.match(hero.textContent,/5 דפים בסך הכול לכל חשבון Google/);
      assert.match(hero.querySelector('time')!.textContent,/17:00/);
    }
  }
});

test('the access note stays the same quiet line when payment testing is forced open', async () => {
  const container = await AstroContainer.create();
  const Landing = await landing;
  const trial = { active: false, startsAt: '2026-11-22T15:00:00Z', endsAt: '2026-11-25T15:00:00Z' };
  const closed = await container.renderToString(Landing, { props: { trial } });
  const open = await container.renderToString(Landing, { props: { trial, paymentOpen: true } });
  function note(html: string) {
    const section = parseHTML(html).document.querySelector('#teacher-plans');
    assert.ok(section);
    assert.equal(section.querySelector('a, button, h2, h3'), null);
    assert.equal(section.textContent.replace(/\s+/g, ' ').trim(), 'גישה לאזור המורים תיפתח בקרוב. הפרטים עדיין בעבודה.');
    return section.outerHTML;
  }
  assert.equal(note(closed), note(open));
  for (const html of [closed, open]) {
    assert.equal(html.includes('לבחירת מסלול ותשלום'), false);
    assert.equal(html.includes('18 ש״ח'), false);
    assert.equal(html.includes('180 ש״ח'), false);
    assert.equal(html.includes('href="/payment"'), false);
  }
});

async function render(access: 'owner' | 'teacher' | '401' | '403' | '503', search = '') {
  const container = await AstroContainer.create();
  const response = await container.renderToResponse(await component, {
    request: new Request('https://teachers.test/teachers/generate'+search, { headers: { 'x-test-access': access } }),
  });
  for (const [key, value] of Object.entries(TEACHER_PRIVATE_HEADERS)) assert.equal(response.headers.get(key), value);
  const html = await response.text();
  return { response, html, document: parseHTML(html).document };
}

test('a denied identity receives a Google sign-in prompt and no private form or scripts', async () => {
  const { response, document } = await render('403');
  assert.equal(response.status, 403);
  assert.match(document.querySelector('main')!.textContent, /חשבון Google מאומת/);
  assert.equal(document.querySelector('main a')!.getAttribute('href'), '/teachers/login?returnTo=%2Fteachers%2Fgenerate');
  assert.equal(document.querySelectorAll('form,script,#generation-jobs').length, 0);
});

for (const identity of ['owner','teacher'] as const) test(identity+' can access the generator and personal history', async () => {
  const { response, document } = await render(identity,'?view=history');
  assert.equal(response.status, 200);
  assert.equal(document.querySelector('#generation-form')!.getAttribute('data-draft-owner'), 'test-'+identity);
  assert.equal(document.querySelectorAll('#create-button').length, 1);
  assert.equal(document.querySelectorAll('script[src="/teachers/generation-v3.js"]').length, 1);
  assert.ok(document.querySelector('#generation-history')!.hasAttribute('open'));
});

test('anonymous history link retains the requested view through sign-in', async()=>{
  const { response }=await render('401','?view=history');
  assert.equal(response.headers.get('location'),'/teachers/login?returnTo=%2Fteachers%2Fgenerate%3Fview%3Dhistory');
});

test('anonymous visitors retain the login redirect and exact generator return path', async () => {
  const { response, html } = await render('401');
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/teachers/login?returnTo=%2Fteachers%2Fgenerate');
  assert.equal(html, '');
});

test('an auth outage remains 503 rather than a false coming-soon or owner page', async () => {
  const { response, html } = await render('503');
  assert.equal(response.status, 503);
  assert.equal(response.headers.has('location'), false);
  assert.equal(html, '');
});
