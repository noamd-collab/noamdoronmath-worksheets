# Lossless companion data packing

The authoritative `src/data/site-guide.v1.json` and `src/data/teacher-pick-index.json` stay unchanged. A deterministic build step compresses their complete original UTF-8 bytes into `companion-worker-data.json`. Each descriptor pins SHA-256, byte length, kind and record count. The generated pack stays inside the worker; there is no new CDN request, asset origin, route, model, permission or deployment-budget exception.

`prebuild` generates the pack after both sources, and `predev` captures the existing source files before dev startup. `check:companion-data` and the tests detect stale output. The generator verifies byte-for-byte decompression before writing. Tests compare every parsed field and every original byte; counts alone are not the acceptance criterion.

The worker loads both objects only when the existing companion handler reaches data-dependent work. Teacher authorization stays in the route. OPTIONS, missing-secret responses, origin rejection, rate limits and rate probes precede loading. The existing deterministic guide/CAPTCHA/model order is preserved. Legacy callers without the optional loader use their original direct data. No caller-provided payload can supply the loader.

Each pack has one shared Promise per isolate. Successful cold and concurrent calls reuse the same parsed object; warm calls perform no decompression. A rejected load clears the Promise, allowing the next call to retry. Decompression output is limited to the pinned byte length, SHA-256 is checked before JSON parse, and errors expose only a fixed availability message. A new decode failure returns the existing bounded `UNAVAILABLE` body with HTTP 503. It does not call a model, alter CAPTCHA handling, or retry a user request automatically.

The parsed objects still consume runtime memory. This change reduces deployment payload, not the logical data set or the need for runtime memory. Local Node cold/warm timings are diagnostics, not measurements of a deployed Wix isolate.

Before deployment, retain ordinary full CI, independent review and a real preview smoke test. No publication is authorized by these local results.
