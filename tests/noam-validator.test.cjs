const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const validator = path.join(repoRoot, "tools", "validate.js");
const indexFile = path.join(repoRoot, "index.html");

function validate(file) {
  return spawnSync(process.execPath, [validator, file], { encoding: "utf8" });
}

test("intentional child worksheet levels do not create false missing-level warnings", () => {
  const result = validate(indexFile);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.doesNotMatch(result.stdout, /נושא 4[123].*חסר קישור רמה/);
});

test("a declared child level still warns when its link is missing", () => {
  const source = fs.readFileSync(indexFile, "utf8");
  const changed = source.replace(
    /41:\s*\{\s*"?a"?:\s*"[0-9a-f]{32}"\s*\}/,
    "41: {}"
  );
  assert.ok(changed !== source, "fixture replacement must match the catalog source");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "noam-validator-"));
  const file = path.join(dir, "index.html");
  fs.writeFileSync(file, changed);
  try {
    const result = validate(file);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /נושא 41.*חסר קישור רמה "a"/);
    assert.doesNotMatch(result.stdout, /נושא 41.*חסר קישור רמה "[bc]"/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function validateDataChange(change) {
  const { loadIndexCatalog } = require("../scripts/lib/headless-catalog.cjs");
  const source = fs.readFileSync(indexFile, "utf8");
  const raw = loadIndexCatalog(indexFile);
  change(raw.DATA);
  const start = source.indexOf("var DATA = {");
  const end = source.indexOf("\n};", start) + 3;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "noam-validator-"));
  const file = path.join(dir, "index.html");
  fs.writeFileSync(file, source.slice(0, start) + "var DATA = " + JSON.stringify(raw.DATA) + ";" + source.slice(end));
  try { return validate(file); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test("undeclared duplicate PDFs remain errors", () => {
  const result = validateDataChange((data) => {
    delete data[9].links[23].sourceGrade;
    delete data[9].links[23].sourcePrefix;
    delete data[9].links[23].sourceTitle;
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /מזהה PDF כפול/);
});

for (const [name, mutation] of [
  ["wrong source prefix", (row) => { row.sourcePrefix = "G7-T99"; }],
  ["incomplete source levels", (row) => { delete row.b; }],
  ["wrong source level", (row) => { row.a = row.b; }],
]) {
  test("declared reuse rejects " + name, () => {
    const result = validateDataChange((data) => mutation(data[9].links[23]));
    assert.equal(result.status, 1);
    assert.match(result.stdout, /מקור שימוש חוזר לא תואם/);
  });
}

test("additional c2 levels are validated", () => {
  const result = validateDataChange((data) => { data[8].links[43].c2 = "bad"; });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /c2.*hex32/);
});
