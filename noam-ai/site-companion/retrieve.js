/**
 * Retrieval over the verified worksheet catalog only.
 * Records are worksheets that already exist. Question numbers are not in the catalog.
 */

const PDF_CDN = "https://static.wixstatic.com/ugd/d8e7ad_";

export function worksheetHref(catalog, grade, topic, level) {
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

  const viewerLevel = level.viewerLevel || (level.key === "one" ? "b" : level.key);
  const params = new URLSearchParams();
  params.set("g", String(topic.routing.sourceGrade || grade.grade));
  params.set("x", String(topic.routing.sourcePrefix || prefix));
  params.set("lv", viewerLevel);
  params.set("pdf", level.pdfId);
  params.set("t", topic.routing.sourceTitle || topic.title);
  const siblings = (topic.routing && topic.routing.siblingPdfQuery) || {};
  for (const key of ["pa", "pb", "pc", "pc2"]) {
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

export function searchTokens(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((part) => part.length >= 2);
}

function tokens(value) {
  return searchTokens(value);
}

export function retrieveRecords(catalog, query, limit, page) {
  const records = buildCatalogRecords(catalog);
  const wanted = tokens(query);
  const cap = Math.max(1, Math.min(8, Number(limit) || 6));
  const namedGrade = focusGrade(query, page);
  if (!wanted.length && namedGrade == null) return records.slice(0, cap);
  const ranked = records
    .map((record) => {
      if (namedGrade != null && record.grade != null && Number(record.grade) !== namedGrade) {
        return { record, score: 0 };
      }
      let score = namedGrade != null && Number(record.grade) === namedGrade ? 6 : 0;
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

const GRADE_MARK = { א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9 };
const TYPE_RANK = { topic: 5, worksheet: 4, hub: 3, game: 3, catalog: 3, loop: 3, page: 2, blog: 1 };

export function gradeMentioned(query) {
  const match = String(query || "").match(/כיתה\s*([1-9אבגדהוזחט])/);
  if (!match) return null;
  const mark = match[1];
  if (/[1-9]/.test(mark)) return Number(mark);
  return GRADE_MARK[mark] || null;
}

/** Grade of the open page, from /kite-grade-9, ?grade=9, or the page title. */
export function pageGrade(page) {
  const path = String((page && page.path) || "");
  const fromSlug = path.match(/grade-(\d+)/);
  if (fromSlug) return Number(fromSlug[1]);
  const fromQuery = path.match(/[?&]grade=(\d+)/);
  if (fromQuery) return Number(fromQuery[1]);
  return gradeMentioned(String((page && page.title) || ""));
}

/** A grade the user named wins. Otherwise stay on the open page. */
export function focusGrade(query, page) {
  const named = gradeMentioned(query);
  if (named != null) return named;
  return pageGrade(page);
}

function guideSearchText(record) {
  return [record.gradeLabel, record.title, record.levelLabel, record.topic, record.contains, record.audience, record.how, record.terms]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function retrieveGuide(guide, query, limit, page) {
  const records = (guide && guide.records) || [];
  const wanted = tokens(query);
  const cap = Math.max(1, Math.min(8, Number(limit) || 6));
  const namedGrade = focusGrade(query, page);
  if (!wanted.length && namedGrade == null) return records.slice(0, cap);
  const ranked = records
    .map((record) => {
      if (namedGrade != null && record.grade != null && Number(record.grade) !== namedGrade) {
        return { record, score: 0 };
      }
      const haystack = guideSearchText(record);
      let score = namedGrade != null && Number(record.grade) === namedGrade ? 6 : 0;
      for (const token of wanted) {
        if (haystack.includes(token)) score += token.length > 3 ? 3 : 1;
        if (String(record.title || "").toLowerCase().includes(token)) score += 4;
      }
      return { record, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => {
      return (
        b.score - a.score ||
        (TYPE_RANK[b.record.type] || 0) - (TYPE_RANK[a.record.type] || 0) ||
        (a.record.grade || 0) - (b.record.grade || 0)
      );
    });
  return ranked.slice(0, cap).map((row) => row.record);
}
