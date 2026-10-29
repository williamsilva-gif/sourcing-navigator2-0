# Tax Impact Check — Phase 1 delivery

## Added implementation
- `src/lib/taxImpact/core.ts`: actual XLSX reader; merged two-level header handling; explicit Single/Double mapping; locale numbers, percentages, included charges, string CNPJ and dates; row errors and provenance; SHA-256 hashes; conservative matching; deterministic comparisons.
- `src/lib/taxImpact.functions.ts`: authenticated, tenant-authorized list/create/import/compare/history/original-link functions. Parses original bytes again server-side. No privileged client for ordinary operations.
- `src/components/taxImpact/{TaxImpactPage,ImportPanel,ResultsPanel}.tsx`: per-client analyses, uploads, sheet/header choice, mapping, explicit confirmation, previews, optional reusable mapping profiles, immutable imports/revisions, manual matching and combinable network/hotel/status filters.
- `src/routes/_taxAuthenticated.tsx` and `_taxAuthenticated.tax-impact-check.tsx`: isolated client-only protected surface at `/tax-impact-check`, without changing the legacy SSR authenticated layout.
- Sidebar: one additive TA-only navigation entry. Existing routes and rate-loading worker unchanged.

## Applied backend
- `drizzle/migrations/0004_tax_impact_phase_one.sql`: four new tables (analyses, imports, revisions, mapping profiles), composite tenant foreign keys, grants, operation-specific RLS, `tax_impact_access`, indexes and private storage policies.
- `drizzle/migrations/0005_tax_impact_storage_scope_qualification.sql`: explicitly qualifies `storage.objects.name` inside policy subqueries to avoid collision with analysis `name`.
- Private bucket `tax-impact-originals`, 10 MB maximum per file. No public bucket. Signed original links expire in 60 seconds.
- Generated backend types refreshed by the migration tool.
- Access requires authenticated TA master/staff, visible existing tenant and existing module override rules for `tax_impact_check`. No access granted to ordinary tenant admins.

## Verification
- `bunx vitest run tests/taxImpact.core.test.ts tests/taxImpact.security.integration.test.ts tests/rateLoading.comparator.test.ts`: **53 passed** (18 core, 6 real backend security, 29 existing comparator regression).
- Automatic preview builds: `build OK`; no manual build invoked because the platform runs it automatically.
- Authenticated browser: create named analysis → upload actual baseline/proposal XLSX with AA:AR merged group on row 1 and specifics on row 2 → confirm proposal column `Renegociada 2026` for year 2027 → validate → save → compare → read 400→448, +48/+12%, independent missing Double and LRA→NLRA warning → reopen saved revision successfully.
- Desktop screenshot checked; mobile 390×844 had no document horizontal overflow after module-scoped clipping. The existing global header still has crowded mobile account actions; not modified because outside scope.
- No browser page errors. Synthetic browser analyses were clearly labelled and removed after checks; no demo rows remain as client data. Temporary security accounts/rows/files cleaned up.

## Deliberate limitations / future phases
- No fiscal arithmetic, tax reform exposure, TCU/Senado/legislation fetching, PDF/Excel reports, annual savings or room-night volume modelling. Marked “em desenvolvimento”; no fake action buttons.
- No RFP dependency, no BAR inference, no travel agency/intermediation fees.
- Parser accepts XLSX only; bounded to 10 MB compressed / 50 MB expanded, 50 sheets, 200 columns and 10,000 data rows per sheet. Numeric percentage interpretation follows 0.05→5%, 5→5%, 5%→5%.
- Currency and tax/service basis must be known and equivalent to aggregate comparable rates; missing/unknown/changed charges make price deltas incomparable rather than creating speculative tax calculations.
- Header detection is heuristic with a manual row override; mappings are explicit and reviewable. The user's original Deloitte workbook was not supplied this turn; verified with a structurally faithful generated XLSX fixture, not the real proprietary file.
- No dedicated new admin module toggle UI; existing backend module override semantics are honored, initial access remains TA-only.
- Existing page metadata inconsistencies elsewhere were inspected but not changed, honoring strict preservation of other modules.
- No publication, external API spend, or worker changes.