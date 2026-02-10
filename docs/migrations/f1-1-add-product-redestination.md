# Migration: Add product and redestination_number fields

## Context

F1.1 standardization requires two additional optional fields in the `processes` table:
- `product`: Text description of the cargo/product
- `redestination_number`: Redestination process number

## SQL Migration

```sql
-- Add product field to processes table
ALTER TABLE processes 
ADD COLUMN IF NOT EXISTS product TEXT NULL;

-- Add redestination_number field to processes table
ALTER TABLE processes 
ADD COLUMN IF NOT EXISTS redestination_number TEXT NULL;

-- Add comments for documentation
COMMENT ON COLUMN processes.product IS 'Optional product description (e.g., Electronics, Textiles)';
COMMENT ON COLUMN processes.redestination_number IS 'Optional redestination process number (e.g., RED-001)';
```

## Notes

- Both fields are nullable/optional as per F1.1 spec
- The following fields already exist in the DB and don't need migration:
  - `importer_name`
  - `exporter_name`
  - `reference_importer`
  - `booking_number`
  - `bill_of_lading`

## After Migration

Once these columns are added to the database:

1. Update `src/shared/supabase/database.types.ts` by running:
   ```bash
   pnpm run supabase:gen-types
   ```

2. Remove TODO comments from:
   - `src/modules/process/infrastructure/persistence/processMapper.ts` (lines with `// TODO: Add to DB schema`)
   - `src/modules/process/infrastructure/persistence/supabaseProcessRepository.ts` (lines with `// product and redestination_number - TODO: add to DB schema`)

3. Update the mapper to actually use these fields instead of returning `null`
