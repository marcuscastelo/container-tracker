# Typography Audit and Proposal

## 1. Font Size Inventory

This report inventories all font sizes found in application's `src` directory.

|Current Token/Class|Approx px/rem|Occurrences|Main Files|Notes|
| :--- | :--- | :--- | :--- | :--- |
|`text-[7px]`|7px / 0.4375rem|1|`StatusBadge.tsx`|Icon size. Extremely small.|
|`text-[9px]`|9px / 0.5625rem|8|`TimelineNode.layout.tsx`, `ContainerSelector.tsx`, `ShipmentHeader.tsx`, `SearchOverlay.panel.tsx`|Used for meta info, badges, and keyboard shortcuts.|
|`text-[10px]`|10px / 0.625rem|10|`Panel.tsx`, `TimelineNode.layout.tsx`, `TimelineBlocks.tsx`, `SearchOverlay.panel.tsx`|Used for subtitles, meta info, and timestamps.|
|`text-[11px]`|11px / 0.6875rem|8|`StatusBadge.tsx`, `MetricCard.tsx`, `AppHeader.tsx`, `SearchOverlay.panel.tsx`, `SingleSelectOptionsList.tsx`, `MultiSelectOptionsList.tsx`, `ImporterOptionsList.tsx`|Badges, subtitles, and list item counts.|
|`text-[12px]`|12px / 0.75rem|4|`TimelineNode.layout.tsx`, `TimelineBlocks.tsx`, `ActiveFiltersPanel.tsx`, `ActiveFilterChip.tsx`|Labels, filter chips. Equivalent to `text-xs`.|
|`text-xs`|12px / 0.75rem|27|`FormFields.tsx`, `SearchOverlay.panel.tsx`, `PredictionHistoryTable.tsx`, `ContainerSelector.tsx`|Helper text, table headers, keyboard shortcuts, badges.|
|`text-[13px]`|13px / 0.8125rem|16|`AppHeader.tsx`, `TimelineBlocks.tsx`, `UnifiedDashboardFilters.tsx`, `SingleSelectOptionsList.tsx`, `MultiSelectChipDropdown.tsx`, `ImporterChipDropdown.tsx`|Navigation, filter chips, dropdowns.|
|`text-sm`|14px / 0.875rem|50|`FormFields.tsx`, `Dialog.tsx`, `CreateProcessDialog.view.tsx`, `ShipmentHeader.tsx`, `PredictionHistoryTable.tsx`|Body copy, labels, buttons, table content.|
|`text-base`|16px / 1rem|1|`ShipmentHeader.tsx`|Used once responsive breakpoint from `text-sm`.|
|`text-lg`|18px / 1.125rem|4|`EmptyState.tsx`, `Dialog.tsx`, `DashboardScreen.tsx`|Page/section titles, dialog titles.|
|`text-[22px]`|22px / 1.375rem|2|`MetricCard.tsx`, `DashboardMetricsGrid.tsx`|Large metric values.|
|`--font-size-micro`|10px|1|`app.css`|CSS Custom Property|
|`--font-size-label`|11px|1|`app.css`|CSS Custom Property|
|`--font-size-caption`|12px|1|`app.css`|CSS Custom Property|
|`--font-size-body-sm`|13px|1|`app.css`|CSS Custom Property|
|`--font-size-body`|14px|1|`app.css`|CSS Custom Property|

**Observations:**

*   There is huge amount of granularity, especially in smaller font sizes (7, 9, 10, 11, 12, 13px). This is excessive and makes UI inconsistent.
*   `text-[12px]` and `text-xs` are same size.
*   `text-sm` (14px) is most used font size, which makes it good candidate for default body text.
*   jump from `text-lg` (18px) to `text-[22px]` is quite large and only used for metrics.
*   existing CSS variables in `app.css` are not being used by Tailwind's `@theme` and seem to be previous attempt at tokenization.

## 2. Proposed Typographic Hierarchy

Here is proposal for new, simplified typographic hierarchy. It collapses current 11+ sizes into 6, providing more consistent and manageable system.

