/**
 * Page-aware starter links for the compact bar.
 * The current page is never offered. Home does not offer «בית».
 */
const HEBREW_GRADE = { 7: "ז׳", 8: "ח׳", 9: "ט׳" };

function pathOf(href) {
  try {
    const url = new URL(href, "https://www.noamdoronmath.co.il");
    return url.pathname.replace(/\/$/, "") || "/";
  } catch (error) {
    return "";
  }
}

export function starterLinksFor(kind, pathname, hrefFor) {
  const here = String(pathname || "/").replace(/\/$/, "") || "/";
  const link = typeof hrefFor === "function" ? hrefFor : (path) => path;
  let catalog = [
    { label: "דפי עבודה", href: link("/worksheets") },
    { label: "כיתה ט׳", href: link("/grade-9") },
    { label: "בלוג", href: link("/blog") },
  ];
  if (kind === "topic") {
    const grade = (String(pathname || "").match(/grade-(\d+)/) || [])[1];
    catalog = [{ label: "דפי עבודה", href: link("/worksheets") }];
    if (grade && HEBREW_GRADE[grade]) {
      catalog.push({ label: "כיתה " + HEBREW_GRADE[grade], href: link("/grade-" + grade) });
    }
  } else if (kind === "worksheet") {
    catalog = [
      { label: "דפי עבודה", href: link("/worksheets") },
      { label: "בית", href: link("/") },
    ];
  } else if (kind === "teachers") {
    catalog = [
      { label: "דפי עבודה", href: link("/worksheets") },
      { label: "כיתה ט׳", href: link("/grade-9") },
    ];
  } else if (kind !== "home") {
    catalog = [
      { label: "דפי עבודה", href: link("/worksheets") },
      { label: "בית", href: link("/") },
    ];
  }
  const found = [];
  const seen = {};
  for (const item of catalog) {
    if (!item || seen[item.href]) continue;
    const itemPath = pathOf(item.href);
    if (itemPath === here) continue;
    if (kind === "home" && (item.label === "בית" || itemPath === "/")) continue;
    seen[item.href] = true;
    found.push(item);
  }
  return found.slice(0, 3);
}
