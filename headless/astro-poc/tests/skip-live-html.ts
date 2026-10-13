/**
 * GitHub Actions sets CI=true.
 * Live HTML checks still run locally when CI is unset.
 */
export function skipLiveHtmlInCi(reason: string): string | false {
  if (process.env.CI === 'true') {
    return `Skipped in CI (CI=true): ${reason} Unset CI to run it locally.`;
  }
  return false;
}
