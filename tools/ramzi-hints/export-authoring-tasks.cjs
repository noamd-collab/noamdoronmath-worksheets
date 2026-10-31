#!/usr/bin/env node
"use strict";

// Mechanical source export only. This tool never generates hints, calls a
// provider, changes the catalogue/SQL/ledger, or accesses a database.
//
// node tools/ramzi-hints/export-authoring-tasks.cjs --out /private/run --stage q01
// --stage q02plus or all exports later parts in grade 7, 8, 9 order.
// --inventory-only writes metadata, not private question packets.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const builder = require("./build-ramzi-hints.cjs");

const REPO = path.resolve(__dirname, "../..");
const GRADES = [7, 8, 9];
const PDF_RE = /^[a-f0-9]{32}$/;
const SHA_RE = /^[a-f0-9]{64}$/;
const PREFIX_RE = /^G[789]-T\d{2}$/;
const SOURCE_URL_RE = /^\/noam-ai\/native\/[A-Z0-9-]+\/[abc]\/noam-ai\.json$/;
const PRIVATE_FIELD_RE = /^(?:solutions?|full_?solution|final_?answers?|answer_?key|answers?|model_?answer|solution_?steps)$/i;
const DRAWING_WARNING = "SVG/layout and native visual-model coordinates are drawing metadata, not given mathematical measurements. Only printed labels and explicit question/item givens establish givens.";
const hash = value => createHash("sha256").update(value).digest("hex");
const readJson = file => JSON.parse(fs.readFileSync(file, "utf8"));
const text = value => Array.isArray(value) ? value.join(" ") : String(value == null ? "" : value);
const increment = (counts, key) => { counts[key] = (counts[key] || 0) + 1; };
const taskStage = question => Number(question) === 1 ? "q01" : "q02plus";

