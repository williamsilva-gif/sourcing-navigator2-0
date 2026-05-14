
# Fluxo RFP end-to-end com persistência real

## Diagnóstico dos bugs atuais

1. **"Abrir RFP"/"Abrir mini-RFP" não faz nada** — o botão da `ActionInboxBanner` (em `/rfp`) não abre nada porque o Wizard só é aberto pelo botão "Novo RFP" do header. Vamos torná-lo clicável e pré-preencher com os dados da ação (cidade, cap sugerido).
2. **Concluir o Wizard só dispara `toast.success` e fecha** — nada vai para o banco. Por isso a lista "Programas de RFP", "Respostas dos hotéis" e KPIs ficam vazios e tudo se perde ao deslogar (estão em memória, `RFP_PROGRAMS = []`).
3. As tabelas `rfps`, `rfp_invitations`, `rfp_responses` já existem no banco com RLS adequada — basta usá-las.

## O que vamos construir

### 1. Persistência (Supabase, sem novas migrations)

`src/lib/rfpRepo.ts` (novo) — server functions + client helpers:
- `createRfp({ name, clientTenantId, cycle, briefing, cities, pois, hotelStrategy, requirements, openDate, deadline })` → insere em `rfps` (metadata guarda cycle, briefing, requirements, openDate, hotelStrategy, status visual).
- `listRfps(clientTenantId?)` → lê `rfps` (RLS já filtra por `can_see_tenant`).
- `getRfp(id)` → rfp + invitations + responses.
- `createInvitations(rfpId, hotelIds[])` → insere em `rfp_invitations` (gera token único em `metadata.token` para link público).
- `updateInvitationStatus`, `addResponse`.

`src/lib/rfpProgramData.ts` deixa de ser fonte de verdade — vira só os tipos + `RFP_REQUIREMENT_TEMPLATES`. As listas viram queries via React Query.

### 2. Wizard: nova etapa "Hotéis convidados" + envio real

Em `CreateRfpWizard.tsx`:
- **Nova etapa 4 "Hotéis convidados"** substitui a atual genérica:
  - Carrega hotéis automaticamente de `hotels` (filtrando por `city ∈ selectedCities` + estratégia: `preferred` usa `metadata.tier ∈ {Strategic, Preferred}`, `open` traz todos da cidade, `curated` começa vazio).
  - Tabela com checkbox por hotel, busca por nome/cidade/marca, contador "X hotéis selecionados".
  - Botão "Adicionar hotel" abre busca global em `hotels` (debounced) para incluir hotéis fora do filtro automático.
  - Permite remover qualquer hotel da lista antes de distribuir.
- **Etapa final "Distribuir RFP"**:
  - Salva `rfps` row + N `rfp_invitations` (uma por hotel selecionado, com token).
  - Dispara e-mail para cada `contact_email` do hotel via server function (ver §4).
  - Toast com link "Ver RFP" que abre o `RfpDetailModal` real.
- Pré-preenchimento: se `?city=...&suggestedCap=...&actionId=...` (vindo da ActionInboxBanner / Decision Center), abre o wizard automaticamente, marca a cidade e guarda o cap sugerido em `metadata.suggested_cap`.

### 3. Conteúdo mínimo de uma RFP de hotéis

Estendemos `RFP_REQUIREMENT_TEMPLATES` e adicionamos uma seção fixa "Dados solicitados ao hotel" salva em `rfps.metadata.questions`:

- **Tarifas**: ADR LRA / não-LRA, dynamic discount %, BAR-linked %, moeda, validade.
- **Inclusões**: café, Wi-Fi, parking, late checkout, upgrade.
- **Políticas**: cancelamento (h), no-show, garantia, GDS code, comissão %, central billing.
- **Sustentabilidade**: certificação (GSTC, EarthCheck, etc.), relatório CO₂.
- **Capacidade**: nº quartos, salas de reunião, restaurante 24h.
- **Comercial**: contato comercial, telefone, e-mail, prazo de proposta.

Tudo isso vira o formulário que o hotel preenche no link público (§5).

### 4. E-mail de convite (Lovable Emails)

- Verificar se já existe domínio de e-mail (`email_domain--check_email_domain_status`).
- Se não houver, mostrar uma vez o `<presentation-open-email-setup>` para o usuário configurar; o resto do fluxo já cria invitations e mostra os links manualmente até o domínio ficar pronto.
- Quando o domínio estiver ok: scaffold de e-mail transacional + server function `sendRfpInvitationEmail({ invitationId })` que enfileira o template:
  - Assunto: `Convite RFP {cycle} — {clientName}`.
  - Corpo: nome da RFP, briefing curto, cidades, prazo, link `https://<projeto>.lovable.app/rfp/responder/{token}`.
- Botão "Reenviar convite" e "Enviar lembrete em massa" passam a chamar essa server function (hoje só fazem toast).

### 5. Página pública de resposta do hotel

Nova rota `src/routes/api/public/rfp-token/$token.tsx` (server route) + página `src/routes/r.$token.tsx`:
- Resolve token → `rfp_invitations` (via `supabaseAdmin` em server fn pública), retorna RFP + perguntas.
- Formulário com as seções da §3, salva em `rfp_responses` (status `Submetido`) e atualiza invitation para `Submetido`.
- Não exige login do hotel (token é o credential). Token é UUID em `metadata.token`.

### 6. Hidratação das telas existentes

- `RfpProgramList`, `HotelResponseTracker`, `RfpDetailModal`, KPIs do header de `/rfp` passam a usar `useQuery` em cima de `listRfps`/`getRfp`.
- `RfpDetailModal` ganha:
  - Aba "Hotéis convidados" (lista com status, último contato, botão reenviar).
  - Aba "Respostas" (preview das respostas submetidas).
  - Botão "Copiar link público" por hotel.

### 7. Auditoria do que mais já está só em memória

Como o usuário pediu "revise o que já foi criado" — fazer um varredura rápida de `src/lib/*Store.ts` (`actionStore`, `appConfigStore`, `baselineStore`, `snapshotStore`, `wikiStore`) e listar (não migrar agora) o que ainda é Zustand/localStorage. Hotéis fica de fora (já está no banco). O resultado vira uma seção no fim do toast/relatório, e proponho num próximo passo migrar um a um — não dá para fazer tudo em uma rodada sem inflar este PR.

## Esforço / ordem de implementação

1. `rfpRepo.ts` + server functions + hooks React Query (base).
2. Wizard: nova etapa de seleção de hotéis + persistência ao distribuir.
3. Hidratar `RfpProgramList`, KPIs, `HotelResponseTracker`, `RfpDetailModal` com dados reais.
4. Página pública `/r/$token` + server route resolvendo o token.
5. E-mail (depende de domínio configurado).
6. Wire da `ActionInboxBanner` → abrir wizard pré-preenchido.
7. Lista/relatório do que ainda está em memória (sem migrar).

## Perguntas antes de implementar

1. **E-mail real agora?** Você já tem domínio de e-mail configurado em Lovable Cloud? Se não, posso (a) abrir o setup de domínio agora e seguir o fluxo, ou (b) entregar tudo persistido + link público copiável e deixar o e-mail para depois do domínio. Qual prefere?
2. **Cliente da RFP**: o wizard hoje tem um Select fixo com "Acme Holdings / Globex / Initech". Devo trocar por um Select que lista os tenants `CORP` reais do banco visíveis ao usuário (recomendado), ou manter os fictícios por enquanto?
3. **Página pública de resposta**: ok criar em `/r/{token}` (curto, sem login) ou prefere outro caminho (`/rfp/responder/{token}`)?
