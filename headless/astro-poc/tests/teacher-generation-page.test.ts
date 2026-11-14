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
const file = new URL('../src/pages/teachers/generate.astro', import.meta.url);

// Render the real page's server branches. Authentication itself has separate
// request/token tests; this fixture substitutes only its four possible results
// and the shared site shell, so it never contacts Auth, a worker or a model.
const component = (async () => {
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
        export async function requireOwnerTeacher(request) {
          const result = request.headers.get('x-test-access');
          if (result === 'owner') return {ok:true,userId:'test-owner',expiresAt:9999999999};
          const status = Number(result);
          if (![401,403,503].includes(status)) throw new Error('Missing access fixture');
          return {ok:false,status};
        }
      ` }));
      builder.onResolve({ filter: /\?astro&type=style/ }, args => ({ path: args.path, namespace: 'style' }));
      builder.onLoad({ filter: /.*/, namespace: 'style' }, () => ({ contents: '', loader: 'js' }));
      builder.onResolve({ filter: /^astro\/(compiler-runtime|runtime\/)/ }, args => ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }));
    } }],
  });
  return (await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)).default;
})();

async function render(access: 'owner' | '401' | '403' | '503') {
  const container = await AstroContainer.create();
  const response = await container.renderToResponse(await component, {
    request: new Request('https://teachers.test/teachers/generate', { headers: { 'x-test-access': access } }),
  });
  for (const [key, value] of Object.entries(TEACHER_PRIVATE_HEADERS)) assert.equal(response.headers.get(key), value);
  const html = await response.text();
  return { response, html, document: parseHTML(html).document };
}

test('a denied visitor receives coming-soon HTML and existing-tools link, never the owner form or scripts', async () => {
  const { response, document, html } = await render('403');
  assert.equal(response.status, 403);
  assert.match(document.querySelector('title')!.textContent, /בקרוב/);
  assert.equal(document.querySelector('#coming-soon-title')!.textContent, 'יצירת דפי עבודה חדשים עם AI');
  assert.match(document.querySelector('main')!.textContent, /כלי המורים הקיימים זמינים לכם כרגיל/);
  assert.equal(document.querySelector('main a')!.getAttribute('href'), '/teachers/start');
  assert.equal(document.querySelector('main')!.getAttribute('dir'), 'rtl');
  assert.equal(document.querySelectorAll('form,script,#generation-plan,#generation-jobs').length, 0);
  assert.doesNotMatch(html, /generation\.js|generation\.css|supabase-2|noam-learning-config|גישה אישית לנועם/);
});

test('the authorized owner still receives the complete generation flow', async () => {
  const { response, document } = await render('owner');
  assert.equal(response.status, 200);
  assert.equal(document.querySelectorAll('#generation-form').length, 1);
  assert.equal(document.querySelectorAll('#create-button').length, 1);
  assert.equal(document.querySelectorAll('script[src="/teachers/generation.js"]').length, 1);
  assert.equal(document.querySelectorAll('#coming-soon-title').length, 0);
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
