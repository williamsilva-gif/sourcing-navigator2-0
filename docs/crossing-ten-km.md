# Cruzamento 10 km — implementação e QA

## Escopo
- Nova aba independente em `/raio-proximidade`. Leitura TA/tenant autenticada de `sheet_geolocation_jobs`, via `crossingSources`; SELECT somente, sem normalizar ou escrever snapshots.
- A fonte principal padrão de escritórios é agora a **nova planilha de 631 linhas** importada pelo usuário; enquanto não for importada e confirmada, o cálculo fica desabilitado (sem fallback silencioso para 666). A seleção histórica continua disponível explicitamente. Fontes nunca são unidas: as 35 unidades excluídas não retornam. O job solicitado de 393 hotéis continua preferido, com alternativa de importar hotéis já geolocalizados.
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

## Atualização aprovada — fonte de 631 escritórios (9 novembro 2026)
- Aba Cruzamento já estava efetivamente importada e renderizada em `ProximityPage.tsx`, linhas 24/70/78–79; não havia integração pendente.
- Importação temporária completa via `import.ts` e `CoordinateImport.tsx`: CSV/XLSX, escolha de aba e cabeçalho, aliases e mapeamento manual de código/CNPJ, cidade, UF, coordenadas, endereço/número, nome, precisão, fonte/URL/notas/status. Código/cidade/UF/lat/lng exigem mapeamento; códigos vazios ou duplicados impedem confirmação. Escritórios exigem exatamente 631 linhas não vazias; hotéis mostram referência de 393 sem impor esse total para arquivos alternativos. Coordenadas inválidas mantêm a linha nos resumos, mas não entram no cálculo. Valores originais do workbook não são modificados, inclusive caches de formatação.
- Nada é enviado ao storage ou persistido; não cria jobs. Recarregar descarta importações/resultado e permanece no modo nova planilha, sem mesclar ou selecionar silenciosamente os 666 antigos. O usuário precisa selecionar novamente o arquivo local.
- **A planilha real de 631 ainda não foi fornecida.** QA autenticado utilizou CSV sintético de 631 escritórios (todos no mesmo ponto, sem representar unidades reais), mais leitura dos 393 hotéis existentes. UI confirmou 631/393, 631/388 aptos; 32.812 pares são resultado exclusivamente desse teste sintético, não da nova base real.
- Download pela UI e releitura confirmaram quatro abas: 32.812 pares, 631 escritórios, 393 hotéis e 1.025 linhas de auditoria; `ESC-0000`, precisão aproximada e fontes preservados. Busca, visão nearest, desktop/mobile e reload verificados. Importação/calcular não chamam Google ou funções de escrita.
- Suíte completa **251 testes / 15 arquivos passou**; lint do módulo e testes passou; compilação automática `build OK`. Lint global continua com 5.203 erros e 13 avisos preexistentes. Sem publicação.