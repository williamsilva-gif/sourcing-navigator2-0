# Architecture rules
- Tax Impact Check lives in its own library/components and protected named route; reuse existing app shell without changing other modules.
- Original spreadsheets use a dedicated private bucket, while immutable imports and comparison revisions reference tenant-scoped analyses; this preserves provenance and reproducibility.
- Parse spreadsheets and compute comparisons again in authenticated server functions with the caller's RLS client; client previews are not authoritative.