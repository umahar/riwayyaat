## Riwayyaat (A project by UA)

Next.js 16 + React 19 entry point for Riwayyaat — a research surface focused on isnad graphs, matn analysis, and waitlist onboarding. The UI currently ships a timed splash that transitions into the chat surface.

### Tech Stack

- **Next.js App Router** in `src/app`
- **TypeScript** + absolute imports via `@/*`
- **Tailwind CSS v4** (utility-first, no config file required)
- **Feature modules** under `src/features` (e.g., `hadith`, `workspace`) plus shared primitives in `src/components`

### Local Development

```bash
npm install              # already run once, repeats are safe
npm run dev              # launch http://localhost:3000 with Turbopack
npm run lint             # eslint -- respects next lint rules
```

### Project Structure

```
src/
  app/                             # Next.js routes + global styles
  components/                      # Shared UI primitives (ui, footer, sections, theme)
  content/                         # Static copy
  features/
    hadith/                        # Domain types, dummy data, taxonomy helpers, server service
      data.ts
      taxonomy.ts
      server/hadith-service.ts
    workspace/                     # Feature-specific UI + hooks
      components/                  # chat, sidebar, details, etc.
      hooks/use-hadith-data.ts
  server/
    db/                            # Pool + config helpers
    api/                           # Placeholder server APIs
  theme/                           # Design tokens + globals
public/                            # Static assets
```

### UI Notes

- Branded aurora splash shows for 3 seconds then reveals the chat canvas.
- Chat panel includes Riwayyaat logo, descriptive copy, input, and example prompts.
- Responsive layout + soft-glass surfaces tuned for both dark and light modes via CSS custom properties.

### Next Steps

- Wire the chat input + prompt shortcuts to backend endpoints.
- Capture waitlist submissions or integrate an auth flow.
- Expand marketing sections (roadmap, partners, data sources) once content is ready.

## Database Setup

PostgreSQL connection scaffolding lives under `src/server/db`. Provide your credentials via environment variables (see `.env.example`). Empty passwords are supported — just leave `PGPASSWORD=` blank inside `.env.local`. Once populated, you can verify connectivity by running a quick script or importing the helpers in a Node REPL:

```bash
cp .env.example .env.local   # update with your password
node -e "import('./dist/server/db/client.js').then(m => m.healthcheck().then(console.log))"
```

### Handy DB scripts

These TS scripts rely on the same `.env.local` credentials and can be executed with `npx tsx <script>`:

- `scripts/check-db.ts` – lightweight healthcheck.
- `scripts/list-tables.ts` – list public schema tables.
- `scripts/show-narration-levels.ts` – inspect narration-level lookup rows.
- `scripts/seed-hadith.ts` – load the dummy hadithInsights data into the normalized schema.
- `scripts/test-numbering.ts` – verifies hadith numbering backfill (`display_number`) and API payload shape (`displayNumber`, `displayLabel`, `identifiers`).

The `/api/hadith` route and accompanying hooks always read from Postgres, so keep the database running and seeded before launching the UI. Labels for narration levels, attribution types, chain types, narrator tiers, reliability badges, transmission methods, and grade colors/descriptions now come straight from their respective lookup tables — edit those rows to see changes reflected instantly in the UI.

### Seeding dummy data

The seeding script is idempotent and safe to run repeatedly (it upserts lookups and reuses matn/hadith rows). Typical flow:

```bash
npx tsx scripts/check-db.ts        # optional sanity check
npx tsx scripts/seed-hadith.ts     # inserts/updates 42 demo hadith
```

If you add or tweak dummy data in `src/features/hadith/data.ts`, re-run the seed script; subsequent runs only insert missing rows. The script uses transactions/savepoints, so any failure rolls back cleanly.

Helpers:

- `src/server/db/config.ts` loads env vars and configures SSL/app name.
- `src/server/db/client.ts` exposes a singleton PG Pool plus `query` and `healthcheck` helpers.
- `src/features/hadith/server/hadith-service.ts` powers `/api/hadith` and is the single source for domain queries.

### Hadith numbering model

- `hadith.id` remains the stable internal identifier; `hadith.number` is a legacy/internal integer kept for ordering/backcompat.
- `hadith.display_number` (exposed as `details.displayNumber`) is the preferred human-facing label and can hold strings like `45`, `45a`, or `Vol. 2, p. 213, #5`. `details.displayLabel` renders “Book {bookNumber}, Hadith {displayNumber}` with fallback to the legacy number.
- `hadith_identifier` stores scheme-aware identifiers (`schemeKey`, `identifier`, `isPrimary`, optional `notes`). Existing rows are pre-seeded under `schemeKey = legacy_source_number`.
- API responses remain backward compatible: `details.hadithNumber` is preserved while `details.displayNumber`, `details.displayLabel`, and `identifiers` are additive.

## Admin console

- Protect access with `ADMIN_TOKEN` in `.env.local` (middleware checks `/admin/*` and `/api/admin/*`).
- Run migrations in order, including `scripts/migrations/004_add_hadith_soft_delete_and_tags.sql` (adds `hadith.deleted_at`, tag tables).
- Login at `/admin/login`, then manage records at `/admin/hadith` (list/search/filter by source/book/chapter/narrator/tag).
- Create/edit hadith with primary chain, identifiers, tags, and grading; delete performs a soft-delete (`deleted_at`).
- Back-end routes live under `/api/admin/*` with server validation; front-end uses the same Tailwind aesthetic as the main workspace.
