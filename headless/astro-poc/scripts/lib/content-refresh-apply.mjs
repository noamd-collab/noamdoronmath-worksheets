/**
 * Recoverable (non-atomic) batch apply for content-refresh.
 *
 * Honest contract:
 *   - NOT atomic across files (do not report atomic:true).
 *   - Pre-stages every candidate to a sibling temp, validates, then switches.
 *   - Journal + every-target pre-state: restore existing; remove only run-created.
 *   - Concurrent-run guard via exclusive lock file.
 *   - Rollback errors are collected and reported (never silently escaped).
 *
 * opts.inject (tests only):
 *   failAfterFirstSwitch — throw after first successful dest switch
 *   failDuringTempCopyAt — throw while writing temp for index N (partial temp ok)
 *   failOnNewDestSwitch — throw when switching a dest that did not pre-exist
 */
import fs from 'node:fs';
import path from 'node:path';

export function acquireApplyLock(lockPath) {
  ensureDir(path.dirname(lockPath));
  try {
    const fd = fs.openSync(lockPath, 'wx');
    fs.writeFileSync(
      fd,
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }) + '\n'
    );
    fs.closeSync(fd);
    return { ok: true };
  } catch (e) {
    if (e && e.code === 'EEXIST') {
      let holder = null;
      try {
        holder = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        error: 'CONCURRENT_APPLY_LOCK',
        holder,
      };
    }
    throw e;
  }
}

