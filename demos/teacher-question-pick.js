/* Local whole-question picker. No network and no model call. */

export const QUESTION_COUNTS = [5, 15, 20];

export function exerciseKey(question) {
  const pdfId = question && question.source && question.source.pdfId ? question.source.pdfId : '';
  return 'ex:' + pdfId + ':' + (question && question.id != null ? question.id : '');
}

export function questionNumber(question) {
  if (question && Number.isFinite(Number(question.q))) return Number(question.q);
  const match = String(question && question.id != null ? question.id : '').match(/^(\d+)/);
  return match ? Number(match[1]) : 0;
}

export function questionGroupKey(question) {
  const pdfId = question && question.source && question.source.pdfId ? question.source.pdfId : '';
  return pdfId + ':' + questionNumber(question);
}

export function shortfallNote(available) {
  return `יש פחות שאלות מהבקשה. נבחרו כל ${available} השאלות הזמינות.`;
}

export function groupWholeQuestions(pool) {
  const groups = [];
  const index = new Map();
  (pool || []).forEach((question, order) => {
    if (!question) return;
    const key = questionGroupKey(question);
    let group = index.get(key);
    if (!group) {
      group = {
        key,
        order,
        number: questionNumber(question),
        page: question.page || 0,
        pdfId: question.source && question.source.pdfId ? question.source.pdfId : '',
        questions: [],
      };
      index.set(key, group);
      groups.push(group);
    }
    group.questions.push(question);
  });
  return groups;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    cryptoApi.getRandomValues(buf);
    return buf[0] || 1;
  }
  return (Math.floor(Math.random() * 0x100000000) >>> 0) || 1;
}

function shuffle(list, random) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = copy[i];
    copy[i] = copy[j];
    copy[j] = swap;
  }
  return copy;
}

function spreadGroups(groups, count, random) {
  const buckets = new Map();
  groups.forEach((group) => {
    const bucketKey = group.pdfId + ':' + group.page;
    if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
    buckets.get(bucketKey).push(group);
  });
  const names = shuffle([...buckets.keys()], random);
  names.forEach((name) => {
    buckets.set(name, shuffle(buckets.get(name), random));
  });
  const chosen = [];
  const used = new Set();
  let guard = 0;
  while (chosen.length < count && guard <= groups.length) {
    let progressed = false;
    names.forEach((name) => {
      if (chosen.length >= count) return;
      const next = buckets.get(name).find((group) => !used.has(group.key));
      if (!next) return;
      used.add(next.key);
      chosen.push(next);
      progressed = true;
    });
    if (!progressed) break;
    guard += 1;
  }
  chosen.sort((a, b) => a.order - b.order);
  return chosen;
}

export function pickWholeQuestions(pool, count, random = Math.random) {
  const requested = Number(count);
  const groups = groupWholeQuestions(pool);
  if (!Number.isInteger(requested) || requested <= 0 || !groups.length) {
    return { keys: [], questionCount: 0, requested: requested || 0, available: groups.length, shortfall: false, note: '' };
  }
  const shortfall = groups.length < requested;
  const target = Math.min(requested, groups.length);
  const chosen = spreadGroups(groups, target, random);
  const keys = chosen.flatMap((group) => group.questions.map(exerciseKey));
  return {
    keys,
    questionCount: chosen.length,
    requested,
    available: groups.length,
    shortfall,
    note: shortfall ? shortfallNote(groups.length) : '',
  };
}

export function expandToWholeQuestionKeys(pool, keys) {
  const wanted = new Set(keys || []);
  return groupWholeQuestions(pool)
    .filter((group) => group.questions.some((question) => wanted.has(exerciseKey(question))))
    .flatMap((group) => group.questions.map(exerciseKey));
}
