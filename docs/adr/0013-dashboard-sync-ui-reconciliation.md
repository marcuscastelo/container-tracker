# ADR — Dashboard Sync UI Reconciliation

Status: Accepted

---

# Context

dashboard allows triggering synchronization of container tracking.

Originally, UI relied on cached resources to display sync state.

This caused issues:

```
global sync executed
→ backend updated state
→ UI still showed old state
```

dashboard required hard refresh.

---

# Decision

Adopt **server-first reconciliation model**.

Pattern:

```
mutation
→ temporary UI state
→ reconcile with server snapshot
```

Realtime events are allowed to update UI state but must not become second source of truth.

---

# Rules

UI must not:

```
derive sync semantics
```

Server snapshots are source of truth for sync state; UI may show
transient local or realtime indicators (for example: "syncing" feedback or
brief "success" state) while reconciliation with server is in progress.
These transient indicators must never be treated authoritative long-term
state — UI should always reconcile and display server snapshot once it
has been fetched.

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