/**
 * Recoverable-batch apply safety — injected failures must restore last-good.
 * Does not claim cross-file atomicity.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  applyRecoverableBatch,
  acquireApplyLock,
  releaseApplyLock,
} from '../scripts/lib/content-refresh-apply.mjs';

describe('M35 content-refresh recoverable apply', () => {
  let root;
  let stampDir;
  let lockPath;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'm35-apply-'));
    stampDir = path.join(root, 'stamp');
    lockPath = path.join(root, '.apply.lock');
    fs.mkdirSync(path.join(root, 'live'), { recursive: true });
    fs.mkdirSync(path.join(root, 'proposed'), { recursive: true });
  });

  afterEach(() => {
    releaseApplyLock(lockPath);
    fs.rmSync(root, { recursive: true, force: true });
  });

  function seedExisting(name, content) {
    const to = path.join(root, 'live', name);
    fs.writeFileSync(to, content);
    return to;
  }

  function stageProposed(name, content) {
    const from = path.join(root, 'proposed', name);
    fs.writeFileSync(from, content);
    return from;
  }

  it('concurrent lock refuses second apply', () => {
    const a = acquireApplyLock(lockPath);
    assert.equal(a.ok, true);
    const b = acquireApplyLock(lockPath);
    assert.equal(b.ok, false);
    assert.equal(b.error, 'CONCURRENT_APPLY_LOCK');
    releaseApplyLock(lockPath);
  });

  it('successful apply does not report atomic:true', () => {
    const to1 = seedExisting('a.json', '{"v":1}');
    const to2 = seedExisting('b.json', '{"v":1}');
    const maps = [
      { from: stageProposed('a.json', '{"v":2}'), to: to1 },
      { from: stageProposed('b.json', '{"v":2}'), to: to2 },
    ];
    const r = applyRecoverableBatch({ root, applyMaps: maps, stampDir, lockPath });
    assert.equal(r.performed, true);
    assert.equal(r.atomic, false);
    assert.equal(r.recoverableBatch, true);
    assert.equal(fs.readFileSync(to1, 'utf8'), '{"v":2}');
    assert.equal(fs.readFileSync(to2, 'utf8'), '{"v":2}');
  });

  it('fail after first switch restores first target to pre-state', () => {
    const to1 = seedExisting('a.json', 'LAST_GOOD_A');
    const to2 = seedExisting('b.json', 'LAST_GOOD_B');
    const maps = [
      { from: stageProposed('a.json', 'NEW_A'), to: to1 },
      { from: stageProposed('b.json', 'NEW_B'), to: to2 },
    ];
    const r = applyRecoverableBatch({
      root,
      applyMaps: maps,
      stampDir,
      lockPath,
      inject: { failAfterFirstSwitch: true },
    });
    assert.equal(r.performed, false);
    assert.equal(r.rolledBack, true);
    assert.equal(r.atomic, false);
    assert.equal(fs.readFileSync(to1, 'utf8'), 'LAST_GOOD_A');
    assert.equal(fs.readFileSync(to2, 'utf8'), 'LAST_GOOD_B');
    assert.equal(fs.existsSync(lockPath), false);
  });

  it('fail during temp copy leaves live destinations unchanged', () => {
    const to1 = seedExisting('a.json', 'LAST_GOOD_A');
    const to2 = seedExisting('b.json', 'LAST_GOOD_B');
    const maps = [
      { from: stageProposed('a.json', 'NEW_A'), to: to1 },
      { from: stageProposed('b.json', 'NEW_B'), to: to2 },
    ];
    const r = applyRecoverableBatch({
      root,
      applyMaps: maps,
      stampDir,
      lockPath,
      inject: { failDuringTempCopyAt: 1 },
    });
    assert.equal(r.performed, false);
    assert.equal(fs.readFileSync(to1, 'utf8'), 'LAST_GOOD_A');
    assert.equal(fs.readFileSync(to2, 'utf8'), 'LAST_GOOD_B');
    assert.ok(!fs.existsSync(to1 + '.m35-apply-tmp'));
    assert.ok(!fs.existsSync(to2 + '.m35-apply-tmp'));
  });

  it('fail on new destination removes created file; existing sibling restored', () => {
    const to1 = seedExisting('a.json', 'LAST_GOOD_A');
    const toNew = path.join(root, 'live', 'new-only.json');
    assert.equal(fs.existsSync(toNew), false);
    const maps = [
      { from: stageProposed('a.json', 'NEW_A'), to: to1 },
      { from: stageProposed('new-only.json', 'CREATED'), to: toNew },
    ];
    const r = applyRecoverableBatch({
      root,
      applyMaps: maps,
      stampDir,
      lockPath,
      inject: { failOnNewDestSwitch: true },
    });
    assert.equal(r.performed, false);
    assert.equal(r.rolledBack, true);
    assert.equal(fs.readFileSync(to1, 'utf8'), 'LAST_GOOD_A');
    assert.equal(fs.existsSync(toNew), false);
  });
});
