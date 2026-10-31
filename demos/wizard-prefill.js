/** Read the teacher-wizard handoff from the page query. Ids must already exist. */
export function wizardPrefillFromSearch(search) {
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const grade = params.get("grade") || "";
  const topic = params.get("topic") || "";
  const level = params.has("level") ? params.get("level") : "a";
  const minutes = Number(params.get("minutes"));
  const exerciseIds = String(params.get("pick") || "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^ex:[0-9a-f]{32}:[1-9]\d{0,2}[\u05D0-\u05EA]?$/i.test(id) || /^sheet:[0-9a-f]{32}$/i.test(id));
  if (!/^[1-9]$/.test(grade) || !/^\d{1,6}$/.test(topic)) return null;
  if (level !== "a" && level !== "b" && level !== "c" && level !== "all") return null;
  if (params.has("pick") && !exerciseIds.length) return null;
  return {
    grade,
    topic,
    level,
    minutes: minutes >= 5 && minutes <= 180 ? minutes : null,
    exerciseIds,
  };
}

/** Keep the current scope shareable without saving or changing the selection. */
export function replaceWizardScopeUrl(browser, scope) {
  try {
    const grade = String(scope.grade);
    const topic = String(scope.topic);
    const level = String(scope.level);
    if (!/^[1-9]$/.test(grade) || !/^\d{1,6}$/.test(topic)) return false;
    if (!["all", "a", "b", "c"].includes(level)) return false;
    const url = new URL(browser.location.href);
    const values = { grade, topic, level };
    if (Object.entries(values).every(([key, value]) => url.searchParams.get(key) === value && url.searchParams.getAll(key).length === 1)) return false;
    // A handoff pick belongs to its original grade/topic, even for shared PDFs.
    if (url.searchParams.get("grade") !== grade || url.searchParams.get("topic") !== topic) url.searchParams.delete("pick");
    Object.entries(values).forEach(([key, value]) => url.searchParams.set(key, value));
    browser.history.replaceState(browser.history.state, "", url.href);
    return true;
  } catch {
    // History may be unavailable in embedded previews. Selection remains usable.
    return false;
  }
}
