"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "index.html"), "utf8");
const context = {};
for (const name of ["DATA", "NOAM_PREFIX_FALLBACK"]) {
  const start = source.indexOf("var " + name + " = ");
  const end = source.indexOf("\n};", start) + 3;
  assert.ok(start >= 0 && end > start);
  vm.runInNewContext(source.slice(start, end), context);
}

test("every linked middle-school PDF has a usable matching Noam AI manifest", () => {
  let count = 0;
  for (const grade of [7, 8, 9]) {
    const data = context.DATA[grade];
    for (const topic of data.topics) {
      const prefix = topic.x || (context.NOAM_PREFIX_FALLBACK[grade] || {})[topic.id];
      for (const [level, pdf] of Object.entries(data.links[topic.id])) {
        if (!["a", "b", "c", "one"].includes(level)) continue;
        const label = `${grade}/${topic.id}/${level}`;
        const manifestPath = path.join(root, "noam-ai", "manifests", pdf + ".json");
        assert.ok(fs.existsSync(manifestPath), `Missing AI map for ${label}: ${pdf}`);
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        assert.equal(manifest.pdfHash, pdf, label);
        assert.equal(manifest.grade, grade, label);
        assert.equal(manifest.prefix, prefix, label);
        assert.equal(manifest.levelCode, level === "a" ? "A" : level === "c" ? "E" : "B", label);
        assert.ok(manifest.pageCount > 0, label);
        assert.ok(manifest.exercises.length > 0, `Empty AI map: ${label}`);
        assert.equal(new Set(manifest.exercises.map(e => e.id)).size, manifest.exercises.length, label);
        assert.equal(manifest.reviewRequired, false, `Unreviewed AI map: ${label}`);
        for (const exercise of manifest.exercises) {
          assert.ok(exercise.id.startsWith(prefix + "-" + manifest.levelCode + "-Q"), label);
          assert.ok(exercise.pin.page >= 1 && exercise.pin.page <= manifest.pageCount, label);
          for (const crop of exercise.crops || [exercise.crop]) {
            assert.ok(crop.page >= 1 && crop.page <= manifest.pageCount, label);
            assert.ok(crop.x >= 0 && crop.y >= 0 && crop.w > 0 && crop.h > 0, label);
            assert.ok(crop.x + crop.w <= 1.00001 && crop.y + crop.h <= 1.00001, label);
          }
        }
        count++;
      }
    }
  }
  assert.equal(count, 449, "Middle-school coverage changed");
});
