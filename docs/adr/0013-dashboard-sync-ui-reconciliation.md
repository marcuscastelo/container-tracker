# ADR — Dashboard Sync UI Reconciliation

Status: Accepted

---

# Context

The dashboard allows triggering synchronization of container tracking.

Originally, the UI relied on cached resources to display sync state.

This caused issues:

```
global sync executed
→ backend updated state
→ UI still showed old state
```

The dashboard required a hard refresh.

---

# Decision

Adopt a **server-first reconciliation model**.

Pattern:

```
mutation
→ temporary UI state
→ reconcile with server snapshot
```

Realtime events are allowed to update UI state but must not become a second source of truth.

---

# Rules

UI must not:

```
derive sync semantics
```

UI must only reflect:

```
server snapshot
```

---

# Consequences

Benefits:

```
predictable UI
no stale state
realtime works reliably
```

Tradeoff:

```
slightly more refetches
```

But this preserves deterministic behaviour.