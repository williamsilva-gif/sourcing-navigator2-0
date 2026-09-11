# O que falta para a automação de Rate Loading rodar

Tudo o que vive dentro do app já está pronto: banco, regras de acesso, cofre de credenciais, telas de Implementação, fila de trabalhos, motor de comparação e a rota que recebe os resultados. As duas chaves de segurança já estão guardadas.

Falta o que é, por natureza, fora do app: o robô que abre o navegador. O ambiente do app não tem navegador, então ele precisa rodar em outro lugar.

## Passos restantes

### 1. Colocar o robô no ar (única ação manual)
O robô já está escrito e com imagem pronta em `workers/rate-loading/`. Precisa ser publicado em um serviço que permita navegador (Fly.io, Render, Cloud Run, uma máquina virtual). Ele precisa de duas informações:
- o endereço do app
- a chave do robô (já guardada nos segredos do projeto)

Depois disso ele passa a buscar trabalho sozinho.

### 2. Ligar a franquia do cliente
Sem franquia liberada, a criação de verificações é bloqueada. Definir, pelo painel da Travel Academy, o direito de uso do cliente (desligado, limitado ou ilimitado) e o limite do período.

### 3. Preencher a ficha de acordo por hotel
As verificações só existem para hotéis com condições comerciais registradas (moeda, tarifa, café, Wi-Fi, LRA, cancelamento, vigência). A tela deriva isso do Diretório e da negociação, mas hoje ainda não há um formulário para completar e revisar o que falta.

### 4. Cadastrar a conexão do portal e testá-la
Endereço do portal, adaptador e credencial. Para portal real, é preciso liberar o domínio no adaptador; sem isso a navegação é recusada por segurança.

### 5. Ensaio completo com o portal de testes
Rodar o portal falso e o robô localmente e executar uma campanha de ponta a ponta, conferindo todos os cenários (tarifa exata, dentro da tolerância, divergente, moeda errada, sem café, LRA errado, hotel inexistente, login inválido, lentidão).

## O que eu ainda vou construir aqui

- Formulário da ficha de acordo final por hotel, com preenchimento automático do que já existe.
- Painel da Travel Academy para franquia e consumo (limite, período, uso).
- Coluna de último status e data de verificação no Diretório de Hotéis.
- Aba de Evidências com abertura por link temporário.
- Testes automatizados do robô e da fila, e documentação em `docs/rate-loading/` com o passo a passo de publicação.

## Detalhes técnicos

- `workers/rate-loading/` roda Node + Playwright, consome `/api/public/rate-loading/claim` e devolve em `/result`, autenticado por `RATE_LOADING_WORKER_TOKEN`.
- Credenciais ficam cifradas em `rate_loading_portal_credentials` com `RATE_LOADING_CREDENTIAL_KEY`; só são resolvidas no backend, na entrega do trabalho.
- Fila usa `claim_rate_loading_job` com lease e `FOR UPDATE SKIP LOCKED`; falta um varredor para reaproveitar trabalhos com lease vencida.
- Franquia usa `reserve_feature_quota` + finalização; erros técnicos não consomem franquia, resultados de negócio consomem.
- Novos arquivos previstos: `src/components/implementacao/FinalTermsDialog.tsx`, `EvidencePanel.tsx`, `src/components/admin/EntitlementsPanel.tsx`, `workers/rate-loading/tests/`, `docs/rate-loading/*`.
