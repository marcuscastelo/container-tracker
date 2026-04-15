## Summary

- What changed:
- Why:

## Architecture Boundary

- [ ] Affected boundary is explicit (`domain`, `application`, `infrastructure`, `interface/http`, `ui`, `capability`)
- [ ] Placement is justified (folder + file role match responsibility)
- [ ] No forbidden dependency direction was introduced (`modules -> capabilities`, `domain -> transport/ui`)

## Agent Ownership (`apps/agent`)

- [ ] `process.platform` usage is confined to `apps/agent/src/platform/*`
- [ ] `release/*` does not import `sync/*` or `providers/*`
- [ ] `providers/*` does not import `sync/*` orchestration (ack/polling/retry/finalization)
- [ ] `app/*` remains composition-only (no domain policy imports)
- [ ] Critical contracts were updated only under `apps/agent/src/core/contracts/*`

## Validation / Parsing Mode (ADR-0021)

- [ ] Parsing mode is explicit in the changed code:
  - [ ] `canonical acceptance`
  - [ ] `boundary contract decode`
  - [ ] `tolerant external parsing`
  - [ ] `UI permissive parsing`
- [ ] Domain remains free of transport schema/decode helpers
- [ ] `*.validation.ts` files do not perform network/cache/orchestration IO
- [ ] Parse/decode failures remain explicit (no silent suppression)

## Hotspot Impact

- [ ] This PR does not increase hotspot concentration without rationale
- [ ] If a hotspot grew, rationale and follow-up are documented below
- [ ] Related hotspot (if any):
- [ ] Follow-up action and target sprint:

## ADR Decision Gate

- [ ] Existing docs/ADRs were sufficient for this change
- [ ] If proposing new ADR, evidence is attached:
  - [ ] recurrence across multiple points
  - [ ] boundary/layer ownership impact
  - [ ] insufficiency of existing docs
  - [ ] cannot be solved by local refactor/checklist

## Checks

- [ ] `pnpm check` is green locally
- [ ] Relevant tests for changed behavior were updated
