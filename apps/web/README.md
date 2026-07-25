# Endurance Fantasy — Web (`apps/web`)

React + TypeScript (Vite) frontend. Player-first; see [`docs/frontend-roadmap.md`](../../docs/frontend-roadmap.md).

## Run

```bash
pnpm install
pnpm dev        # http://localhost:5173 — proxies /api → http://localhost:5239 (start the API first)
```

The dev server proxies `/api/*` to the .NET API (`apps/api`), so the browser is single-origin
(session cookie works, no CORS in dev). In production the client talks to `VITE_API_BASE_URL` directly.

## Scripts

| Script | What |
|---|---|
| `pnpm dev` | Vite dev server (HMR) |
| `pnpm build` | `tsc` typecheck + production build to `dist/` |
| `pnpm gen:api` | Regenerate `src/api/schema.d.ts` from the live OpenAPI doc (API must be running) |
| `pnpm lint` | ESLint |

## Layout

```
src/
├── api/        # typed client (openapi-fetch) + query hooks; schema.d.ts is generated
│   ├── client.ts     # openapi-fetch instance (baseUrl + credentials)
│   ├── queries.ts    # TanStack Query hooks + query keys
│   ├── schema.d.ts   # GENERATED from OpenAPI — do not edit
│   └── types.ts      # TEMP response-DTO bridge (delete once API emits response schemas)
├── app/        # RootLayout (shell)
├── components/ # Logo, GlobalNav, ChampionshipStrip, Demo
├── routes/     # Landing, ComingSoon
├── lib/        # demoStats — the only home for mocked, not-yet-API-backed values
├── router.tsx  # React Router routes
└── index.css   # Tailwind v4 + @theme design tokens (the design system)
```

## Conventions

- **Design tokens** live in `src/index.css` `@theme` — use the generated utilities (`bg-surface`,
  `text-muted`, `font-display`, `border-line`, class colors `text-gtp`/`bg-lmp2`/…). Don't hard-code hexes.
- **Mocked data** goes only in `src/lib/demoStats.ts` and renders wrapped in `<Demo>` so it reads as
  placeholder. Real API data never mixes with it.
- **Hand-rolled components** on the token layer; reach for Radix primitives only for accessible behaviors.
