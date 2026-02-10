# F1.1 Process Fields Contract

This document defines the canonical field structure for Shipment (Process) entities in the Container Tracker system.

## Version
F1.1 - Existência Operacional (UX básica)

Last Updated: 2026-02-10

## Canonical Field Names

All process/shipment fields MUST use these exact names across all layers (UI, API, domain, DB):

| Field Name              | Type     | Required | Description                                    |
|------------------------|----------|----------|------------------------------------------------|
| `bill_of_lading`       | string   | No       | Bill of Lading number                          |
| `booking_number`       | string   | No       | Booking/reservation number                     |
| `importer_name`        | string   | No       | Name of the importing company                  |
| `exporter_name`        | string   | No       | Name of the exporting company                  |
| `reference`            | string   | No       | Our internal reference (e.g., PO-12345)       |
| `reference_importer`   | string   | No       | Importer's reference number                    |
| `product`              | string   | No       | Product description (e.g., Electronics)        |
| `redestination_number` | string   | No       | Redestination process number                   |
| `origin`               | object   | No       | Planned origin location                        |
| `destination`          | object   | No       | Planned destination location                   |
| `carrier`              | enum     | Yes*     | Shipping carrier                               |
| `containers`           | array    | Yes      | At least one container required                |

*Required for creation, but can be "unknown"

## Container Fields

| Field Name         | Type   | Required | Description                    |
|-------------------|--------|----------|--------------------------------|
| `container_number` | string | Yes      | Container identification       |
| `carrier_code`     | string | No       | Carrier-specific code          |

## Forbidden Fields

The following fields MUST NOT exist in any layer:

- ❌ `operation_type` (import/export/transshipment) - Legacy field, not reliable
- ❌ `container_type` / `equipment_type` (20GP, 40HC, etc.) - Not a reliable or required data point
- ❌ `bl_reference` - Use `bill_of_lading` instead
- ❌ `booking_reference` - Use `booking_number` instead
- ❌ Free-form notes or annotations

### Why These Fields Are Forbidden

**operation_type**: Import/export classification is unreliable and often incorrect from carrier data. The system should focus on tracking facts (observations), not categorizing operations.

**container_type**: Container size/type information from carriers is frequently incorrect or missing. It's not essential for tracking and should not be required or persisted.

## Database Schema

### Existing Columns (No Migration Needed)
- `bill_of_lading`
- `booking_number`  
- `importer_name`
- `exporter_name`
- `reference_importer`

### New Columns (Migration Required)
See `docs/migrations/f1-1-add-product-redestination.md` for:
- `product`
- `redestination_number`

### Legacy Columns (Deprecated, Do Not Use)
- `operation_type` - Marked as legacy, not read or written by domain layer
- `booking_reference` - Use `booking_number` instead

## UI Display Order

When showing process fields in forms, use this order:

1. **Identification Section**
   - Reference (nossa)
   - Importer Name
   - Exporter Name
   - Importer Reference
   - Product
   - Redestination Number

2. **Planned Route Section**
   - Origin
   - Destination

3. **Containers Section**
   - Container Number (required, multiple allowed)

4. **Source / Integration Section**
   - Carrier (required)
   - Bill of Lading
   - Booking Number

## API Contract

### Request (POST /api/processes)

```typescript
{
  reference?: string | null
  origin?: { display_name?: string } | null
  destination?: { display_name?: string } | null
  carrier: Carrier // required
  bill_of_lading?: string | null
  booking_number?: string | null
  importer_name?: string | null
  exporter_name?: string | null
  reference_importer?: string | null
  product?: string | null
  redestination_number?: string | null
  containers: [
    {
      container_number: string // required
      carrier_code: string
    }
  ] // at least 1 required
}
```

### Response

Same structure as request, plus:
- `id`: string (UUID)
- `source`: string
- `created_at`: string (ISO 8601)
- `updated_at`: string (ISO 8601)

## Implementation Status

- [x] UI Updated (CreateProcessDialog)
- [x] Domain Schema Updated
- [x] API Routes Updated
- [x] DTOs/Schemas Updated
- [x] Mappers Updated
- [x] Tests Updated
- [x] i18n Updated (EN, PT-BR, PT-PT)
- [ ] Database Migration Applied (product, redestination_number)

## References

- Issue: F1.1 — Padronização dos Campos do Processo (Shipment)
- Master Document: `docs/Container Tracking Platform — Master Technical & Product Document (0209).md`
