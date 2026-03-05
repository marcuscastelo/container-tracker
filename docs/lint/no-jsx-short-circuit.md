# no-jsx-short-circuit

Rule: `container-tracker/no-jsx-short-circuit`

## Goal

Disallow conditional JSX rendering with short-circuit expressions:

```tsx
{cond && <Component />}
```

Use Solid canonical control flow instead:

```tsx
<Show when={cond}>
  <Component />
</Show>
```

## Scope

The rule runs as `error` for:

- `src/modules/*/ui/**/*.tsx`
- `src/capabilities/*/ui/**/*.tsx`
- `src/shared/ui/**/*.tsx`

## Detection Model

The rule only flags **explicit JSX in AST** on the right branch of `&&` inside `JSXExpressionContainer`.

It includes:

- `JSXElement`
- `JSXFragment`
- Wrapped forms with `ParenthesizedExpression`, `TSNonNullExpression`, `TSAsExpression`, `TSTypeAssertion`, `TSSatisfiesExpression`
- Conditional right branch that renders JSX (`cond && (x ? <A/> : <B/>)`)
- Nested logical right branch that ends in JSX (`a && (b && <A/>)`)

It intentionally does **not** infer JSX through call/function return values:

- `cond && foo?.bar()`
- `cond && renderMaybe()`
- `cond && (() => <A/>)`
