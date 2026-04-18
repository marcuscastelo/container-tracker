# HMR: Duplicate/triplicate full-page remount investigation

Date: 2026-03-11

Summary
-------
Observed: in Vite HMR / SolidStart dev, saving files causes shipment/process page to be duplicated vertically (entire screen including navbar/header repeated). This indicates unintended full-tree remount on client during hot reload, not duplicated card.

Goal of this report
- Objective diagnosis of root cause (evidence-backed)
- Minimal, surgical remediation suggestions (NOT applied here)
- Regression checklist to validate after fix

Investigation actions taken
- Searched repository for common HMR/mount patterns: `render(`, `createRoot(`, `import.meta.hot`, `appendChild`, `insertAdjacentElement`, `Portal`, `addEventListener`
- Opened and reviewed `src/entry-client.tsx`, `src/app.tsx`, and `src/shared/localization/i18n.ts`

Key findings / evidence
-----------------------

1) `entry-client` mounts app unconditionally
- File: `src/entry-client.tsx`
- Relevant snippet: mount(() => <StartClient />, root)
- Behavior: on module evaluation code obtains `#app` and calls `mount`. If module is re-evaluated by HMR and previous mounted root is not disposed, calling `mount` again can cause application tree to be mounted second time into same DOM node or create second top-level tree (depending on mount semantics), producing duplicated DOM.

2) Module-level reactive root created in i18n
- File: `src/shared/localization/i18n.ts`
- Relevant snippet: `const localeRoot = createRoot(() => { ... onMount(() => { i18next.init(...); i18next.on('languageChanged', ...) }) ... })`
- Behavior: creating root and attaching listeners during module load is fine for single instantiation, but on HMR module can be reloaded and new root + listeners are created unless old root/listeners are disposed. This causes duplicate listeners and potentially additional reactive roots coexisting.

3) Global listeners and portals exist across app
- Files/locations with global listeners: `src/entry-client.tsx` (window.addEventListener error/unhandledrejection), many UI components (Dialog.tsx uses `Portal` and registers `document.addEventListener('keydown', ...)`), dropdown components attach document/window listeners.
- If such listeners are registered on module/component mounts and are not removed during disposal, repeated HMR reloads leak listeners and can cause repeated side effects or duplicate UI behavior.

4) No project-level `import.meta.hot` explicit dispose found
- Quick repo scan shows no app-level `import.meta.hot.accept` or explicit HMR dispose handlers in app entry modules (search returned no relevant project-level matches). Node modules (plugins) contain HMR code, but app's own modules do not implement explicit dispose hooks.

Most likely root cause (objective hypothesis)
-------------------------------------------

Primary cause: client entry (`src/entry-client.tsx`) and module-level initializers (notably `i18n.ts`) create mounts/roots and global listeners on module evaluation but do not register disposal for HMR. When Vite/solid-refresh re-evaluates modules during HMR, code runs again and performs another `mount(...)` (or re-creates reactive roots/listeners), resulting in multiple mounted app trees or duplicated DOM fragments and duplicated navbar.

Why this explains full-page duplication
- `mount` (or StartClient bootstrap) being invoked again can instantiate second top-level Solid render tree (including app shell/navbar) instead of replacing previous one if previous root was not cleaned up — producing visible full-page duplicate.
- Module-level `createRoot` uses (i18n) add more reactive owners/listeners; even if `mount` respected existing root, duplicated listeners and roots can cause reactivity and side-effects to run multiple times, compounding problem.

Files of interest (evidence pointers)
- `src/entry-client.tsx` — unconditional mount + global `window.addEventListener`
- `src/app.tsx` — `Router` root wrapper; this is app shell that visibly duplicates
- `src/shared/localization/i18n.ts` — `createRoot` at module level + `i18next.on(...)` in `onMount`
- `src/shared/ui/Dialog.tsx` — uses `<Portal>` and registers `document.addEventListener('keydown', ...)`
- `src/modules/process/ui/components/unified/*` — dropdowns with global listeners

