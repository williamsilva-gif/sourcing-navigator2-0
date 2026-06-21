# Corrigir o Admin/TA Console sem tocar em dados

## Problema confirmado

Os ambientes/clientes **não foram apagados**. O banco ainda tem Travel Academy, Kontik, Viagens Internas Kontik, Acme e Deloitte.

A bagunça atual vem de duas causas de UI/rota:

1. `/admin` está como rota pública com SSR, mas depende de sessão do usuário. Isso causa erro de hidratação no Header: o servidor renderiza um placeholder/login e o client tenta renderizar usuário/logoff.
2. Como a sessão não fica pronta no momento certo, o Header não reconhece o usuário TA, o dropdown ao lado do sino não carrega corretamente, e as abas condicionadas por TA (`Usuários do cliente`) podem sumir.

## Correção proposta

1. **Mover o Admin para a área autenticada**
   - Criar a rota autenticada correta para o Admin, preservando o URL `/admin`.
   - O conteúdo atual de `src/routes/admin.tsx` será movido para `src/routes/_authenticated.admin.tsx`.
   - A rota pública `/admin` deixará de renderizar conteúdo dependente de sessão/SSR.
   - Resultado: sem hydration mismatch e sem perder sessão no Header.

2. **Restaurar o comportamento TA no Header**
   - O dropdown ao lado do sino deve sempre mostrar:
     - `Workspace TA (pessoal)` quando o usuário é TA.
     - Os clientes existentes para “entrar como cliente”.
   - O Header deve esperar `auth.ready` antes de trocar entre login/logout para evitar mismatch.
   - Reforçar que o Workspace TA é o ambiente próprio da Travel Academy e que entrar em cliente é modo cliente, sem afetar configs próprias da TA.

3. **Restaurar a aba “Usuários do cliente”**
   - Garantir que a aba apareça para `ta_master` e `ta_staff` assim que os papéis forem carregados.
   - Se os papéis ainda estiverem carregando, mostrar estado de carregamento em vez de esconder a aba.

4. **Preservar tudo que foi implementado hoje**
   - Manter no painel de Usuários do cliente:
     - módulos/features por usuário,
     - reset individual para template,
     - reset em massa para template,
     - tooltip de motivo de acesso,
     - audit log,
     - reenvio de convite/set-password.
   - Não remover migrations, funções ou tabelas.

5. **Bloquear ações perigosas na tela Clientes**
   - Remover ou desabilitar botões que possam “limpar demo” ou remover cliente sem confirmação forte.
   - Trocar remoção direta por confirmação explícita, para reduzir risco de perda operacional.
   - Não alterar dados existentes.

6. **Validação**
   - Abrir `/admin` com sessão TA.
   - Confirmar que não há erro de hydration.
   - Confirmar Header com usuário/role TA e dropdown funcional.
   - Confirmar que a lista inclui Travel Academy + clientes existentes conforme solicitado.
   - Confirmar que a aba `Usuários do cliente` aparece.
   - Confirmar que as funcionalidades por usuário/audit/reset/reenvio continuam presentes.

## O que não será feito

- Não vou apagar, recriar, limpar ou migrar dados.
- Não vou rodar seed/wipe.
- Não vou criar nova migration.
- Não vou mexer em negociações, RFPs, baseline, contratos ou dados dos clientes.
