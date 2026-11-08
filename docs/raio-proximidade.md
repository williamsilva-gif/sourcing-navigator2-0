# Raio & Proximidade

Isolated `/raio-proximidade`, TA master/staff gate and server authorization; `client_tenant_id` RLS. No existing RFP/client data is changed. Private `proximity-originals` stores immutable uploaded bytes; job metadata preserves file hash, sheet, mapping, row and all original cells. No confidential Claro addresses are seeded.

## Execution
Upload XLSX/CSV; import each actual sheet as hotel/office/store with explicit mapping. Multi-file selection + Anexo II is supported by successive imports. Counts compare actual imports to expected 397/666/135/28; discrepancies are warnings, never synthesized rows. City RN sums >=100; missing RN data is visibly unconfirmed. Ibis is outside target; Block List flags remain in comparisons. Historical and duplicate codes remain visible but inactive pending corrected imports/review.

Authenticated requests claim a 90-second database lease and process up to five deduplicated physical addresses sequentially, saving after each unique address. Database gate throttles chunks to 1.5 seconds; transient provider statuses retry up to three attempts with persisted exponential delay. Provider/network/credential errors pause and retain checkpoints. Browser orchestrates requests; no scheduler: closing the page stops new chunks, current chunk finishes, reopening can continue. Cancel/pause checked between addresses. No admin client bypass.

Existing Google integration uses a directly supplied server key; isolated module reuses its configured `GOOGLE_MAPS_API_KEY` without exposing it. If a gateway-backed connection is configured, explicitly set `PROXIMITY_GOOGLE_GATEWAY=true`; credentials stay server-only. This does not modify existing geocoding callers. Google billing applies. Live Google tests are disallowed in the agent sandbox by platform instructions; presence of the key does not prove API authorization or results. User must validate on an authorized deployed origin.

## Conservative results
City/UF/CEP/country/number and Google precision are checked. Partial and approximate/center results remain review and do not enter valid pairs. Place-ID re-query retains originals and applies the same validation; it does not label arbitrary coordinates as verified. Santo Amaro only normalizes to São Paulo if the address explicitly includes São Paulo.

Every valid same-city pair is retained; office/store nearest is definitive only if every active category unit in the city is valid. Incomplete catalogs themselves cannot be proven complete without authoritative inputs; expected counts remain warnings. Explicit no-local-unit fallback uses same UF and is always provisional. Boundaries ±100m are flagged. Optional Google Routes computes top 3 per category for one hotel at a time, with separate road km; authorization/enablement errors do not alter straight radius. No map requested or enabled.

Excel reflects filters, originals, codes, addresses/CEP, coordinates/confidence, pair distances, provisional status, road-distance availability and provenance. No fake 397 rows. Original full spreadsheets remain private.

## Verification
Focused synthetic fixture: 2 hotels, 3 offices and 1 store; deterministic rule tests and authenticated UI import/export persistence checks. Actual verification results are appended after execution.