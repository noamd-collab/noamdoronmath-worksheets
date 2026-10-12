/**
 * Didactic topic order for Noam AI.
 * Source of truth: catalog.grades[].groups, then each group's topics in the
 * catalog topics-array order (the worksheets topic list). Child sheets stay
 * inside their parent and are not separate steps.
 * Grade-hub SEO lists are not this order: newer pages are appended there.
 */
import { focusGrade, pageGrade, searchTokens } from "./retrieve.js";

const NEXT_QUESTION = /הנושא הבא|מה אחרי|מה הלאה/;
const PREV_QUESTION = /הנושא הקודם|מה לפני/;
const MAX_CHIPS = 8;

function fold(value) {
  return String(value || "")
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[׳״"']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function bareTitle(value) {
  return fold(value).replace(/^ה/, "");
}

function stem(token) {
  let text = String(token || "");
  if (text.startsWith("ו") && text.length > 3) text = text.slice(1);
  return text.replace(/(ים|ות)$/u, "");
}

function pathOf(value) {
  const raw = String(value || "").split("?")[0].split("#")[0];
  if (raw.length > 1 && raw.endsWith("/")) return raw.slice(0, -1);
  return raw || "";
}

function meaningful(query) {
  return searchTokens(query).filter((token) => token.length >= 4);
}

/**
 * Every parent topic, in the order the worksheets catalog shows them.
 */
export function didacticSequence(catalog) {
  const sequence = [];
  for (const grade of (catalog && catalog.grades) || []) {
    const byGroup = new Map();
    for (const topic of grade.topics || []) {
      if (topic.parent !== undefined && topic.parent !== null) continue;
      const list = byGroup.get(topic.group) || [];
      list.push(topic);
      byGroup.set(topic.group, list);
    }
    let index = 0;
    for (const group of grade.groups || []) {
      for (const topic of byGroup.get(group.key) || []) {
        sequence.push({
          grade: grade.grade,
          gradeLabel: grade.label,
          topicId: topic.id,
          title: topic.title,
          description: topic.description || "",
          groupKey: group.key,
          groupLabel: group.label,
          index,
        });
        index += 1;
      }
    }
  }
  return sequence;
}

function sameTopic(item, record) {
  if (!record || Number(record.grade) !== Number(item.grade)) return false;
  const topic = fold(record.topic);
  return topic === fold(item.title) || bareTitle(record.topic) === bareTitle(item.title);
}

function topicHref(guide, item) {
  const records = (guide && guide.records) || [];
  for (const record of records) {
    if (record.type === "topic" && sameTopic(item, record) && record.href) return record.href;
  }
  return (
    "/worksheets?grade=" +
    encodeURIComponent(String(item.grade)) +
    "&group=" +
    encodeURIComponent(item.groupKey) +
    "&topic=" +
    encodeURIComponent(String(item.topicId))
  );
}

function currentItem(sequence, guide, page) {
  const path = pathOf(page && page.path);
  const records = (guide && guide.records) || [];
  const record = records.find((row) => row.type === "topic" && pathOf(row.href) === path);
  if (record) {
    const found = sequence.find((item) => sameTopic(item, record));
    if (found) return found;
  }
  const grade = pageGrade(page);
  const title = fold(page && page.title);
  if (!title) return null;
  return (
    sequence.find((item) => {
      if (grade != null && Number(item.grade) !== grade) return false;
      const name = fold(item.title);
      return name && title.includes(name);
    }) || null
  );
}

function labelStems(label) {
  return meaningful(label).map(stem).filter((token) => token.length >= 3);
}

function groupScore(groupLabel, queryTokens) {
  const stems = labelStems(groupLabel);
  let score = 0;
  for (const token of queryTokens) {
    const wanted = stem(token);
    if (stems.some((item) => item === wanted || item.includes(wanted) || wanted.includes(item))) score += 3;
  }
  return score;
}

function otherSubjectStems(groupLabel, queryTokens, topics) {
  const matched = new Set(queryTokens.map(stem));
  const titles = topics.map((topic) => fold(topic.title + " " + topic.description));
  return labelStems(groupLabel).filter((token) => {
    if (matched.has(token)) return false;
    return titles.some((hay) => hay.includes(token));
  });
}

function joinTitles(titles) {
  const names = titles.filter(Boolean);
  if (names.length <= 1) return names[0] || "";
  return names.slice(0, -1).join(", ") + " ו" + names[names.length - 1];
}

function chipFor(guide, item) {
  return {
    id: "g" + item.grade + "-t" + item.topicId,
    label: [item.gradeLabel, item.title].filter(Boolean).join(" · "),
    href: topicHref(guide, item),
  };
}

function uniqueChips(items) {
  const chips = [];
  const seenHref = new Set();
  const seenLabel = new Set();
  for (const item of items) {
    if (!item || !item.href || !item.label) continue;
    if (seenHref.has(item.href) || seenLabel.has(item.label)) continue;
    seenHref.add(item.href);
    seenLabel.add(item.label);
    chips.push(item);
    if (chips.length >= MAX_CHIPS) break;
  }
  return chips;
}

function navigationAnswer(current, previous, next) {
  const lines = [];
  if (next) lines.push("הנושא הבא אחרי " + current.title + " הוא " + next.title + ".");
  if (previous) lines.push("הנושא הקודם לפני " + current.title + " הוא " + previous.title + ".");
  return lines.join(" ");
}

/**
 * Answer a "what exists in this group" or next/previous question from the
 * catalog order. Returns null when the message is not that kind of question.
 */
export function suggestTopicGroup(input, catalog, guide) {
  const sequence = didacticSequence(catalog);
  if (!sequence.length) return null;
  const page = (input && input.page) || {};
  const message = String((input && input.message) || "");
  const queryTokens = meaningful(message);
  const grade = focusGrade(message, page);
  const current = currentItem(sequence, guide, page);
  const neighbors = sequence.filter((item) => grade == null || Number(item.grade) === Number(grade));
  const currentIndex = current ? neighbors.findIndex((item) => item.index === current.index && item.grade === current.grade && item.topicId === current.topicId) : -1;
  const previous = currentIndex > 0 ? neighbors[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < neighbors.length - 1 ? neighbors[currentIndex + 1] : null;
  const asksNext = NEXT_QUESTION.test(message);
  const asksPrev = PREV_QUESTION.test(message);

  let best = null;
  if (queryTokens.length && grade != null) {
    const groups = [];
    const seen = new Set();
    for (const item of neighbors) {
      if (seen.has(item.groupKey)) continue;
      seen.add(item.groupKey);
      groups.push(item);
    }
    for (const item of groups) {
      const score = groupScore(item.groupLabel, queryTokens);
      if (!score) continue;
      const preferred = current && current.groupKey === item.groupKey ? 1 : 0;
      if (!best || score + preferred > best.score) {
        best = { score: score + preferred, groupKey: item.groupKey, groupLabel: item.groupLabel };
      }
    }
  }

  if (!best && !(current && (asksNext || asksPrev))) return null;

  if (!best) {
    const answer = navigationAnswer(current, asksPrev ? previous : null, asksNext ? next : null);
    if (!answer) return null;
    const picks = [asksNext ? next : null, asksPrev ? previous : null].filter(Boolean);
    const chips = uniqueChips(picks.map((item) => chipFor(guide, item)));
    return resultFrom(answer, answer, chips);
  }

  const inGroup = neighbors.filter((item) => item.groupKey === best.groupKey);
  const others = otherSubjectStems(best.groupLabel, queryTokens, inGroup);
  const picked = others.length
    ? inGroup.filter((item) => !others.some((token) => fold(item.title + " " + item.description).includes(token)))
    : inGroup;
  const shown = picked.length ? picked : inGroup;
  const names = shown.map((item) => item.title);
  const gradeLabel = neighbors[0] && neighbors[0].gradeLabel ? neighbors[0].gradeLabel : "כיתה " + grade;
  const subject = queryTokens.find((token) => groupScore(best.groupLabel, [token]));
  const where = current && Number(current.grade) === Number(grade) ? " אתם עכשיו בנושא " + current.title + "." : "";
  const nextLine = next ? " הנושא הבא הוא " + next.title + "." : "";
  const prevLine = previous ? " הנושא הקודם הוא " + previous.title + "." : "";
  const answer =
    "כן. ב" +
    gradeLabel +
    (subject ? " יש " + subject + "." : " יש נושאים בקבוצה " + best.groupLabel + ".") +
    " לפי סדר הלימוד באתר: " +
    joinTitles(names) +
    "." +
    where +
    nextLine +
    prevLine;
  const details = [
    "סדר הלימוד ב" + (neighbors[0] ? neighbors[0].gradeLabel : "") + " · " + best.groupLabel,
    ...shown.map((item, index) => index + 1 + ". " + item.title),
    next ? "הנושא הבא: " + next.title : "",
    previous ? "הנושא הקודם: " + previous.title : "",
  ]
    .filter(Boolean)
    .join("\n");
  const chips = uniqueChips(shown.map((item) => chipFor(guide, item)));
  return resultFrom(answer.replace(/\s+/g, " ").trim(), details, chips);
}

function resultFrom(answer, details, chips) {
  return {
    ok: true,
    source: "topic-order",
    model: null,
    answer,
    text: answer,
    details,
    primary: null,
    chips,
    options: chips,
    links: chips.map((chip) => ({
      recordId: chip.id,
      title: chip.label,
      href: chip.href,
      grade: null,
      level: null,
    })),
    essential: [],
    essentialNote: "",
    exportNote: "",
  };
}

export function dedupeActions(actions) {
  const kept = [];
  const seenHref = new Set();
  const seenLabel = new Set();
  for (const action of actions || []) {
    if (!action) continue;
    const href = action.href || "";
    const label = action.label || "";
    if ((href && seenHref.has(href)) || (label && seenLabel.has(label))) continue;
    if (href) seenHref.add(href);
    if (label) seenLabel.add(label);
    kept.push(action);
  }
  return kept;
}
