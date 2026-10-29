/** Read the teacher-wizard handoff from the page query. Ids must already exist. */
export function wizardPrefillFromSearch(search) {
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const grade = params.get("grade") || "";
  const topic = params.get("topic") || "";
  const level = params.get("level") || "";
  const minutes = Number(params.get("minutes"));
  const exerciseIds = String(params.get("pick") || "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^ex:[0-9a-f]{32}:\d{1,2}[\u05D0-\u05EA]$/i.test(id) || /^sheet:[0-9a-f]{32}$/i.test(id));
  if (!/^[1-9]$/.test(grade) || !/^\d{1,6}$/.test(topic)) return null;
  if (level !== "a" && level !== "b" && level !== "c") return null;
  if (!exerciseIds.length) return null;
  return {
    grade,
    topic,
    level,
    minutes: minutes >= 5 && minutes <= 180 ? minutes : null,
    exerciseIds,
  };
}
