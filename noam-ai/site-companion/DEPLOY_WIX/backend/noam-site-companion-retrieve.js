/**
 * Retrieval over the verified worksheet catalog only.
 * Records are worksheets that already exist. Question numbers are not in the catalog.
 */

const PDF_CDN = "https://static.wixstatic.com/ugd/d8e7ad_";

function worksheetHref(catalog, grade, topic, level) {
  const pdfDirect = PDF_CDN + level.pdfId + ".pdf";
  const viewerEnabled = !!(catalog.config && catalog.config.viewer && catalog.config.viewer.enabled);
  const middle = ((catalog.config && catalog.config.middleGrades) || []).map(Number);
  const prefix = topic.routing && topic.routing.resolvedNoamPrefix;
  const usesViewer =
    viewerEnabled &&
    !!prefix &&
    middle.includes(Number(grade.grade)) &&
    !!(topic.routing && topic.routing.usesViewer);
  if (!usesViewer) return pdfDirect;

  const viewerLevel = level.key === "one" ? "b" : level.key;
  const params = new URLSearchParams();
  params.set("g", String(grade.grade));
  params.set("x", String(prefix));
  params.set("lv", viewerLevel);
  params.set("pdf", level.pdfId);
  params.set("t", topic.title);
  const siblings = (topic.routing && topic.routing.siblingPdfQuery) || {};
  for (const key of ["pa", "pb", "pc"]) {
    if (siblings[key]) params.set(key, siblings[key]);
  }
  const topicParam = topic.parent !== undefined ? topic.parent : topic.id;
  params.set("topic", String(topicParam));
  params.set("back", "/worksheets?grade=" + encodeURIComponent(String(grade.grade)));
  const viewerPath = (catalog.config.viewer && catalog.config.viewer.path) || "worksheet-viewer-noam.html";
  return "/" + String(viewerPath).replace(/^\//, "") + "?" + params.toString();
}

export function buildCatalogRecords(catalog) {
  const records = [];
  const grades = (catalog && catalog.grades) || [];
  for (const grade of grades) {
    const termBucket =
      (catalog.searchTerms && catalog.searchTerms[String(grade.grade)]) || {};
    for (const topic of grade.topics || []) {
      const extra = termBucket[String(topic.id)] || "";
      for (const level of topic.levels || []) {
        if (!/^[0-9a-f]{32}$/i.test(String(level.pdfId || ""))) continue;
        records.push({
          id: "g" + grade.grade + "-t" + topic.id + "-" + level.key,
          grade: grade.grade,
          gradeLabel: grade.label,
          topicId: topic.id,
          title: topic.title,
          description: topic.description || "",
          levelKey: level.key,
          levelLabel: level.label,
          pdfId: level.pdfId,
          href: worksheetHref(catalog, grade, topic, level),
          searchText: [grade.label, topic.title, topic.description || "", level.label, extra]
            .join(" ")
            .toLowerCase(),
        });
      }
    }
  }
  return records;
}

function tokens(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((part) => part.length >= 2);
}

export function retrieveRecords(catalog, query, limit) {
  const records = buildCatalogRecords(catalog);
  const wanted = tokens(query);
  const cap = Math.max(1, Math.min(8, Number(limit) || 6));
  if (!wanted.length) return records.slice(0, cap);
  const ranked = records
    .map((record) => {
      let score = 0;
      for (const token of wanted) {
        if (record.searchText.includes(token)) score += token.length > 3 ? 3 : 1;
        if (record.title.toLowerCase().includes(token)) score += 4;
      }
      return { record, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.record.grade - b.record.grade || a.record.topicId - b.record.topicId);
  return ranked.slice(0, cap).map((row) => row.record);
}
