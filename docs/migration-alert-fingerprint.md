# Migração de Banco de Dados: alert_fingerprint

## Status
⚠️ **MIGRAÇÃO PENDENTE** - A coluna `alert_fingerprint` precisa ser adicionada à tabela `tracking_alerts`.

## Objetivo
Adicionar deduplicação por fingerprint para alertas FACT-based, permitindo múltiplos alertas do mesmo tipo quando representam fatos distintos (e.g., dois transbordos diferentes).

## SQL Migration

```sql
-- Add alert_fingerprint column to tracking_alerts table
-- This column stores a deterministic hash for FACT alerts to enable
-- deduplication by evidence rather than just by type.

ALTER TABLE tracking_alerts
ADD COLUMN alert_fingerprint TEXT NULL;

-- Add index for performance on deduplication lookups
CREATE INDEX idx_tracking_alerts_fingerprint 
ON tracking_alerts(container_id, alert_fingerprint)
WHERE alert_fingerprint IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN tracking_alerts.alert_fingerprint IS 
'Deterministic fingerprint for FACT alerts (sha256 hash of type + sorted evidence fingerprints). NULL for MONITORING alerts.';
```

## Passos para Aplicação

1. **Aplicar migração no Supabase:**
   - Ir ao Dashboard do Supabase
   - SQL Editor → New Query
   - Colar e executar o SQL acima

2. **Regenerar tipos TypeScript:**
   ```bash
   # Se houver comando de regeneração de tipos do Supabase
   pnpm supabase:gen-types
   # OU
   npx supabase gen types typescript --project-id <PROJECT_ID> > src/shared/supabase/database.types.ts
   ```

3. **Verificar que os tipos foram atualizados:**
   - Abrir `src/shared/supabase/database.types.ts`
   - Confirmar que `tracking_alerts.Row` e `tracking_alerts.Insert` têm o campo `alert_fingerprint: string | null`

4. **Rodar testes completos:**
   ```bash
   pnpm test
   ```

## Comportamento Pós-Migração

### Alertas FACT (com fingerprint)
- **Antes:** Só permitia 1 alerta TRANSSHIPMENT ativo por container
- **Depois:** Permite múltiplos alertas TRANSSHIPMENT se as evidências (observations) forem diferentes

### Alertas MONITORING (sem fingerprint)
- **Antes:** Deduplica por TYPE
- **Depois:** Continua igual (fingerprint é NULL, deduplica por TYPE)

### Retrocompatibilidade
- Alertas existentes terão `alert_fingerprint = NULL`
- Sistema continua funcionando normalmente
- Novos alertas FACT terão fingerprint calculado automaticamente
- Alertas MONITORING continuam com `alert_fingerprint = NULL`

## Validação

Após aplicar a migração, executar:

```sql
-- Verificar que a coluna existe
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'tracking_alerts' 
  AND column_name = 'alert_fingerprint';

-- Verificar que o índice foi criado
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'tracking_alerts' 
  AND indexname = 'idx_tracking_alerts_fingerprint';
```

## Rollback (se necessário)

```sql
-- Remover índice
DROP INDEX IF EXISTS idx_tracking_alerts_fingerprint;

-- Remover coluna
ALTER TABLE tracking_alerts DROP COLUMN IF EXISTS alert_fingerprint;
```

---

**Nota importante:** Esta migração é **non-breaking** e pode ser aplicada em produção sem downtime. Alertas existentes continuam funcionando com `alert_fingerprint = NULL`.