|Token Name|Size (rem/px)|Line Height|Main Uses|Migration From|
| :--- | :--- | :--- | :--- | :--- |
|`text-micro`|0.625rem (10px)|1rem (16px)|Badges, meta info, icon labels|`text-[7px]`, `text-[9px]`, `text-[10px]`|
|`text-xs-ui`|0.75rem (12px)|1rem (16px)|Helper text, table headers, dense UI elements|`text-[11px]`, `text-[12px]`, `text-xs`|
|`text-sm-ui`|0.8125rem (13px)|1.25rem (20px)|Default body text, form inputs, buttons|`text-[13px]`|
|`text-md-ui`|0.875rem (14px)|1.25rem (20px)|Emphasized body, compact headings|`text-sm`|
|`text-lg-ui`|1rem (16px)|1.5rem (24px)|Section headings, dialog titles|`text-base`, `text-lg`|
|`text-xl-ui`|1.375rem (22px)|1.75rem (28px)|Large metric values, page headings|`text-[22px]`|

**Rationale:**

*   **`text-micro` (10px):** Consolidates all very small text used for non-critical information into single, readable size. 7px and 9px are too small and can cause accessibility issues.
*   **`text-xs-ui` (12px):** Merges `text-[11px]`, `text-[12px]`, and `text-xs`. This will be go-to for secondary information and dense UI components.
*   **`text-sm-ui` (13px):** This new default size is based on frequent usage of `text-[13px]` in interactive elements like filters and dropdowns. It offers good balance between information density and readability for main content.
*   **`text-md-ui` (14px):** Replaces most common size `text-sm`. It can be used for emphasized text or for less dense content areas.
*   **`text-lg-ui` (16px):** combination of `text-base` and `text-lg` for section titles. It provides clear hierarchy without being overly large.
*   **`text-xl-ui` (22px):** This size is reserved for most important numbers on screen, like main metrics on dashboard.

## 3. Proposed Implementation in `src/app.css`

This is recommended implementation of new typographic hierarchy in `src/app.css` using Tailwind's `@theme` feature.

```css
@theme {
  /*
   * Typographic Hierarchy
   * This new scale collapses 11+ legacy sizes into a consistent 6-level system.
   * It prioritizes operational density and clear visual hierarchy for the UI.
  */

  /* Micro/Meta text (10px) */
  --font-size-micro: 0.625rem;
  --font-size-micro--line-height: 1rem;

  /* Dense support text (12px) */
  --font-size-xs-ui: 0.75rem;
  --font-size-xs-ui--line-height: 1rem;

  /* Default body text (13px) */
  --font-size-sm-ui: 0.8125rem;
  --font-size-sm-ui--line-height: 1.25rem;

  /* Emphasized body / Compact heading (14px) */
  --font-size-md-ui: 0.875rem;
  --font-size-md-ui--line-height: 1.25rem;

  /* Section heading (16px) */
  --font-size-lg-ui: 1rem;
  --font-size-lg-ui--line-height: 1.5rem;

  /* Large metric / Page heading (22px) */
  --font-size-xl-ui: 1.375rem;
  --font-size-xl-ui--line-height: 1.75rem;
}
```

## 4. Migration Table

|Today|Tomorrow|Reason|
| :--- | :--- | :--- |
|`text-[7px]`|`text-micro`|Consolidate into single micro size|
|`text-[9px]`|`text-micro`|Consolidate into single micro size|
|`text-[10px]`|`text-micro`|Consolidate into single micro size|
|`text-[11px]`|`text-xs-ui`|Consolidate into single small size|
|`text-[12px]`|`text-xs-ui`|Consolidate into single small size|
|`text-xs`|`text-xs-ui`|Consolidate into single small size|
|`text-[13px]`|`text-sm-ui`|New default body size|
|`text-sm`|`text-md-ui`|New emphasized body size|
|`text-base`|`text-lg-ui`|Consolidate into single heading size|
|`text-lg`|`text-lg-ui`|Consolidate into single heading size|
|`text-[22px]`|`text-xl-ui`|New large metric size|

## 5. Next Steps: Incremental Migration

It is recommended to perform incremental migration to new typographic scale. Here is suggested order of priority:

1.  **Global Styles & High-Impact Components:**
    *   Apply the new tokens to global styles.
    *   Update shared components like `Button`, `MetricCard`, `Panel`, `Dialog`.
2.  **Dashboard & Main Views:**
    *   Refactor the main dashboard, tables, and filters.
    *   These areas will benefit the most from the improved hierarchy.
3.  **Shipment/Process Detail:**
    *   Update the timeline and other detail views.
4.  **Settings & Forms:**
    *   Update form fields and settings pages.
5.  **Edge Cases & One-offs:**
    *   Address any remaining components or unique layouts.

This phased approach will minimize disruption and allow for testing at each stage.
