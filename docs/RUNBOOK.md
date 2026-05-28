# Disaster Recovery Runbook — SourcingHub

> Documento de operações para situações críticas. Mantenha atualizado após cada mudança significativa de infraestrutura.

---

## 1. Informações de Contato

| Papel | Nome | Contato |
|---|---|---|
| Tech Lead | — | — |
| TA Master | — | — |
| Infra / Cloud | — | — |

---

## 2. RTO / RPO Declarados

- **RTO (Recovery Time Objective):** 4 horas — tempo máximo aceitável para restaurar operação plena após desastre.
- **RPO (Recovery Point Objective):** 24 horas — perda máxima aceitável de dados. Backups lógicos diários são armazenados no Storage.

---

## 3. Health Check & Monitoramento

### Endpoint de health
```
GET https://navigator.travelacademy.com.br/api/public/health
```

Resposta esperada (200):
```json
{
  "status": "healthy",
  "db": "ok",
  "auth": "ok",
  "response_time_ms": 42,
  "version": "dev",
  "timestamp": "2026-05-28T10:00:00.000Z"
}
```

### Monitor externo recomendado
Configure no UptimeRobot (gratuito) ou BetterStack:
- **URL:** `https://navigator.travelacademy.com.br/api/public/health`
- **Intervalo:** 5 minutos
- **Alerta:** e-mail + Slack/Webhook

---

## 4. Backups

### Backup automático (Lovable Cloud)
O Postgres tem backups automáticos diários gerenciados pela plataforma. Não é necessário intervenção manual para backup full.

### Backup lógico semanal (nossa camada)
- **Destino:** bucket `baseline-files/backups/YYYY-MM-DD/`
- **Conteúdo:** JSONs das tabelas críticas (`bookings`, `client_actions`, `rfps`, `baseline_contracts`, etc.)
- **Trigger manual:**
```bash
curl -X POST \
  https://navigator.travelacademy.com.br/api/public/backup \
  -H "Authorization: Bearer $BACKUP_SECRET"
```
- **Secret:** `BACKUP_SECRET` (armazenado em Lovable Cloud secrets)

### Verificar último backup
```bash
curl -X GET \
  "https://uexptysnthwjxksrlxod.supabase.co/storage/v1/object/list/baseline-files?prefix=backups/" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

---

## 5. Restauração de Dados

### Cenário A: Perda de dados de uma tabela específica

1. Identifique o arquivo de backup no Storage:
   - Path: `backups/YYYY-MM-DD/{table}.json`
2. Faça download do JSON:
```bash
curl -X GET \
  "https://uexptysnthwjxksrlxod.supabase.co/storage/v1/object/baseline-files/backups/YYYY-MM-DD/bookings.json" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```
3. Restaure via script (exemplo para `bookings`):
```typescript
// script de restore (rodar localmente com service role)
const data = JSON.parse(fs.readFileSync('bookings.json', 'utf8'));
await supabaseAdmin.from('bookings').insert(data);
```
**ATENÇÃO:** Inserts em massa podem violar RLS. Use `supabaseAdmin` (service role) para bypass.

### Cenário B: Restore completo do banco

Se o banco inteiro for corrompido ou deletado:
1. Entre em contato com suporte Lovable Cloud (via painel do projeto)
2. Solicite restore do backup automático do Postgres
3. Após restore, execute o backup lógico semanal para preencher gap de dados entre último backup full e incidente

---

## 6. Rollback de Migration

### Se uma migration causar problema em produção:

1. **Não delete o arquivo da migration** — mantenha histórico.
2. Crie uma migration reversora:
```sql
-- supabase/migrations/2026XXXXXX_revert_nome.sql
-- Exemplo: remover coluna problemática
ALTER TABLE baseline_uploads DROP COLUMN IF EXISTS coluna_problematica;
```
3. Aplique via pipeline de migration (Lovable Cloud).
4. Monitore o health check após rollback.

### Reverter para versão anterior do código
- Use o sistema de branches/commits do Lovable para reverter mudanças no código
- A publicação automática pode ser pausada se necessário

---

## 7. Incident Response Checklist

- [ ] Confirmar incidente (health check falhando, usuários reportando)
- [ ] Notificar stakeholders (Tech Lead, TA Master)
- [ ] Verificar status da plataforma Lovable Cloud (incidentes conhecidos)
- [ ] Coletar logs (console do projeto, worker logs)
- [ ] Identificar escopo (qual tenant, qual módulo, qual tabela)
- [ ] Aplicar fix ou restore conforme cenário (seção 5)
- [ ] Validar health check retorna 200
- [ ] Notificar stakeholders sobre resolução
- [ ] Documentar pós-mortem em `docs/incidents/YYYY-MM-DD.md`

---

## 8. Teste de Restore

**Último teste realizado:** — (preencher após executar)

### Procedimento de teste:
1. Crie um tenant de teste (`tenant-teste-restore`)
2. Execute backup lógico
3. Delete dados de uma tabela em teste
4. Restaure do JSON
5. Valide integridade (contagem de linhas, checksums amostrais)

---

## 9. Segredos e Variáveis de Ambiente

| Nome | Onde | Uso |
|---|---|---|
| `SUPABASE_URL` | Lovable Cloud | Conexão com banco |
| `SUPABASE_SERVICE_ROLE_KEY` | Lovable Cloud (segredo) | Operações admin |
| `BACKUP_SECRET` | Lovable Cloud (segredo) | Autenticar job de backup |

**Rotação:** Recomendado a cada 90 dias ou após incidente de segurança.

---

## 10. Links Úteis

- **Projeto:** https://lovable.dev/projects/00ddabc1-b9db-4dc7-a780-ddf3fff689a1
- **Preview:** https://id-preview--00ddabc1-b9db-4dc7-a780-ddf3fff689a1.lovable.app
- **Produção (custom domain):** https://navigator.travelacademy.com.br
- **Health Check:** https://navigator.travelacademy.com.br/api/public/health

---

*Atualizado em: 2026-05-28*
