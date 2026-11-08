# Worksheet editions

`worksheet-editions.v1.json` is an additive registry for elementary topics.
It is intentionally empty until a complete reviewed three-level package is
ready for publication. Synthetic examples live only under the Astro tests.

`scripts/lib/worksheet-editions.cjs` validates the registry and merges it into
the index-derived export and the Astro catalog loader. The schema describes the
JSON shape; the merger additionally checks topic existence, unique levels,
canonical revision identities, media IDs and PDF hashes. Media IDs may not reuse
any old catalog PDF, including a PDF from another grade.

Each row identifies a grade/topic, an immutable `editionId`, a pupil-facing
`label`, `status`, explicit `isDefault`, and exactly levels `a`, `b`, `c` with
canonical level codes `A`, `B`, `E`. The hashes name the actual PDF, canonical
source, manifest, answer map, Word source and hints bundle. Structural validation
does not itself verify those artifacts or confer review approval.

Only `published` rows reach the public catalog. `draft` and `reviewed` rows are
still validated but never rendered. At most one published row per topic may set
`isDefault: true`; otherwise the default is `legacy`. Withdrawing a publication
also removes an overlay from a previously generated snapshot.

Legacy `topic.levels`, `topic.routing`, topic order, IDs and content stay intact.
`topicEditions()` adds a synthetic legacy option; `resolveEdition()` selects a
default or an explicit available edition. An unknown explicit edition throws.
`buildWorksheetHref()` without `editionId` retains its legacy meaning. UI callers
pass the selected edition explicitly, and new viewer URLs carry that edition
and only its own sibling PDF IDs. The canonical `E` level uses the existing
viewer route parameter `lv=c`.

Learning IDs remain `g1-t5-b` for old PDFs. New IDs append
`-e-<editionId>`. `scripts/build-learning-catalog.cjs --check` and `--dry-run`
do not write files; the exported builder allows callers/tests to inspect the
new entries. The deployed progress catalog, progress storage, database, teacher
catalog and Ramzi consumers are separate integration work. Do not publish a
registry row before those consumers and the actual artifacts are ready.

Verification from `headless/astro-poc`:

```sh
node --import tsx --test tests/worksheet-editions.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tests/tsconfig.editions.json
```

The tests preserve all 169 elementary topics and 507 old links, exercise two
synthetic editions, check unpublished/default/rollback behavior, reject invalid
identity reuse, execute the existing viewer's level-switch function, verify
search links and inspect the card on desktop and phone in an isolated browser.
