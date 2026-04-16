# Templates

Use these as starting points. Adapt them to the actual repo evidence; do not leave placeholders unresolved.

## Closing Comment Template

```md
Closing as `not planned` because the original premise no longer matches the current codebase.

- `<old claim>` is no longer true in `<path-or-symbol>`.
- The current flow in `<path-or-symbol>` already does `<current behavior>`.
- Any remaining concern is now a different scope: `<new scope>`.

If we want to address `<new scope>`, track it in a new issue with explicit API/behavior/test expectations.
```

Use `completed` instead of `not planned` only when the exact requested outcome is already delivered.

## Implementation-Ready Issue Body Template

```md
## Summary

<one paragraph describing the current real problem>

## Current State

- `<path-or-subsystem>` currently does `<observed behavior>`.
- `<path-or-subsystem>` still allows/fails `<relevant case>`.
- Historical wording removed from this issue: `<stale claim>`.

## Desired Outcome

- `<clear behavior change>`
- `<contract or boundary expectation>`
- `<explicit non-goal if needed>`

## Implementation Notes

- Update `<module/boundary>` only.
- Preserve `<invariant or compatibility rule>`.
- If public output changes, keep `<compat note>`.

## Acceptance Criteria

- `<scenario 1>`
- `<scenario 2>`
- `<scenario 3>`
```

## Quick Decision Rubric

Choose `close` when the issue text would mislead an implementer.

Choose `refine` when the issue goal still holds and you can now rewrite it with:

- current code references
- narrowed scope
- explicit acceptance criteria
