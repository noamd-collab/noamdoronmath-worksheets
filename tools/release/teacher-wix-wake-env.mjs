#!/usr/bin/env node
// Configuration only. No build, release, wake, job, model or billing operation.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const TARGET = 'teacher-wix-wake-env';
export const REPOSITORY = 'noamd-collab/noamdoronmath-worksheets';
export const SITE_ID = 'df6b8141-b7d5-4d8b-8ba5-e382f5ebfd46';
export const APP_ID = 'e774b8bf-6d43-4041-ae2d-82b04ba6e9e3';
export const NAMES = ['WORKER_URL', 'WORKER_WAKE_SECRET'];
const CLI_PINS = {
  'build/chunk-5XKGOUNA.js': '7e2f35870cea653ec120cba859cbdf9d0f9a726f292fd41e5e1366ce6ad4daa6',
  'build/chunk-EJB7C7MD.js': 'a045369b513c650b222bb79464fcdd0fb7b0068af49e285f2fa545e6745eedd2',
  'build/EnvSetCommand-7B4LXWC2.js': '1ed999d29fe587f4fc2d8b36cd59c1b9d73799945743e8dc24dde72ec8c4f6c7',
};
export class GuardError extends Error { constructor(code) { super(code); this.code = code; } }
function requireThat(ok, code) { if (!ok) throw new GuardError(code); }
function exactKeys(value, keys, code) {
  requireThat(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('|') === [...keys].sort().join('|'), code);
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export function digest(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(canonical(value))).digest('hex');
}
function sha(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value); }
function validUrl(value) { return typeof value === 'string' && /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.onrender\.com\/?$/.test(value); }
export function validatePlan(plan) {
  exactKeys(plan, ['version','target','repository','sourceSha','siteId','appId','environment','workerUrl','wakeSecretSha256','expectedPrevious','renderPlanSha256','renderReceiptSha256'], 'PLAN_SHAPE');
  requireThat(plan.version === 1 && plan.target === TARGET && plan.repository === REPOSITORY
    && plan.siteId === SITE_ID && plan.appId === APP_ID && plan.environment === 'prod', 'WRONG_TARGET');
  requireThat(typeof plan.sourceSha === 'string' && /^[a-f0-9]{40}$/.test(plan.sourceSha), 'SOURCE_SHA_REQUIRED');
  requireThat(validUrl(plan.workerUrl) && sha(plan.wakeSecretSha256) && sha(plan.renderPlanSha256) && sha(plan.renderReceiptSha256), 'INVALID_WAKE_CONFIG');
  exactKeys(plan.expectedPrevious, NAMES, 'PREVIOUS_STATE_REQUIRED');
  requireThat(NAMES.every(k => plan.expectedPrevious[k] === null || sha(plan.expectedPrevious[k])), 'PREVIOUS_STATE_REQUIRED');
  return plan;
}
// Python's existing Render guard uses ensure_ascii=True for canonical receipts.
export function renderDigest(value) {
  return digest(JSON.stringify(canonical(value)).replace(/[\u0080-\uffff]/g, c => '\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')));
}
export function validateRenderProof(plan, values, renderPlan, renderReceipt, runtime) {
  requireThat(renderDigest(renderPlan) === plan.renderPlanSha256 && renderDigest(renderReceipt) === plan.renderReceiptSha256, 'RENDER_PROOF_CHANGED');
  requireThat(renderPlan.target === 'teacher-render-free' && renderPlan.plan === 'free'
    && renderPlan.autoDeployTrigger === 'off' && renderPlan.sourceSha === plan.sourceSha, 'RENDER_PLAN_MISMATCH');
  requireThat(renderReceipt.target === 'teacher-render-free' && renderReceipt.state === 'active'
    && renderReceipt.planSha256 === plan.renderPlanSha256 && renderReceipt.url === plan.workerUrl
    && /^srv-[a-z0-9]{10,32}$/.test(renderReceipt.serviceId || '')
    && /^dep-[a-z0-9]{10,32}$/.test(renderReceipt.liveDeployId || ''), 'ACTIVE_RENDER_RECEIPT_REQUIRED');
  exactKeys(runtime,['WORKER_WAKE_SECRET','TEACHER_GENERATION_SERVICE_KEY','QWEN_API_KEY','QWEN_BASE_URL','QWEN_MODEL'],'RENDER_RUNTIME_SHAPE');
  requireThat(renderDigest(runtime) === renderReceipt.runtimeSha256 && runtime.WORKER_WAKE_SECRET === values.WORKER_WAKE_SECRET, 'RENDER_RUNTIME_MISMATCH');
}
export function validateValues(values, plan) {
  exactKeys(values, NAMES, 'ONLY_TWO_WAKE_KEYS_ALLOWED');
  requireThat(validUrl(values.WORKER_URL) && typeof values.WORKER_WAKE_SECRET === 'string'
    && /^[a-f0-9]{64}$/.test(values.WORKER_WAKE_SECRET), 'INVALID_WAKE_CONFIG');
  requireThat(values.WORKER_URL === plan.workerUrl && digest(values.WORKER_WAKE_SECRET) === plan.wakeSecretSha256, 'PAYLOAD_PLAN_MISMATCH');
}
function isInside(candidate, root) { const rel = path.relative(root, candidate); return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel)); }
function externalPath(file, roots) {
  requireThat(path.isAbsolute(file) && fs.realpathSync(file) === path.resolve(file), 'EXTERNAL_REGULAR_PATH_REQUIRED');
  requireThat(roots.every(root => !isInside(file, fs.realpathSync(root))), 'SECRETS_OUTSIDE_CHECKOUT_REQUIRED');
}
export function readPrivateJson(file, roots) {
  externalPath(file, roots);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const st = fs.fstatSync(fd);
    requireThat(st.isFile() && st.uid === process.getuid() && (st.mode & 0o777) === 0o600 && st.size <= 16384, 'PRIVATE_FILE_REQUIRED');
    try { return JSON.parse(fs.readFileSync(fd, 'utf8')); } catch { throw new GuardError('PRIVATE_JSON_INVALID'); }
  } finally { fs.closeSync(fd); }
}
export function verifySource(repo, plan) {
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], {encoding:'utf8', stdio:['ignore','pipe','pipe'], timeout:10000}).trim();
  const remote = git('remote','get-url','origin');
  requireThat([`https://github.com/${REPOSITORY}.git`, `https://github.com/${REPOSITORY}`, `git@github.com:${REPOSITORY}.git`].includes(remote), 'WRONG_REPOSITORY');
  requireThat(git('rev-parse','HEAD') === plan.sourceSha && git('status','--porcelain') === '', 'CLEAN_EXACT_SOURCE_REQUIRED');
  try { git('merge-base','--is-ancestor',plan.sourceSha,'refs/remotes/origin/headless/astro-poc-baseline'); }
  catch { throw new GuardError('MERGED_SITE_SOURCE_REQUIRED'); }
  const app = path.join(repo,'headless/astro-poc');
  const config = JSON.parse(fs.readFileSync(path.join(app,'wix.config.json'),'utf8'));
  requireThat(config.siteId === SITE_ID && config.appId === APP_ID, 'WRONG_WIX_PROJECT');
  const cli = path.join(app,'node_modules/@wix/cli');
  requireThat(JSON.parse(fs.readFileSync(path.join(cli,'package.json'),'utf8')).version === '1.1.249', 'PINNED_WIX_CLI_REQUIRED');
  for (const [file, hash] of Object.entries(CLI_PINS)) requireThat(crypto.createHash('sha256').update(fs.readFileSync(path.join(cli,file))).digest('hex') === hash, 'CLI_CONTRACT_CHANGED');
  return cli;
}
// The pinned CLI exports its established site-scoped authentication and HTTP
// client. No CLI command/render/error-reporter is invoked, so neither argv nor
// the CLI's raw error logger receives the secret payload. Body/path match its
// own EnvSet operation; returnAllEnvironment is narrowed to false.
export async function createWixTransport(cli, loadModule = spec => import(spec), execArgs = process.execArgv) {
  requireThat(process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'TLS_VERIFICATION_REQUIRED');
  requireThat(!['NODE_DEBUG','NODE_DEBUG_NATIVE','NODE_OPTIONS','DEBUG','SSLKEYLOGFILE','NODE_V8_COVERAGE'].some(k => process.env[k])
    && execArgs.length === 0, 'DEBUG_OR_NODE_HOOKS_NOT_SUPPORTED');
  requireThat(!['HTTPS_PROXY','https_proxy','HTTP_PROXY','http_proxy','ALL_PROXY','all_proxy'].some(k => process.env[k]), 'PROXY_NOT_SUPPORTED');
  const { isLoggedInToAccount, createHttpClient } = await loadModule(pathToFileURL(path.join(cli,'build/chunk-5XKGOUNA.js')).href);
  const auth = await isLoggedInToAccount();
  requireThat(auth && typeof auth.getAccessToken === 'function', 'WIX_AUTH_REQUIRED');
  const client = createHttpClient({type:'backoffice', getAppToken:() => auth.getAccessToken({siteId:SITE_ID}), createHeaders:() => auth.getRequestHeaders?.({siteId:SITE_ID}) || {}});
  const base = `/_api/wix-code-app-environments/v2`;
  const options = {timeout:10000, maxRedirects:0, maxContentLength:1024*1024, maxBodyLength:16384};
  return {
    async read() { return (await client.get(`${base}/app-projects/${APP_ID}/app-environment-variables/environment/prod`,options)).data; },
    async upsert(values) {
      return (await client.post(`${base}/bulk/app-projects/${APP_ID}/app-environment-variables/upsert`, {
        appProjectId:APP_ID, environment:'prod', variables:values, mutability:'STATIC', returnEntity:true, returnAllEnvironment:false,
      },options)).data;
    },
  };
}
function readEnvironment(response) {
  requireThat(response && Array.isArray(response.appEnvironmentVariables), 'ENVIRONMENT_READBACK_INVALID');
  const entries = response.appEnvironmentVariables;
  requireThat(entries.length <= 200 && entries.every(x => x && typeof x.key === 'string' && typeof x.value === 'string')
    && new Set(entries.map(x => x.key)).size === entries.length, 'ENVIRONMENT_READBACK_INVALID');
  return Object.fromEntries(entries.map(x => [x.key,x.value]));
}
function otherDigest(env) { return digest(Object.fromEntries(Object.entries(env).filter(([k]) => !NAMES.includes(k)))); }
export async function provision({plan, values, proof, apply=false, approval, ledger, transportFactory, revalidate=()=>{}}) {
  validatePlan(plan); validateValues(values,plan);
  requireThat(proof, 'RENDER_PROOF_REQUIRED');
  validateRenderProof(plan,values,proof.plan,proof.receipt,proof.runtime); revalidate();
  const planSha256 = digest(plan);
  const receipt = {version:1,target:TARGET,planSha256,sourceSha:plan.sourceSha,siteId:SITE_ID,appId:APP_ID,names:NAMES,publicationPerformed:false,workerWakePerformed:false};
  if (!apply) return {...receipt,state:'dry_run',providerRequests:0};
  requireThat(approval === `NOAM APPROVED WIX WAKE ENV ${planSha256}`, 'EXACT_APPROVAL_REQUIRED');
  requireThat(ledger && transportFactory, 'PRIVATE_LEDGER_REQUIRED');
  const previous = ledger.read();
  requireThat(!previous || (previous.planSha256 === planSha256 && previous.state === 'configured'), 'UNCERTAIN_OR_DIFFERENT_PLAN_STOP');
  if (previous) return {...previous,idempotentReceipt:true};
  let writeStarted = false;
  try {
    const transport = await transportFactory();
    const before = readEnvironment(await transport.read());
    requireThat(NAMES.every(k => (Object.hasOwn(before,k) ? digest(before[k]) : null) === plan.expectedPrevious[k]), 'REMOTE_CONFIG_DRIFT');
    revalidate();
    ledger.write({...receipt,state:'uncertain',attemptedAt:new Date().toISOString()});
    writeStarted = true;
    const response = await transport.upsert(values);
    const metadata = response?.bulkActionMetadata;
    requireThat(metadata && metadata.totalSuccesses === 2 && !metadata.totalFailures && !metadata.undetailedFailures, 'BULK_WRITE_NOT_CONFIRMED');
    const after = readEnvironment(await transport.read());
    requireThat(NAMES.every(k => after[k] === values[k]) && otherDigest(before) === otherDigest(after), 'READBACK_OR_UNRELATED_CONFIG_MISMATCH');
    const complete = {...receipt,state:'configured',configuredAt:new Date().toISOString(),readbackMatched:true,unrelatedEnvironmentUnchanged:true,runtimeActivation:'NOT_VERIFIED'};
    ledger.write(complete);
    return complete;
  } catch (error) {
    if (writeStarted) throw new GuardError('WRITE_OUTCOME_UNCERTAIN_STOP');
    throw error instanceof GuardError ? error : new GuardError('WIX_READ_OR_AUTH_FAILED');
  }
}
export function openLedger(dir, roots) {
  externalPath(dir,roots);
  const st = fs.statSync(dir);
  requireThat(st.isDirectory() && st.uid === process.getuid() && (st.mode & 0o777) === 0o700, 'PRIVATE_LEDGER_DIRECTORY_REQUIRED');
  const lock = path.join(dir,'provision.lock');
  const lockFd = fs.openSync(lock,'wx',0o600); fs.closeSync(lockFd);
  const file = path.join(dir,'current.json');
  return {
    read:() => fs.existsSync(file) ? readPrivateJson(file,roots) : null,
    write(value) {
      if (fs.existsSync(file)) readPrivateJson(file,roots);
      const temp = path.join(dir,`.receipt-${crypto.randomBytes(12).toString('hex')}.json`);
      try { fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600}); fs.renameSync(temp,file); }
      finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
    },
    close:() => fs.unlinkSync(lock),
  };
}
function parseArgs(args) {
  const result = {};
  for (let i=0; i<args.length; i++) {
    const key = args[i];
    requireThat(['--plan','--repo','--input-file','--ledger-dir','--approval','--apply','--render-plan','--render-receipt','--render-runtime'].includes(key) && !Object.hasOwn(result,key), 'ARGUMENTS_INVALID');
    result[key] = key === '--apply' ? true : args[++i];
    requireThat(result[key] !== undefined, 'ARGUMENTS_INVALID');
  }
  requireThat(result['--plan'] && result['--repo'] && result['--render-plan'] && result['--render-receipt'] && result['--render-runtime'], 'PLAN_AND_SOURCE_REQUIRED');
  return result;
}
export async function main(args) {
  let ledger;
  try {
    const opts = parseArgs(args);
    const repo = fs.realpathSync(opts['--repo']);
    const controller = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'));
    const plan = validatePlan(JSON.parse(fs.readFileSync(opts['--plan'],'utf8')));
    const roots = [repo,controller];
    let values;
    if (opts['--input-file']) values = readPrivateJson(opts['--input-file'],roots);
    else {
      requireThat(!process.stdin.isTTY, 'PRIVATE_INPUT_REQUIRED');
      const chunks=[]; let bytes=0;
      for await (const chunk of process.stdin) { bytes+=chunk.length; requireThat(bytes<=16384,'INPUT_TOO_LARGE'); chunks.push(chunk); }
      values=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }
    validateValues(values,plan);
    const loadProof = () => ({plan:readPrivateJson(opts['--render-plan'],roots),receipt:readPrivateJson(opts['--render-receipt'],roots),runtime:readPrivateJson(opts['--render-runtime'],roots)});
    const proof=loadProof();
    const cli = verifySource(repo,plan);
    if (opts['--apply']) {
      requireThat(opts['--approval'] === `NOAM APPROVED WIX WAKE ENV ${digest(plan)}`, 'EXACT_APPROVAL_REQUIRED');
      requireThat(opts['--ledger-dir'], 'PRIVATE_LEDGER_REQUIRED');
      ledger=openLedger(opts['--ledger-dir'],roots);
    }
    const result=await provision({plan,values,proof,apply:!!opts['--apply'],approval:opts['--approval'],ledger,
      transportFactory:()=>createWixTransport(cli),revalidate:()=>{ verifySource(repo,plan); const latest=loadProof(); validateRenderProof(plan,values,latest.plan,latest.receipt,latest.runtime); }});
    process.stdout.write(JSON.stringify(result)+'\n');
    return 0;
  } catch (error) {
    process.stderr.write(JSON.stringify({ok:false,code:error instanceof GuardError ? error.code : 'LOCAL_GUARD_FAILURE'})+'\n');
    return 1;
  } finally { ledger?.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode=await main(process.argv.slice(2));
