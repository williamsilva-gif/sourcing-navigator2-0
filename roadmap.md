# Tax Impact Check — Phase 1
- [x] Isolated tenant/TA-authorized schema and private originals.
- [x] XLSX sheet/header detection, explicit mapping, previews and validation.
- [x] Deterministic matching/comparison and immutable saved revisions.
- [x] Dedicated navigation, tenant-scoped analysis list and filtered results.
- [x] Unit/security tests and authenticated end-to-end preview check.
- [x] Report actual capabilities and remaining tax/export work; do not publish.- [x] QA/regressão Fase 1: fixture Deloitte 2026 (valores reais transcritos), correções de parser/status, aviso de mesmo ano; 89/89 testes, tsgo e build OK.
- [x] Demo real E2E: análise "DEMO SIMULADA — Deloitte 2026 vs 2027" (f09b2fae) no tenant Deloitte, 2 uploads reais 472+472, revisão v1 (331488b9): 466 matched, 6 novos, 6 removidos, Arco-Íris 400→448 (+12%). Fix TIC: seletores baseline/proposta auto-preenchem após salvar importação.
- [x] Demo E2E no tenant Travel Academy: análise "DEMO Deloitte | 2026 vs 2027 | SIMULAÇÃO" (1f016230), 2 XLSX 100% simulados gerados no ambiente, 472+472 linhas, revisão v1 (28433258): 466 matched, 6 novos, 6 removidos, 411 comparáveis single, 29 flutuantes, Arco-Íris 400→448 (+12%). Verificado na UI com filtros.
