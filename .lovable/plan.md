Plano para restaurar o Decision Center sem reconstruir o produto

1. Restaurar “Alertas Críticos” como camada operacional principal
- Manter a página, KPIs, seletor de período, comparação, botão de exportação e Watchlist no mesmo lugar.
- Reorganizar o bloco de alertas para que “Alertas Críticos” volte a ser o cockpit operacional, não um card legado separado.
- Consolidar nele os módulos já implementados:
  - ADR Realizado vs ADR Esperado
  - Leakage Inteligente por Distância
  - Rate Loading Failure Detection
  - Hotel Underperformance
  - Hotel Dependency Score
  - Savings Missed
- Evitar duplicidade: não deixar “Alertas Críticos” como lista antiga e os seis módulos soltos competindo abaixo.

2. Corrigir o comportamento das ações para todas criarem workflow real
- Padronizar todos os botões dos cards para criarem `decision_actions`.
- Garantir que o gatilho existente gere `decision_watchlist` para toda ação, inclusive `Ignorar`.
- Ajustar os módulos onde hoje “Ignorar” apenas arquiva o alerta sem criar ação/Watchlist.
- Padronizar payloads com e-mail gerado, causa inferida, período, cidade, hotel, métricas e próximos passos.

3. Fechar lacunas da Watchlist operacional
- Manter o painel lateral compacto existente.
- Garantir que cada item mostre, de forma consistente:
  - título do alerta
  - tipo
  - cidade
  - hotel
  - ação
  - responsável/status
  - criado em
  - último follow-up
  - estado da resposta
- Preservar e reforçar os fluxos já existentes de:
  - Follow-up
  - Histórico
  - Comentários
  - Anexos
  - Marcar concluído
  - Ignorar
- Garantir atualização visual imediata e persistência após refresh.

4. Restaurar o desenho operacional dos seis módulos
- Usar cards compactos, enterprise-style e dropdown-first.
- Reduzir tabelas grandes quando possível, mantendo detalhes em linhas expansíveis ou seções recolhíveis.
- Para cada módulo, preservar os campos e ações definidos nos prompts:
  - ADR: negociado vs realizado, variação, impacto, causas, Enviar alerta/Ignorar.
  - Leakage: distância até 3km, diretório preferencial, alertas apenas para hotéis contratados.
  - Rate Loading: tarifa negociada vs realizada, blackout/LRA/availability, Enviar alerta/Ignorar.
  - Underperformance: volume esperado vs real, causas, Investigar com hotel/Ignorar.
  - Dependency: concentração, risco operacional, Abrir mini-RFP/Adicionar ao Pipeline/Ignorar.
  - Savings Missed: savings não capturados, adoção/leakage, Alertar AM/Ignorar.

5. Mini-RFP e Pipeline
- Manter a criação real de item em `client_actions` para mini-RFP.
- Enriquecer o payload com cidade, hotel dominante, tier/gaps quando disponíveis e comentários do gestor.
- Garantir que o item apareça no fluxo de RFP/Pipeline após refresh.

6. Link de resposta e conclusão automática
- Verificar e implementar o fluxo que ainda está apenas descrito nos templates dos e-mails:
  - gerar link funcional de resposta para a ação
  - permitir comentário e upload de evidência
  - ao enviar resposta, registrar comentário/anexo, marcar ação como `COMPLETED` ou `RESPONDED` e atualizar Watchlist
- Reutilizar o padrão público já existente de resposta de RFP quando fizer sentido, sem expor dados indevidos.

7. Persistência e estabilidade
- Reutilizar `decision_alerts`, `decision_actions`, `decision_watchlist`, `decision_followups`, `decision_comments` e `decision_attachments`.
- Revisar efeitos e stores para evitar loops, estado duplicado e rerender desnecessário.
- Não mexer em estrutura global nem criar novos módulos não solicitados.

8. Validação final
- Testar no Dashboard com os dados existentes.
- Validar o fluxo completo em pelo menos uma ação de cada módulo:
  - ver alerta
  - expandir detalhes
  - tomar ação
  - ver na Watchlist
  - adicionar follow-up
  - comentar/anexar
  - concluir
  - confirmar persistência após refresh
- Confirmar que `Savings YoY` permanece no topo e que “Oportunidades priorizadas” continua em Diagnóstico.