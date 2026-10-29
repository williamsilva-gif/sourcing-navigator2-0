# Architecture rules
- Tax Impact Check lives in its own library/components and protected named route; reuse existing app shell without changing other modules.
- Original spreadsheets use a dedicated private bucket, while immutable imports and comparison revisions reference tenant-scoped analyses; this preserves provenance and reproducibility.
- Parse spreadsheets and compute comparisons again in authenticated server functions with the caller's RLS client; client previews are not authoritative.
- Use an isolated client-only pathless auth layout for Tax Impact Check because the existing authenticated layout redirects during SSR; do not change existing routes to resolve that legacy behavior.
- Keep tax hypotheses, historical-volume parsing and report generation in isolated Tax Impact libraries; simulation settings are analysis-scoped and do not mutate immutable comparison revisions.
- Daily official-source checks use tenant-scoped database leases and fixed outbound URLs; only the authorized server may write verification-cache statuses to prevent browser forgery, and an unconfirmed Senate resolution never changes the rule automatically.