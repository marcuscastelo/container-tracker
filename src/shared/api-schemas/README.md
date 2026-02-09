API Schemas — shared zod contracts

Convention

- Keep a single source of truth for API request/response shapes under `src/shared/api-schemas`.
- File naming: `feature.schemas.ts` or `route.schemas.ts` (e.g., `processes.schemas.ts`).
- Export both the zod schemas and TypeScript types (via `export type X = z.infer<typeof XSchema>`).
- Consumers (server routes and front-end) should import schemas from this folder and use `typedRoute`/`typedFetch` helpers.

Example

export const MyRequestSchema = z.object({ ... })
export type MyRequest = z.infer<typeof MyRequestSchema>

Export patterns

export { MyRequestSchema, MyResponseSchema }
export type { MyRequest, MyResponse }

Notes

- Use existing domain schemas where appropriate (don't duplicate canonical domain shapes). For route-level DTOs prefer small request/response schemas that reference domain schemas when needed.
- All schemas must be strict for request bodies (use `.strict()` when appropriate) to make contract changes explicit.
