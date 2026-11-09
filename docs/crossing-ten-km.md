# Cruzamento 10 km — implementação e QA

## Escopo
- Nova aba independente em `/raio-proximidade`. Leitura TA/tenant autenticada de `sheet_geolocation_jobs`, via `crossingSources`; SELECT somente, sem normalizar ou escrever snapshots.
- Fontes explicitamente solicitadas de 393 hotéis e 666 escritórios são preferidas quando disponíveis no cliente. Nos demais clientes, seleciona o mais recente concluído por tipo. Isso evita substituir o conjunto completo por um novo arquivo de retry de 63 escritórios. Ambos os seletores permitem mudar a fonte.
- Cálculo e suplementos ficam temporariamente no navegador: recarregar descarta suplemento/resultado, mas mantém fontes disponíveis e permite recalcular sem chamadas externas.
- Não altera análise legada, catálogo, RFPs ou jobs de geolocalização. Não importa nenhuma função de batch/geocoding e não chama Google/Routes.

## Regras e exportação
- Haversine sobre latitude/longitude WGS84, raio terrestre médio 6.371,0088 km, distância em linha reta (não geodésica elipsoidal nem viária). Compara `<=10` sem arredondamento; faixas `<=3`, `>3 e <=10` e `>10`.
- Todas as coordenadas aptas participam igualmente, independente de status, review, aproximação, cidade ou UF. Distâncias são indicativas: pontos municipais/postais/POIs não garantem localização da entrada ou edificação.
- Exclui vazios, não numéricos, não finitos, fora do envelope Brasil lat -34..6/lng -74..-30 e placeholder 16/16. Valores existentes inválidos não são substituídos por suplemento.
- Suplemento CSV/XLSX: primeira aba, primeira linha com Código/CNPJ, Latitude, Longitude; lê Tipo de localização, Fonte URL e Observações. Preserva strings/códigos/zeros/traço. Duplicatas no suplemento e chaves ambíguas na fonte não são aplicadas. Apenas componentes ausentes são preenchidos; original não é alterado. Fonte, precisão, URL, observações e campos preenchidos constam na auditoria.
- Exportação **completa**, independente do filtro visível: `Pares ate 10km`, `Escritorios resumo`, `Hoteis resumo`, `Auditoria`. Resumos mantêm zeros/ausências e mais próximo global mesmo acima de 10 km; distância ausente fica vazia, não zero. Arquivo preserva endereço/cidade/UF/código/CNPJ/coordenadas/precisão/status e proveniência, incluindo arquivo de origem/linha/Place ID disponível.

## Verificação observada em 9 novembro 2026
- Prévia autenticada TA master, fontes reais solicitadas: 393 hotéis, 666 escritórios; 388/603 aptos, 5/63 sem coordenadas aptas; **17.045 pares**; 88 escritórios sem hotel no raio, 8 hotéis sem escritório no raio (5 sem coordenadas e 3 com mais próximo acima de 10 km).
- Excel baixado pela UI e relido: 17.045 pares, 666 escritórios, 393 hotéis, 1.060 registros de auditoria incluindo regras. Reabertura/recalcular retorna os mesmos totais. Busca São Paulo: 58 hotéis; views/paginação conferidas. Layout da seção móvel conferido; há overflow preexistente do cabeçalho geral, não do conteúdo da seção.
- Suplemento **sintético somente QA**, dois registros temporários: um preenche vazio; outro preserva coordenadas existentes. Exportação confirmou fonte/precisão e original preservado. Esse teste não corresponde ao XLSX real de 37 pontos, que não estava anexado; seu conteúdo não foi processado ou inventado.
- SELECT antes/depois confirmou `updated_at`, contagem e reservas de consultas intactos nas duas fontes. Zero chamadas Maps/Places/Routes e zero publicação.
- Vitest: suíte completa 247 testes/15 arquivos passou; 12 testes novos cobrem todos pares, limites/faixas, cidades/UF diferentes, nearest >10, ausência/invalidade, inclusão review/municipal, suplementos/zeros/duplicatas, quatro abas e 393×666 (261.738 pares sintéticos no pior caso).
- Lint dos arquivos novos e da integração passou; compilação automática `build OK`. Lint global tem 5.216 problemas preexistentes (5.203 erros e 13 avisos), fora do escopo; não foi declarado limpo.

## Arquivos
`src/lib/crossingTenKm/{core.ts,files.ts,sources.functions.ts}`, `src/components/crossingTenKm/CrossingTenKm.tsx`, integração aditiva em `ProximityPage.tsx`, `tests/crossingTenKm.test.ts`, `AGENTS.md`, `roadmap.md` e este relatório.