Suggested minimal remediation (do not apply here) — high level
---------------------------------------------------------

aim is to ensure module re-evaluation under HMR does not create second active root or leak listeners. Minimal, safe approaches:

1) Make client entry HMR-safe
- Option (preferred): Use runtime's HMR helper or mount API that is HMR-aware. If `@solidjs/start/client` exposes safe `mount` that handles HMR, prefer it; otherwise
- Option B: Guard mount with exported disposer stored on `window` and call it via `import.meta.hot.dispose` before remounting. Example (conceptual):
  - if ((window any).__ct_root_dispose) { (window any).__ct_root_dispose(); }
  - const disposer = mount(...)
  - (window any).__ct_root_dispose = disposer
  - register `import.meta.hot?.dispose(() => { (window as any).__ct_root_dispose?.(); delete (window as any).__ct_root_dispose })`

2) Make module-level singletons (i18n) HMR-disposable
- Export dispose function from i18n module that removes i18next listeners and disposes reactive root when called. On HMR dispose, call that function.
- Alternatively, create i18n root lazily inside function and memoize it so re-imports don't recreate it (but still provide dispose hook for HMR).

3) Ensure UI components register listeners with proper cleanup
- For any `document.addEventListener(...)` or `window.addEventListener(...)` calls, ensure listener is removed with onCleanup or in `dispose` called by HMR. Audit dropdowns/dialogs for missing cleanup.

Notes about avoiding hacks
- Do not hide duplicates with CSS or prevent overflow. correct fix is to ensure disposers are called on HMR, or to avoid re-mounting altogether.

Suggested minimal diff snippets (conceptual, not applied here)
- In `src/entry-client.tsx` wrap mount with attachable disposer on window and HMR dispose hook. Example pseudo-change included in report guidance only.
- In `src/shared/localization/i18n.ts` export `disposeI18n` function that removes `i18next` listeners and, if possible, calls root disposer to tear down reactive root.

Regression checklist (manual validation)
------------------------------------
1. Start dev server (vite). Open shipment/process page.
2. Take screenshot / visually confirm there is only one navbar and one full page.
3. Make multiple edits and save different files that trigger HMR (e.g., change `src/modules/process/*` and `src/shared/localization/*` and `src/routes/*`), saving sequentially 5–10 times.
4. After each save ensure:
   - Navbar remains single (no duplication)
   - Page content (shipment screen) remains single
   - No increasing accumulation of event handler effects (e.g., console logs of same event happening multiple times)
5. Open console and verify there are no duplicate i18n or other warnings repeating on each save (indicating listener leaks)
6. Optionally: run `window.__ct_root_dispose` presence check (if implemented) to ensure disposer exists and is called on HMR dispose.

Limitations of this investigation
--------------------------------
- I could not run dev server in this investigation environment, so confirmation step (runtime behavior under live HMR session) is not executed here — this remains final validation step for proposed remediation.
- report intentionally avoids applying code fixes; it documents minimal, surgical changes that should be applied and tested in follow-up PR.

Next steps (recommended)
------------------------
1. Implement HMR-safe mount wrapper in `src/entry-client.tsx` (small patch) and add `import.meta.hot.dispose` cleanup.
2. Add exported dispose from i18n or lazily initialize it and add HMR disposal.
3. Audit components that register global listeners and ensure they remove listeners on cleanup.
4. Run dev, repeat saves, and validate via regression checklist above.

Appendix: quick pointers to code locations
- `src/entry-client.tsx` (mount + global error listeners)
- `src/app.tsx` (Router root; visible shell)
- `src/shared/localization/i18n.ts` (createRoot + i18next listeners)
- `src/shared/ui/Dialog.tsx` (Portal + key listener)
- `src/modules/process/ui/components/unified/*` (dropdowns with global listeners)

End of report
