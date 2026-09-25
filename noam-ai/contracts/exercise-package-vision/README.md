# Exercise-package vision validation — schema freeze

Frozen JSON Schema drafts + fixtures (2026-09-25). **No** live analyzer prompt, publish, Production, or Secrets changes.

See also: peer store plan  
`/cursor/stores/bc-c77217f2-f4a1-47ca-a430-f579bfae047c/docs/exercise-package-vision-validation-contract.md`

## Layout

```
schemas/
  exercise-package.geometry.schema.json
  vision-observation.schema.json
  validation-report.schema.json
fixtures/
  q19-unlabeled-isosceles/   # empty vertex glyphs = valid
  abc-labeled-triangle/      # glyph → package binding
contract-fixtures.test.cjs
```

## Test

```bash
cd noam-ai/contracts/exercise-package-vision
npm install
npm test
```

## Rules encoded

- Package owns semantic point names (`A`–`Z`).
- Vision `vertex_labels` only accepts visible single-letter glyphs; structural layer uses anonymous `n*` / `s*` ids.
- Validator report performs bindings; Q19 bindings have `visible_glyph: null` and basis ≠ `glyph`.
- Mismatch codes + confidence are explicit fields on `ValidationReport`.
