# Alert Policy — Fact vs Monitoring

This document formalizes alert behavior.

---

## 1. Alert Categories

- eta
- movement
- customs
- status
- data

Severity:

- info
- warning
- danger
- success

---

## 2. Fact Alerts

Fact alerts:

- Derived from immutable historical events
- May be generated retroactively
- Represent historical truth

Example:

- Customs hold event detected after snapshot ingestion

Fact alerts may include:

- retroactive: true

---

## 3. Monitoring Alerts

Monitoring alerts:

- Represent time-sensitive operational conditions
- Must NOT be retroactively generated
- Must respect temporal context

Example:

- ETA delay detection based on “now”

Monitoring alerts expire when condition no longer holds.

---

## 4. Conflict Handling

If multiple ACTUAL events conflict:

- Emit data alert
- Do not suppress conflicting facts

---

## 5. Alert Idempotency

Alerts must:

- Be deduplicated via fingerprint
- Avoid duplicate emissions
- Preserve auditability

---

## 6. Safety Principle

Alerts must prioritize:

- Operator clarity
- Auditability
- Deterministic behavior
- No silent suppression of data