function writeAtomic(file, value, mode = 0o600) {
  const temporary = file + "." + process.pid + ".tmp";
  try {
    fs.writeFileSync(temporary, value, { mode, flag: "wx" });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function option(argv, name, fallback) {
  const i = argv.indexOf(name);
  if (i < 0) return fallback;
  if (!argv[i + 1] || argv[i + 1].startsWith("--")) throw new Error("Missing value for " + name);
  return argv[i + 1];
}

function sourceClone(value, removed, pointer = "") {
  if (Array.isArray(value)) return value.map((item, i) => sourceClone(item, removed, pointer + "/" + i));
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (PRIVATE_FIELD_RE.test(key)) { removed.push(pointer + "/" + key); continue; }
    out[key] = sourceClone(item, removed, pointer + "/" + key);
  }
  return out;
}

function localSource(repo, relative) {
  if (typeof relative !== "string" || relative.includes("\\") || relative.includes("\0")) throw new Error("unsafe_source_path");
  const file = path.resolve(repo, relative.replace(/^\//, ""));
  const fromRepo = path.relative(repo, file);
  if (fromRepo === ".." || fromRepo.startsWith(".." + path.sep) || path.isAbsolute(fromRepo)) throw new Error("unsafe_source_path");
  if (fs.existsSync(file)) {
    const actual = fs.realpathSync(file), root = fs.realpathSync(repo), rel = path.relative(root, actual);
    if (rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel)) throw new Error("source_symlink_outside_repository");
  }
  return file;
}

function rowAvailable(row, unit) {
  if (!row || row.status !== "verified" || row.source_pdf_hash !== unit.pdfHash ||
      (unit.nativeSha256 && row.source_native_sha256 !== unit.nativeSha256) ||
      (row.source_exercise_sha256 && row.source_exercise_sha256 !== unit.sourceExerciseSha256)) return false;
  return Array.isArray(row.hints) && row.hints.length === 3 &&
    row.hints.every(item => typeof item === "string" && item.trim() && item.length <= 600);
}

function currentUnits(repo, bank) {
  const catalogFile = path.join(repo, "headless/astro-poc/src/data/catalog.v1.json");
  const builderCatalog = path.join(repo, "headless/catalog/catalog.v1.json");
  if (hash(fs.readFileSync(catalogFile)) !== hash(fs.readFileSync(builderCatalog))) throw new Error("Current viewer and builder catalogues differ");
  const catalog = readJson(catalogFile), byPdf = new Map(), issues = [];
  for (const grade of catalog.grades) for (const topic of grade.topics || []) for (const level of topic.levels || []) {
    const pdf = level.pdfId;
    if (!PDF_RE.test(pdf || "")) { issues.push({ reason: "invalid_catalog_pdf", catalogGrade: grade.grade }); continue; }
    const published = path.join(repo, "headless/astro-poc/public/noam-ai/manifests", pdf + ".json");
    const original = path.join(repo, "noam-ai/manifests", pdf + ".json");
    const manifestFile = fs.existsSync(published) ? published : original;
    if (!fs.existsSync(manifestFile)) { issues.push({ reason: "missing_current_manifest", pdfHash: pdf, catalogGrade: grade.grade }); continue; }
    const bytes = fs.readFileSync(manifestFile), manifest = JSON.parse(bytes.toString("utf8"));
    if (!GRADES.includes(Number(manifest.grade || grade.grade))) continue;
    const context = { catalogGrade: grade.grade, topic: topic.title,
      ownerPrefix: topic.noamTopicId || (topic.routing || {}).resolvedNoamPrefix || "",
      levelKey: level.viewerLevel || level.key, usesViewer: Boolean((topic.routing || {}).usesViewer) };
    const sheet = byPdf.get(pdf) || { pdf, manifest, manifestFile, manifestSha256: hash(bytes), contexts: [],
      published: fs.existsSync(published), mirrorMatches: fs.existsSync(original) && hash(fs.readFileSync(original)) === hash(bytes) };
    if (!sheet.contexts.some(x => JSON.stringify(x) === JSON.stringify(context))) sheet.contexts.push(context);
    byPdf.set(pdf, sheet);
  }
  const units = [], seen = new Set();
  for (const sheet of byPdf.values()) {
    const m = sheet.manifest, prefix = String(m.prefix || ""), exs = Array.isArray(m.exercises) ? m.exercises : [];
    const valid = exs.filter(ex => String(ex.id || "").startsWith(prefix + "-") && builder.SITE_ID_RE.test(String(ex.id || "")));
    // The existing builder owns supported level codes, including a distinct E2
    // when the runtime supports it. Never fold an E2 source into E.
    const runtimeMapping = sheet.published && PREFIX_RE.test(prefix) && builder.SITE_ID_RE.test(prefix + "-" + m.levelCode + "-Q01א") &&
      m.pdfHash === sheet.pdf && valid.length > 0 && new Set(valid.map(ex => ex.id.split("-Q")[0])).size === 1;
    for (const ex of exs) {
      const id = String(ex.id || ""), key = sheet.pdf + ":" + id;
      if (!id || seen.has(key)) continue;
      seen.add(key);
      const selectedText = text(ex.text), sourceExerciseSha256 = selectedText.trim() ? builder.sourceTaskHash(selectedText) : null;
      const unit = { key, grade: Number(m.grade), pdfHash: sheet.pdf, nativeSha256: m.nativeExportSha256 || null,
        sourceExerciseSha256, exerciseId: id, question: ex.q, part: ex.part || "", stage: taskStage(ex.q),
        prefix, level: m.levelCode, sheet, exercise: ex, runtimeMapping: runtimeMapping && valid.includes(ex) };
      unit.available = rowAvailable(bank.get(id), unit);
      units.push(unit);
    }
  }
  units.sort((a, b) => a.grade - b.grade || a.prefix.localeCompare(b.prefix, "en", { numeric: true }) ||
    a.level.localeCompare(b.level, "en") || Number(a.question) - Number(b.question) || a.exerciseId.localeCompare(b.exerciseId, "he"));
  return { units, issues, catalogSha256: hash(fs.readFileSync(catalogFile)), byPdf };
}

function figureRefs(value) {
  const out = [];
  if (!value || typeof value !== "object") return out;
  for (const name of ["figure_id", "figure_ids"]) {
    const values = Array.isArray(value[name]) ? value[name] : [value[name]];
    for (const id of values) if (typeof id === "string" && id && !out.includes(id)) out.push(id);
  }
  return out;
}

function figureSummary(figure) {
  const labels = new Set(), types = {};
  const objects = [...(Array.isArray(figure.objects) ? figure.objects : []),
    ...(figure.visual_model && Array.isArray(figure.visual_model.objects) ? figure.visual_model.objects : [])];
  for (const object of objects) {
    if (!object || /^(?:answer|solution|hidden)$/i.test(String(object.role || ""))) continue;
    const type = String(object.type || object.kind || "unknown"); increment(types, type);
    if (typeof object.text === "string" && /text|label/i.test(type)) labels.add(object.text);
  }
  return { id: figure.id, question: figure.question || null, view: figure.view || null,
    kind: figure.visual_model && figure.visual_model.kind || null, printed_label_candidates: [...labels],
    object_type_counts: types, coordinate_warning: DRAWING_WARNING };
}

function sourcePacket(repo, unit, nativeCache) {
  const m = unit.sheet.manifest, ex = unit.exercise;
  if (!unit.runtimeMapping) return { reason: "unsupported_runtime_mapping" };
  if (!unit.sheet.mirrorMatches) return { reason: "manifest_mirror_mismatch" };
  if (!unit.sourceExerciseSha256) return { reason: "missing_selected_task" };
  if (!SOURCE_URL_RE.test(m.nativeExportUrl || "") || !SHA_RE.test(m.nativeExportSha256 || "")) return { reason: "missing_pinned_native_source", needs_image: true };
  let native = nativeCache.get(m.nativeExportUrl + ":" + m.nativeExportSha256);
  if (!native) {
    const file = localSource(repo, m.nativeExportUrl);
    const pub = localSource(repo, "headless/astro-poc/public" + m.nativeExportUrl);
    if (!fs.existsSync(file) || !fs.existsSync(pub)) return { reason: "missing_native_file", needs_image: true };
    const bytes = fs.readFileSync(file);
    if (hash(bytes) !== m.nativeExportSha256 || hash(fs.readFileSync(pub)) !== m.nativeExportSha256) return { reason: "native_hash_mismatch" };
    native = { file, data: JSON.parse(bytes.toString("utf8")) };
    nativeCache.set(m.nativeExportUrl + ":" + m.nativeExportSha256, native);
  }
  const data = native.data;
  // The repaired current T40 manifests use T40 exercise IDs, but their pinned
  // source packages retain the historical T32 package metadata. This exception
  // is bound to the exact current T40 path and verified bytes above; it never
  // makes a T40 page consume a T32 manifest, exercise ID or prepared hint.
  const t40MetadataAlias = unit.prefix === "G9-T40" && data.package === "G9-T32" &&
    /^\/noam-ai\/native\/G9-T40\/[abc]\/noam-ai\.json$/.test(m.nativeExportUrl);
  if ((data.package !== unit.prefix && !t40MetadataAlias) || (m.nativeLevel && data.level !== m.nativeLevel)) return { reason: "native_package_or_level_mismatch" };
  const questions = (data.questions || []).filter(q => q.id === ex.nativeQuestionId);
  if (questions.length !== 1) return { reason: "missing_or_ambiguous_native_question", needs_image: true };
  const q = questions[0], items = Array.isArray(q.items) ? q.items : [], selected = items.filter(item => item.id === ex.nativeItemId);
  if (selected.length !== 1 || String(selected[0].label || "") !== String(ex.part || "")) return { reason: "missing_or_ambiguous_native_item", needs_image: true };
  const item = selected[0], nativeText = text(item.text);
  if (!nativeText.trim() || builder.sourceTaskHash(nativeText) !== unit.sourceExerciseSha256) return { reason: "manifest_native_task_mismatch", needs_image: true };
  const previous = items.slice(0, items.indexOf(item)), refs = new Set([...figureRefs(q), ...figureRefs(item)]);
  for (const sibling of previous) for (const id of figureRefs(sibling)) refs.add(id);
  if (typeof ex.nativeFigureId === "string" && ex.nativeFigureId) refs.add(ex.nativeFigureId);
  const figures = [], images = [];
  for (const id of refs) {
    const matches = (data.figures || []).filter(figure => figure.id === id);
    if (matches.length !== 1 || (matches[0].question && matches[0].question !== q.id)) return { reason: "missing_or_ambiguous_referenced_figure", figure_id: id, needs_image: true };
    const figure = matches[0];
    if (typeof figure.svg !== "string" || !/^figures\/[A-Za-z0-9_.-]+\.svg$/.test(figure.svg)) return { reason: "missing_source_svg_reference", figure_id: id, needs_image: true };
    const svg = localSource(repo, path.relative(repo, path.join(path.dirname(native.file), figure.svg)));
    if (!fs.existsSync(svg)) return { reason: "missing_source_svg", figure_id: id, needs_image: true };
    const svgBytes = fs.readFileSync(svg), svgSha = hash(svgBytes);
    const published = localSource(repo, path.join("headless/astro-poc/public", path.relative(repo, svg)));
    if (!fs.existsSync(published) || hash(fs.readFileSync(published)) !== svgSha) return { reason: "source_svg_mirror_mismatch", figure_id: id, needs_image: true };
    const svgText = svgBytes.toString("utf8");
    if (!/<svg\b/.test(svgText) || /<script\b|<foreignObject\b|\bon[a-z]+\s*=|(?:href|src)\s*=\s*["'](?:https?:|file:|data:)/i.test(svgText)) return { reason: "unsupported_active_svg", figure_id: id, needs_image: true };
    figures.push(figureSummary(figure)); images.push({ path: svg, sha256: svgSha, figure_id: id });
  }
  const removed = [], source = {
    manifest_selected_text: text(ex.text), manifest_context: text(ex.context), manifest_prompt: text(ex.prompt),
    native_question_id: q.id, native_item_id: item.id, stem: sourceClone(q.text, removed, "/stem"),
    native_package_metadata: data.package, current_native_export_url: m.nativeExportUrl,
    package_metadata_alias: t40MetadataAlias ? "current_T40_path_retains_T32_metadata" : null,
    given: sourceClone(q.given || [], removed, "/given"), table: sourceClone(q.table || null, removed, "/table"),
    to_prove: sourceClone(q.to_prove || [], removed, "/to_prove"),
    to_construct: sourceClone(q.to_construct || [], removed, "/to_construct"),
    selected_item: sourceClone(item, removed, "/selected_item"),
    previous_parts: previous.map(sibling => sourceClone(sibling, removed, "/previous_parts/" + sibling.id)),
    prerequisites_policy: "Previous parts are source context and possible prerequisites, not assumed completed results.",
    relevant_figures: figures, coordinate_warning: DRAWING_WARNING,
    manifest_vision_metadata: { needsVision: Boolean(ex.needsVision), requiresVision: Boolean(ex.requiresVision),
      no_native_figure_references: refs.size === 0 },
    curriculum: sourceClone(data.curriculum || {}, removed, "/curriculum"),
    excluded_private_field_paths: removed
  };
  // Native questions may also carry printed examples, variable definitions
  // and support metadata. Preserve every additional question field instead of
  // silently dropping context needed for authoring. Private answer/solution
  // fields are excluded by the same recursive filter as the core fields.
  const coreQuestionFields = new Set(["id", "label", "text", "figure_id", "figure_ids", "given", "table", "to_prove", "to_construct", "items"]);
  const additional = Object.fromEntries(Object.entries(q).filter(([key]) => !coreQuestionFields.has(key)));
  if (Object.keys(additional).length) source.native_additional_context = sourceClone(additional, removed, "/native_additional_context");
  const packet = { schema_version: 1, exercise_id: unit.exerciseId, grade: unit.grade, question: Number(unit.question),
    part: unit.part, topic: m.topic || unit.prefix, stage: unit.stage,
    source_pdf_hash: unit.pdfHash, source_native_sha256: unit.nativeSha256,
    source_exercise_sha256: unit.sourceExerciseSha256, manifest_sha256: unit.sheet.manifestSha256,
    source, images };
  packet.packet_sha256 = hash(JSON.stringify(packet));
  return { packet };
}

function inventory(repo = REPO) {
  const bankFile = path.join(repo, "learning/ramzi-hints.json"), bankBytes = fs.readFileSync(bankFile), bankRows = JSON.parse(bankBytes.toString("utf8"));
  const bank = new Map(bankRows.map(row => [row.exercise_id, row]));
  if (bank.size !== bankRows.length) throw new Error("Existing bank has duplicate IDs; refusing an authoring export");
  const current = currentUnits(repo, bank), unsupported = [], blocked = [], ready = [], nativeCache = new Map();
  const builderSite = builder.loadSite(repo);
  const identity = new Map();
  for (const unit of current.units.filter(unit => unit.runtimeMapping)) {
    const signatures = identity.get(unit.exerciseId) || new Set(); signatures.add(unit.pdfHash + ":" + unit.nativeSha256 + ":" + unit.sourceExerciseSha256); identity.set(unit.exerciseId, signatures);
  }
  const byGrade = Object.fromEntries(GRADES.map(grade => [grade, { total: 0, preserved: 0, q01: { missing: 0, exportable: 0, unsupported_mapping: 0, blocked_source: 0 }, q02plus: { missing: 0, exportable: 0, unsupported_mapping: 0, blocked_source: 0 } }]));
  for (const unit of current.units) {
    const grade = byGrade[unit.grade]; grade.total++;
    const meta = { exercise_id: unit.exerciseId, grade: unit.grade, question: unit.question, part: unit.part,
      stage: unit.stage, source_pdf_hash: unit.pdfHash, source_native_sha256: unit.nativeSha256, source_exercise_sha256: unit.sourceExerciseSha256 };
    if (unit.available) { grade.preserved++; continue; }
    const counts = grade[unit.stage]; counts.missing++;
    if (!unit.runtimeMapping) { counts.unsupported_mapping++; unsupported.push({ ...meta, reason: "unsupported_runtime_mapping" }); continue; }
    // Existing rows are never sent for replacement, including stale or invalid rows.
    if (bank.has(unit.exerciseId)) { counts.blocked_source++; blocked.push({ ...meta, reason: "existing_bank_row_requires_separate_revision" }); continue; }
    if (identity.get(unit.exerciseId).size !== 1) { counts.blocked_source++; blocked.push({ ...meta, reason: "ambiguous_current_exercise_id" }); continue; }
    const result = sourcePacket(repo, unit, nativeCache);
    if (!result.packet) { counts.blocked_source++; blocked.push({ ...meta, ...result }); continue; }
    // Reuse the builder's current-catalog binding and exact task fingerprint.
    let binding;
    try {
      binding = builder.bindRows(builderSite, [{ exercise_id: unit.exerciseId,
        topic: unit.sheet.manifest.topic || unit.prefix, source_exercise_text: result.packet.source.manifest_selected_text,
        source_pdf_hash: unit.pdfHash, source_native_sha256: unit.nativeSha256,
        source_exercise_sha256: unit.sourceExerciseSha256 }]).rows[0];
    } catch (error) {
      counts.blocked_source++; blocked.push({ ...meta, reason: "builder_current_binding_rejected" }); continue;
    }
    if (binding.source_exercise_sha256 !== result.packet.source_exercise_sha256) throw new Error("Builder task fingerprint disagrees for " + unit.exerciseId);
    counts.exportable++; ready.push(result.packet);
  }
  let commit = null;
  try { commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim(); } catch (_) { /* Hashes still bind a non-Git fixture. */ }
  return { packets: ready, report: { schema_version: 1, method: "Current catalogue only; physical PDF+exercise deduplication; exact pinned native/selected-task/SVG mirror checks. No model or semantic review.",
    repository_commit: commit, catalogue_sha256: current.catalogSha256, existing_bank_sha256: hash(bankBytes),
    existing_bank_rows: bankRows.length, preserved_current_units: current.units.filter(unit => unit.available).length,
    total_current_units: current.units.length, by_grade: byGrade,
    unsupported_runtime_mapping_count: unsupported.length, unsupported_runtime_mapping: unsupported,
    blocked_source_reason_counts: blocked.reduce((counts, unit) => { increment(counts, unit.reason); return counts; }, {}),
    blocked_source: blocked, catalogue_issues: current.issues,
    tasks: ready.map(packet => ({ exercise_id: packet.exercise_id, grade: packet.grade, question: packet.question,
      part: packet.part, stage: packet.stage, source_pdf_hash: packet.source_pdf_hash,
      source_native_sha256: packet.source_native_sha256, source_exercise_sha256: packet.source_exercise_sha256,
      packet_sha256: packet.packet_sha256, image_count: packet.images.length })) } };
}

function main(argv) {
  const repo = path.resolve(option(argv, "--repo", REPO)), requested = option(argv, "--out", null);
  if (!requested) throw new Error("--out is required and must be outside the public repository");
  const out = builder.privatePacketDirectory(repo, requested), stage = option(argv, "--stage", "q01");
  if (!["q01", "q02plus", "all"].includes(stage)) throw new Error("--stage must be q01, q02plus, or all");
  const { packets, report } = inventory(repo);
  fs.mkdirSync(out, { recursive: true, mode: 0o700 });
  const written = [];
  if (!argv.includes("--inventory-only")) for (const currentStage of ["q01", "q02plus"]) for (const grade of GRADES) {
    if (stage !== "all" && stage !== currentStage) continue;
    const selected = packets.filter(packet => packet.stage === currentStage && packet.grade === grade);
    const name = "stage-" + (currentStage === "q01" ? "1-q01" : "2-q02plus") + "-grade-" + grade + ".jsonl";
    writeAtomic(path.join(out, name), selected.map(packet => JSON.stringify(packet)).join("\n") + (selected.length ? "\n" : ""));
    written.push({ file: name, tasks: selected.length });
  }
  report.written = written;
  writeAtomic(path.join(out, "inventory.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output: out, existing_bank_rows: report.existing_bank_rows, by_grade: report.by_grade,
    unsupported_runtime_mapping_count: report.unsupported_runtime_mapping_count,
    blocked_source_reason_counts: report.blocked_source_reason_counts, written }, null, 2));
}

if (require.main === module) { try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { inventory, currentUnits, sourcePacket, sourceClone, figureRefs, figureSummary, rowAvailable };
