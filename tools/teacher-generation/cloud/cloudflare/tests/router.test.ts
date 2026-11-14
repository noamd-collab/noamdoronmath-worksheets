import { test } from 'node:test';
import assert from 'node:assert/strict';
import { route, type RouterEnv } from '../src/router.ts';
const key = 'a'.repeat(64);
function fixture() {
  const calls: string[] = [];
  const env: RouterEnv = { TEACHER_CLOUD_OPERATOR_KEY: key, GENERATOR: {
    getByName(name) {
      calls.push(name);
      return Object.fromEntries(['status','preflight','activate','deactivate','tick'].map(action =>
        [action, async () => { calls.push(action); return { mode: 'disabled' }; }])) as any;
    },
  } };
  const request = (path: string, body?: unknown, headers: Record<string,string> = {}) => new Request(
    'https://operator.example' + path, { method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { env, calls, request };
}
test('unknown, unsigned, wrong-key and browser requests never reach a Durable Object', async () => {
  const f = fixture();
  for (const req of [new Request('https://operator.example/operator/status'),
    f.request('/operator/status',undefined,{Authorization:'Bearer '+'b'.repeat(64)}),
    f.request('/operator/status',undefined,{Origin:'https://www.noamdoronmath.co.il'}),
    f.request('/generate',{}), f.request('/operator/tick?job=anything',{})]) {
    assert.equal((await route(req,f.env)).status,404);
  }
  assert.deepEqual(f.calls,[]);
});
test('status is read-only and every operation resolves only the fixed singleton', async () => {
  const f=fixture();
  const result=await route(f.request('/operator/status'),f.env);
  assert.equal(result.status,200); assert.equal(result.headers.get('Cache-Control'),'private, no-store');
  assert.deepEqual(f.calls,['primary','status']);
});
test('extra commands, payloads, oversized input and wrong methods cannot start anything', async () => {
  const f=fixture();
  for (const req of [f.request('/operator/preflight',{command:'echo x'}),
    f.request('/operator/tick',{lesson:{}}), f.request('/operator/deactivate',{padding:'a'.repeat(600)}),
    f.request('/operator/activate',{sourceSha:'a',imageRef:'b',versionId:'c',force:true})]) {
    assert.equal((await route(req,f.env)).status,400);
  }
  assert.equal((await route(f.request('/operator/tick'),f.env)).status,405);
  assert.deepEqual(f.calls,[]);
});
test('explicit fixed operations reach only their matching RPC', async () => {
  for(const action of ['preflight','deactivate','tick']) {
    const f=fixture(); assert.equal((await route(f.request('/operator/'+action,{}),f.env)).status,200);
    assert.deepEqual(f.calls,['primary',action]);
  }
});
test('platform exceptions do not disclose credentials or raw diagnostics',async()=>{
  const f=fixture(); f.env.GENERATOR.getByName=()=>({status:async()=>{throw new Error('secret='+key);}} as any);
  const response=await route(f.request('/operator/status'),f.env);
  assert.equal(response.status,503); assert.equal((await response.text()).includes(key),false);
});
