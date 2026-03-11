# ADR — Persisted UI Theme (Light/Dark) with Semantic Tokens

Status: Proposed  
Date: 2026-03-11  
Owner: UI Architecture

---

# Context

The application uses Tailwind v4 and semantic tokens defined via `@theme`.

Example:

```
bg-background
text-foreground
border-border
```

The UI must support:

- light theme
- dark theme
- persistent user preference across reloads

Constraints:

- avoid `dark:` utilities scattered across components
- use semantic tokens instead of structural color utilities
- keep UI code clean and expressive
- avoid inline `<script>` bootstrapping logic
- allow runtime switching without full reload

Additionally, the design system should remain compatible with Tailwind v4 token generation through `@theme`.

---

# Decision

The theme system will be implemented using the following architecture:

1. Semantic tokens declared in `@theme`
2. Token values overridden under `html.dark`
3. Theme switching via toggling the root class `dark`
4. User preference persisted in `localStorage`
5. Theme initialization executed by the UI runtime (not inline HTML)

Theme state is therefore controlled by:

```
document.documentElement.classList.toggle("dark")
```

and persisted via:

```
localStorage.setItem("theme", theme)
```

---

# Theme Token Architecture

Tailwind v4 tokens are defined using `@theme`.

Example:

```css
@import "tailwindcss";

@theme {
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.21 0 0);
  --color-panel: oklch(0.98 0 0);
  --color-border: oklch(0.92 0 0);
  --color-accent: oklch(0.62 0.19 262);
}
```

These automatically generate utilities:

```
bg-background
text-foreground
bg-panel
border-border
bg-accent
```

---

# Dark Mode Override

The dark theme overrides only token values:

```css
html.dark {
  --color-background: oklch(0.14 0 0);
  --color-foreground: oklch(0.96 0 0);
  --color-panel: oklch(0.19 0 0);
  --color-border: oklch(0.28 0 0);
  --color-accent: oklch(0.54 0.21 262);
}
```

Components do not change.

Example:

```
<div class="bg-background text-foreground">
```

---

# Runtime Theme Control

Theme switching operates exclusively by toggling the root class.

Example:

```
document.documentElement.classList.toggle("dark")
```

The UI runtime is responsible for:

- reading persisted preference
- applying the class on boot
- persisting changes

---

# Persistence Model

Theme preference is stored in:

```
localStorage["theme"]
```

Allowed values:

```
light
dark
```

On application startup:

1. Read stored preference
2. Apply root class accordingly

Example:

```
const theme = localStorage.getItem("theme")

document.documentElement.classList.toggle(
  "dark",
  theme === "dark"
)
```

---

# UI Usage

Components must use semantic tokens.

Allowed:

```
bg-background
text-foreground
border-border
bg-panel
```

Avoid:

```
bg-white
bg-zinc-900
dark:bg-...
```

---

# Architectural Principles

The system follows these rules:

1. Components consume semantic tokens only.
2. Theme switching is a root concern.
3. UI does not contain theme conditionals.
4. The root class controls the entire theme.

---

# Benefits

- eliminates scattered `dark:` utilities
- consistent design system semantics
- centralized theme logic
- simple runtime switching
- clean Tailwind usage
- stable persistence model

---

# Consequences

Positive:

- cleaner UI code
- semantic styling
- simple theme switching

Tradeoffs:

- requires token discipline
- root class becomes a global styling dependency

Both are acceptable.