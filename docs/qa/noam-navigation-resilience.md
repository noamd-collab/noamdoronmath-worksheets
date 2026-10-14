# Noam AI navigation resilience

The production browser reproduced a dead end for “איפה יש דפי עבודה על דלתון לכיתה ט?”: “לא הצלחנו להשלים את בדיקת האבטחה. נסו שוב בעוד רגע.” The public navigation request depended on reCAPTCHA and the model service.

The companion now searches a generated public index in the browser before requesting AI. It resolves sections and topic matches, asks for a grade for ambiguous matches, carries that topic into a grade-only follow-up, and retains catalog-based next/previous/group navigation. All links come from the site guide. Teacher building and exercise-help requests retain their existing paths; a failed service request offers real navigation links. No server security or credentials changed.

Preview: https://xpqvc1-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com

Validation:
- 32 focused tests passed (navigation plus existing site companion).
- Fresh public index and JS bundle match build output (`check:site-guide`).
- Wix build succeeded using `.env.local` only; no production release.
- Real browser at 390×844 and 1280×800: kite request displays matching links; following the primary link opens `/kite-grade-9`; next topic from kite is `/parallelogram-grade-9`; blog navigation resolves `/blog`.
- Full deterministic suite is not green: it references absent `reports/m25-blog/pilot-manifest.txt` and requires Chrome in its fixture. Focused checks above are reported separately.
- DeepSeek and Qwen reviews are requested through the repository's existing PR workflow. Their actual outcomes must be checked before release; successful skip jobs are not review approval.

This is based on current `main`. PR #117 remains a separate, open change for the lesson-builder flow and persistent rate limit. This patch does not merge or replace it.
