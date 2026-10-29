/** Site controls take precedence over the device's default motion preference. */
export function sitePrefersReducedMotion() {
  const html = document.documentElement;
  if (html.classList.contains('noam-a11y-motion') || html.classList.contains('nd-motion-off') || html.dataset.ndMotion === 'off') return true;
  if (html.classList.contains('nd-motion-enabled') || ['full', 'relaxed', 'calm'].includes(html.dataset.ndMotion)) return false;
  // Lesson animations play by default. The device setting alone (Safari reports
  // macOS "Reduce motion") no longer freezes them; the site's own controls do.
  return false;
}