export function releaseApplyLock(lockPath) {
  try {
    if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
  return { ok: true };
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

/**
 * @param {{
 *   root: string,
 *   applyMaps: Array<{ from: string, to: string }>,
 *   stampDir: string,
 *   lockPath: string,
 *   inject?: {
 *     failAfterFirstSwitch?: boolean,
 *     failDuringTempCopyAt?: number,
 *     failOnNewDestSwitch?: boolean,
 *   },
 * }} opts
 */
export function applyRecoverableBatch(opts) {
  const { root, applyMaps, stampDir, lockPath, inject = {} } = opts;
  const lock = acquireApplyLock(lockPath);
  if (!lock.ok) {
    return {
      performed: false,
      atomic: false,
      recoverableBatch: true,
      reason: 'concurrent apply refused',
      error: lock.error,
      lockHolder: lock.holder || null,
    };
  }

  const journalPath = path.join(stampDir, 'apply-journal.json');
  const manifest = [];
  const temps = [];
  const switched = [];
  const rollbackErrors = [];
  let phase = 'init';

  try {
    ensureDir(stampDir);

    // --- pre-state + backup every existing target BEFORE any live write ---
    phase = 'prestate';
    for (const m of applyMaps) {
      if (!fs.existsSync(m.from)) {
        throw new Error(`APPLY_SOURCE_MISSING:${m.from}`);
      }
      const rel = path.relative(root, m.to);
      const preExisted = fs.existsSync(m.to);
      const backup = preExisted ? path.join(stampDir, 'pre', rel) : null;
      if (preExisted) copyFile(m.to, backup);
      const temp = `${m.to}.m35-apply-tmp`;
      manifest.push({
        from: m.from,
        to: m.to,
        rel,
        preExisted,
        backup,
        temp,
        state: 'prestate',
      });
    }

    fs.writeFileSync(
      journalPath,
      JSON.stringify(
        {
          phase: 'prestate-complete',
          startedAt: new Date().toISOString(),
          entries: manifest.map((e) => ({
            rel: e.rel,
            preExisted: e.preExisted,
            state: e.state,
          })),
        },
        null,
        2
      ) + '\n'
    );

    // --- stage complete candidates into sibling temps; validate ---
    phase = 'temp-stage';
    for (let i = 0; i < manifest.length; i++) {
      const e = manifest[i];
      if (inject.failDuringTempCopyAt === i) {
        // Simulate interrupted/failed copy: write partial then throw
        ensureDir(path.dirname(e.temp));
        fs.writeFileSync(e.temp, 'PARTIAL_INJECTED_FAILURE\n');
        temps.push(e.temp);
        e.state = 'temp-partial';
        throw new Error(`INJECT_FAIL_DURING_TEMP_COPY:${i}`);
      }
      copyFile(e.from, e.temp);
      const fromBuf = fs.readFileSync(e.from);
      const tempBuf = fs.readFileSync(e.temp);
      if (fromBuf.length !== tempBuf.length || !fromBuf.equals(tempBuf)) {
        throw new Error(`TEMP_VALIDATE_MISMATCH:${e.rel}`);
      }
      temps.push(e.temp);
      e.state = 'temp-ready';
    }

    fs.writeFileSync(
      journalPath,
      JSON.stringify(
        {
          phase: 'temp-stage-complete',
          entries: manifest.map((e) => ({ rel: e.rel, preExisted: e.preExisted, state: e.state })),
        },
        null,
        2
      ) + '\n'
    );

    // --- switch temps into place (recoverable batch; not cross-file atomic) ---
    phase = 'switch';
    for (let i = 0; i < manifest.length; i++) {
      const e = manifest[i];
      if (inject.failOnNewDestSwitch && !e.preExisted) {
        throw new Error(`INJECT_FAIL_ON_NEW_DEST:${e.rel}`);
      }
      ensureDir(path.dirname(e.to));
      fs.renameSync(e.temp, e.to);
      e.state = 'switched';
      switched.push(e);
      // temp consumed by rename
      const ti = temps.indexOf(e.temp);
      if (ti >= 0) temps.splice(ti, 1);

      if (inject.failAfterFirstSwitch && switched.length === 1) {
        throw new Error('INJECT_FAIL_AFTER_FIRST_SWITCH');
      }
    }

    // Refresh last-good/current pointer copies from successful new live files
    phase = 'last-good-pointer';
    const currentPtr = path.join(path.dirname(stampDir), 'current');
    for (const e of manifest) {
      copyFile(e.to, path.join(currentPtr, e.rel));
    }

    fs.writeFileSync(
      journalPath,
      JSON.stringify(
        {
          phase: 'complete',
          finishedAt: new Date().toISOString(),
          entries: manifest.map((e) => ({ rel: e.rel, preExisted: e.preExisted, state: e.state })),
        },
        null,
        2
      ) + '\n'
    );

    releaseApplyLock(lockPath);
    return {
      performed: true,
      atomic: false,
      recoverableBatch: true,
      files: manifest.map((e) => ({
        from: path.relative(root, e.from),
        to: e.rel,
        preExisted: e.preExisted,
      })),
      lastGoodStamp: path.relative(root, stampDir),
      lastGood: path.relative(root, path.join(path.dirname(stampDir), 'current')),
      journal: path.relative(root, journalPath),
    };
  } catch (e) {
    // Recovery: restore pre-existing; remove only run-created destinations; scrub temps
    phase = `rollback-from-${phase}`;
    for (const e of switched.slice().reverse()) {
      try {
        if (e.preExisted && e.backup && fs.existsSync(e.backup)) {
          copyFile(e.backup, e.to);
          e.state = 'restored';
        } else if (!e.preExisted && fs.existsSync(e.to)) {
          fs.unlinkSync(e.to);
          e.state = 'removed-created';
        }
      } catch (re) {
        rollbackErrors.push({
          rel: e.rel,
          action: e.preExisted ? 'restore' : 'remove-created',
          error: String(re && re.message ? re.message : re),
        });
      }
    }
    for (const t of temps) {
      try {
        if (fs.existsSync(t)) fs.unlinkSync(t);
      } catch (re) {
        rollbackErrors.push({ rel: t, action: 'unlink-temp', error: String(re && re.message ? re.message : re) });
      }
    }
    // Destinations never switched but somehow created — nothing to do (temps scrubbed)
    try {
      fs.writeFileSync(
        journalPath,
        JSON.stringify(
          {
            phase,
            failedAt: new Date().toISOString(),
            error: String(e && e.stack ? e.stack : e),
            entries: manifest.map((x) => ({
              rel: x.rel,
              preExisted: x.preExisted,
              state: x.state,
            })),
            rollbackErrors,
          },
          null,
          2
        ) + '\n'
      );
    } catch (je) {
      rollbackErrors.push({ rel: journalPath, action: 'write-journal', error: String(je && je.message ? je.message : je) });
    }

    const unlock = releaseApplyLock(lockPath);
    if (!unlock.ok) {
      rollbackErrors.push({ rel: lockPath, action: 'release-lock', error: unlock.error });
    }

    return {
      performed: false,
      atomic: false,
      recoverableBatch: true,
      rolledBack: true,
      reason: 'apply failed; attempted pre-state recovery',
      error: String(e && e.stack ? e.stack : e),
      rollbackErrors: rollbackErrors.length ? rollbackErrors : undefined,
      journal: fs.existsSync(journalPath) ? path.relative(root, journalPath) : undefined,
    };
  }
}
