# Cruzamento 10 km

- Adicionar aba independente em Raio & Proximidade, com seleção de cliente e dos arquivos de hotéis e escritórios já concluídos; selecionar os mais recentes por tipo.
- Incluir suplemento opcional XLSX/CSV por código/CNPJ, preenchendo apenas coordenadas ausentes em uma cópia temporária, com validação e auditoria de duplicatas, precisão e fonte.
- Calcular todos os pares até 10 km, o escritório mais próximo de cada hotel sem limite de distância e os resumos completos, incluindo entidades sem coordenadas e sem pares.
- Mostrar busca, contagens, duas visões e Excel com as quatro abas solicitadas. Coordenadas aproximadas/review participam igualmente; distâncias são indicativas em linha reta.
- Testar limites, cidades diferentes, suplementos, exclusões, exportação e desempenho 393 × 666; conferir prévia autenticada e lint/compilação.

## Detalhes técnicos
- Leitura autenticada TA/tenant exclusivamente da tabela de Geolocalização de Planilhas, sem normalização/escrita nos jobs.
- Núcleo puro isolado com Haversine sobre coordenadas WGS84, sem arredondamento antes de comparar ≤10 km.
- Nenhum Google/Routes, persistência nova, alteração do legado ou publicação.