# UI Navigation and Reconcile Guideline

This guideline standardizes operational SPA behavior for dashboard/process flows.

## 1) Internal Navigation

- Internal app navigation must use router APIs/helpers only.
- `window.location*`, `location.assign/replace/reload`, and manual `history.pushState` are forbidden.
- Canonical helpers:
  - `buildProcessHref(processId)`
  - `navigateToProcess({ navigate, processId })`
  - `navigateToAppHref({ navigate, href })`

## 2) Intent Prefetch

- Use `prefetchProcessIntent` for hover/focus/pointerdown intent.
- Always preload route + process detail data (best effort).
- Keep dedupe/throttle enabled to avoid request storms.

## 3) Refresh vs Reconcile

- `navigate`: changes visual route.
- `sync action`: asks backend to refresh/sync facts.
- `refetch`: fetches the view data again.
- `reconcile`: updates current view with targeted data refresh without hard reset.

Operational rule:
- Refresh/sync actions must not reload the document.
- Alert ack/unack must stay on the same page and reconcile tracking data in place.

## 4) Failure Isolation

- Surface failures locally (alerts/timeline sections) whenever possible.
- Preserve page shell and user context; avoid full-page blank/error fallback for local failures.
