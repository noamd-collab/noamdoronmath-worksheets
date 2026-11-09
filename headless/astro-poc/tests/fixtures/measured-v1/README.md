# Measured geometry fixtures

These files are test evidence, not approved worksheets or public media. Every fixture has `fixture.json` with the exact SHA-256 of the source, HTML, final PDF, measured layout and adapter draft. `publishable` remains false. A synthetic Wix identifier is assigned only by the test harness, with `syntheticTestFixture: true`; normal catalog ingestion rejects it.

- `a05-B`: immutable elementary pilot snapshot, 8 questions / 40 parts. Tests merged arithmetic table rows and the independently measured shared table header.
- `b28-E`: immutable geometry pilot snapshot, 8 questions / 40 parts. Tests a shared figure, its original owner and distinct part cells.
- `synthetic-dependency`: isolated copy of that geometry source, with an explicit question-2 → question-1 dependency and a test worksheet identity. It was independently rendered to a new PDF/layout and does not alter the pilot. This fixture tests dependency transport, not pedagogic validity.
- `synthetic-split`: a small physically rendered PDF with question, item and inline answer content continuing across multiple pages. The bright backgrounds and English tokens make missing, clipped or reordered fragments visible. Six parts retain distinct IDs.

The recorded layout was produced from the same WeasyPrint Document that wrote its PDF, with the final postprocessing digest. The site adapter verifies these bindings before the fixtures are consumed. Test preparation additionally checks each exported crop and role against the raw measured layout and rejects missing records.

Run `node --import tsx --test tests/teacher-measured-geometry.test.ts` for contract checks. Run `node tests/inspect-measured-print.mjs /absolute/evidence/output` for desktop/mobile screenshots. The visual harness extracts the production PDF verifier, slicers, packer and canvas painter, serving test bytes on loopback only. It does not install a public route or add a catalog entry.
