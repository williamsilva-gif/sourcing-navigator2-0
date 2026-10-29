# Tax Impact Check v1.1 — implemented scope and verification

## Delivered
- Isolated deterministic per-night Single/Double hypotheses: regular-lodging CBS 6.72%, IBS 0.06%, persistent ISS, commercial service separate. Unknown inclusion/regime/ISS blocks inference; Simples blocks regular-tax conclusions. Inclusive model is explicitly a nominal-share proxy, not statutory assessment; extra model assumes a user-confirmed net common base. Included service stays unsegregated, never zero liability.
- Comfort unit test: 253.67 → 261.79; cumulative neutral 262.67, residual −0.88; CBS 17.59, IBS 0.16, ISS 13.09. Illustrative 9.25% neutral 246.57, residual 15.22.
- Historical XLSX/CSV importer with sheet selection (prefers Base Volume), manual mapping, preview, confirmation, private original, actual SHA-256 and server reparse with caller RLS. 20,000-row cap, existing 10 MB/private bucket. Immutable imports; latest volume dataset selected by default.
- Weighted ADR = transaction sum / nights sum. FY2025, Jan–May2025/2026 and estimated FY2026/2027 are separate. Per-hotel thresholds, portfolio fallback, missing-2026 restriction, growth −50..100%, explicitly undefined mix default, 100% Single/Double intervals.
- City Single cap, max increase, benefit-loss and optional neutral-target decisions; no automatic status approval. Internal same-city benchmark is not external market pricing.
- Filtered KPI, projections, city/network/hotel/status/match filtering, detailed decomposition, persisted settings, two presets. Existing revisions are untouched.
- Browser-generated PDF and Excel downloads, actual files with active selections, SIMULADO label, assumptions, volume summary, composition for both occupancies, calculation formulas/caches, official links and source status/version.
- Daily tenant-scoped São Paulo date cache with primary-key conflict/lease claims. Fixed official URLs, bounded response/timeouts, no user URL/secret frontend. Only server after caller TA/tenant checks writes cache using privileged client; normal volume/analysis reads/writes use caller RLS. TCU retrieval failed validation in live execution; Senate page retrieved but applicable resolution is not reliably parsed. Both remain explicitly unverified; no rate auto-update.

## Migrations
- `0006_tax_impact_v11.sql`: volume imports, analysis settings, daily verification cache, claim function, additive CSV/volume storage insert policy; GRANT + RLS + composite tenant FKs.
- `0007_tax_impact_source_cache_integrity.sql`: revoke browser cache mutations/claim; server-only write integrity. Existing modules, tables and revisions preserved.

## Authenticated demo evidence
- Analysis: `1f016230-a9a9-4bb4-bb64-7e2b41779698`; existing revision: `28433258-f483-4d3e-a73c-cd6dbd75fd87`; Travel Academy tenant only.
- Preserved 472+472 tariff imports, 466 matched, 6 new, 6 removed.
- Synthetic volume import: `1095c7dd-4f42-431c-9551-61a48c7802bc`, 13,279 rows, zero errors, original stored privately. It represents two demo hotels, not the actual Deloitte transaction file or its 1,657 properties. Synthesized aggregate counts: 24,174 FY25 nights, 10,109 Jan–May25 and 11,461 Jan–May26; 27,407 estimated FY26. Financial values invented and visibly labelled.
- Actual browser file input upload, manual confirmation, save, persisted re-read; Arco-Íris 400→448 and 460→515.20 (+12%), settings saved/reopened, mix slider boundary, PDF/Excel download and file inspection, desktop/mobile capture; no page errors in successful final flow.
- Tests: core/Deloitte/v1.1/Rate Loading comparator; lint of new files; preview automated build OK. No manual production build/typecheck or publishing. No manually created Git commit (platform-managed).

## Remaining limits — not claimed complete
- Original `Volume 2025 e 2026 - Deloitte.xlsx` is not available in this environment; upload required to verify real spend, quality and coverage.
- Senate resolution discovery/parsing is not complete. TCU live validation was unavailable. Daily checks deliberately fail safely, never claim an official definitive rate.
- Nominal inclusive proxy cannot establish legal tax basis, credits, causal price increase or net supplier liability. No actual hotel regime was validated by CNPJ.
- Volume ambiguity is excluded rather than assigned manually; a dedicated human volume-crossmatch editor is not implemented. No optional FY2025-only extrapolation preset or numeric data-quality score yet (categorical quality/fallback shown).
- No annual manager target field, per-hotel regime override or cancellation-column importer yet; max increase/city cap/neutral hypothesis are available.
- PDF includes executive table, occupancy composition and assumptions; no graphical charts embedded. Excel includes calculated/cached formulas for deltas, neutral proxy and volume projection; not every derived amount is an editable formula.
- Existing unrelated routes' incomplete metadata was not changed, respecting the explicit no-other-module scope.

Preview: `/tax-impact-check` → Travel Academy → DEMO Deloitte | 2026 vs 2027 | SIMULAÇÃO.