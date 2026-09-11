# Rate Loading Check — dentro de Implementação

Verificar se o que foi negociado com cada hotel está realmente carregado no portal/OBT do cliente, com evidência, histórico e controle de franquia.

## O que já existe e será reaproveitado

Verificado no projeto:

- **Diretório de Hotéis** (`awarded_program`): define quais hotéis fazem parte do programa final — hotel, cidade, tier, primário/backup, ADR final, teto, room nights, qualidade, compliance, comodidades, cancelamento, vigência.
- **RFP / Negociação**: `rfps`, `rfp_invitations`, `rfp_responses`, `rfp_analysis_rows`, `negotiation_lots`, `negotiation_threads`.
- **Multi-tenant**: `tenants`, `user_roles`, `can_see_tenant()`, `is_ta_master()` — padrão que todas as tabelas novas seguirão.
- **Ligar/desligar por cliente e por usuário**: `tenant_modules`, `tenant_features`, overrides por usuário, catálogo de funcionalidades.
- **Auditoria**: `access_audit_log`.
- **Armazenamento privado**: já existe padrão de bucket privado com acesso controlado.
- **Agendamento**: `pg_cron` já está em uso — será reaproveitado, sem criar agendador paralelo.

Duas lacunas confirmadas, que o plano cobre:

1. **Não existe registro completo do acordo final.** Hoje só há tarifa final, teto, comodidades e cancelamento no Diretório, e tarifas soltas na resposta ao RFP. Faltam moeda, tipo de quarto, plano tarifário, código corporativo, base da tarifa, LRA, impostos e vigência.
2. **Não existe franquia/consumo.** Só existe liga/desliga de módulos e funcionalidades. Não há plano, limite nem contagem de uso.

## O que será construído

### 1. Ficha de acordo final por hotel

Um registro de condições comerciais aceitas, ligado ao hotel do programa e ao RFP: moeda, tarifa single/double, base (por noite ou total), tipo de quarto, plano tarifário, código corporativo, LRA, café, Wi-Fi, estacionamento, impostos, taxa de serviço, política de cancelamento, reembolsável, comodidades obrigatórias e vigência. Preenchida a partir do que já existe no Diretório e na negociação, com complemento manual só do que falta. Ninguém redigita o que o sistema já sabe.

### 2. Implementação vira hub operacional

`/implementacao` deixa de ser placeholder e passa a ter: Visão Geral, Rate Loading, Conexões de Portal/OBT, Pendências e Evidências — com os cartões de resumo pedidos.

### 3. Conexões de portal

Cadastro do portal do cliente com credencial guardada em cofre (só a referência fica no banco), usuário mascarado, sem "mostrar senha", só substituir/rotacionar. Dois aceites obrigatórios (credencial de consulta e autorização de uso). Ação **Testar conexão**: entra, confirma acesso, sai — sem pesquisar nada.

### 4. Campanhas, verificações e tentativas

Assistente em 8 passos (cliente/RFP, hotéis elegíveis com motivo de inelegibilidade, portal, datas com padrão de 3 estadias, ocupação, regras de validação, pré-voo com consumo previsto, confirmação). Cada hotel × período × cenário = uma verificação. Cada execução gera uma tentativa nova; nada é sobrescrito. Reexecutar tudo ou só as falhas.

### 5. Motor de comparação

Determinístico: normaliza base da tarifa e moeda, aplica tolerância absoluta e percentual, checa comodidades obrigatórias por sinônimos, LRA e cancelamento. Sem confiança suficiente → revisão manual. IA opcional só depois das regras, nunca transforma falha clara em aprovação.

### 6. Evidências

Captura de tela focada e relatório estruturado, ambos com impressão digital (SHA-256), em armazenamento privado por cliente/campanha/verificação/tentativa, acessível só por link temporário.

### 7. Franquia e consumo

Estrutura mínima e reutilizável: direito por cliente (desligado / limitado / ilimitado), limite, período, vigência; e um registro de consumo somente-inclusão (reservado → consumido/liberado). Reserva transacional para dois usuários simultâneos nunca ultrapassarem a franquia. Travel Academy controla; cliente só visualiza.

### 8. Executor do portal (fora do app)

Serviço Node + Playwright em `workers/rate-loading/`, com fila persistente, um trabalho por vez por conexão, retomada após queda, e adaptadores por portal com lista de domínios permitidos (bloqueio de IPs internos e URLs arbitrárias). Estritamente somente-leitura: entrar, buscar, ler, comparar, capturar, sair.

### 9. Portal de testes

Um portal falso navegável de verdade, com todos os cenários (tarifa exata, dentro da tolerância, divergente, moeda errada, sem café, sem Wi-Fi, LRA errado, cancelamento divergente, hotel inexistente, tarifa inexistente, login inválido, MFA, CAPTCHA, lentidão, layout alterado). Todos os testes rodam contra ele.

### 10. Resultado no Diretório de Hotéis

Coluna de último status e data da última verificação, sem duplicar dados, com clique para o detalhe.

## Detalhes técnicos

- Tabelas novas (aditivas, com GRANT + RLS por `can_see_tenant`/`is_ta_master`): `final_agreed_terms`, `rate_loading_portal_connections`, `rate_loading_campaigns`, `rate_loading_checks`, `rate_loading_attempts`, `rate_loading_jobs`, `rate_loading_evidence`, `feature_entitlements`, `feature_usage_ledger`. `access_audit_log` ganha os novos eventos.
- `awarded_program` guarda `hotel_name` em texto, sem chave para `hotels`; será adicionada coluna opcional `hotel_id` com casamento por nome/cidade, sem remover nada.
- `expected_snapshot` + `expected_snapshot_hash` imutáveis na criação da verificação.
- Fila com `SELECT ... FOR UPDATE SKIP LOCKED`, lease com expiração, chave de idempotência; reserva de franquia em transação com lock.
- Backend em server functions; endpoint autenticado do executor em `src/routes/api/public/` com verificação de assinatura; resolução da credencial só no backend, só para a execução, nunca ao navegador.
- Bucket privado `rate-loading-evidence` com RLS e URL assinada.
- Testes: unitários do comparador/franquia/fila/allowlist, integração de RLS entre clientes, E2E Playwright contra o portal de teste (26 cenários), lote de 50 verificações e teste de queda do executor.
- Docs em `docs/rate-loading/`.

## Bloqueio conhecido

O app roda em ambiente sem Chromium, então o executor Playwright não pode rodar aqui. Ele será implementado por completo, com Dockerfile e testes locais, e a publicação dele em um servidor será a única ação manual — nada será simulado no lugar da automação real.

## Ordem de entrega

1. Banco, RLS, auditoria e ficha de acordo final
2. Conexões de portal + cofre de credencial + testar conexão
3. Campanhas, verificações, fila e franquia
4. Executor, adaptadores e portal de testes
5. Comparador e evidências
6. Telas de Implementação, Diretório e console da Travel Academy
7. Testes, correções e build
