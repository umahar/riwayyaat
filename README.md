## Riwayyaat (A project by UA)

Next.js 16 + React 19 entry point for Riwayyaat — a research surface focused on isnad graphs, matn analysis, and waitlist onboarding. The UI currently ships a timed splash that transitions into the chat surface.

### Tech Stack

- **Next.js App Router** in `src/app`
- **TypeScript** + absolute imports via `@/*`
- **Tailwind CSS v4** (utility-first, no config file required)
- **Component directories** under `src/components` and shared data in `src/lib`

### Local Development

```bash
npm install              # already run once, repeats are safe
npm run dev              # launch http://localhost:3000 with Turbopack
npm run lint             # eslint -- respects next lint rules
```

### Project Structure

```
src/
  app/                   # Next.js routes, layouts, and global styles
    page.tsx             # Splash screen route
    layout.tsx           # Root metadata + fonts
    globals.css          # Tailwind + custom animations
  components/
    sections/            # Page-level sections (splash hero, etc.)
    ui/                  # Reusable UI atoms
  lib/                   # Site-wide config/constants
public/                  # Static assets
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

PostgreSQL connection scaffolding lives under `src/server/db`. Provide your credentials via environment variables (see `.env.example`). Once populated, you can verify connectivity by running a quick script or importing the helpers in a Node REPL:

```bash
cp .env.example .env.local   # update with your password
node -e "import('./dist/server/db/client.js').then(m => m.healthcheck().then(console.log))"
```

Helpers:

- `src/server/db/config.ts` loads env vars and configures SSL/app name.
- `src/server/db/client.ts` exposes a singleton PG Pool plus `query` and `healthcheck` helpers.
- `src/server/api/hadith-service.ts` is the placeholder service layer to house SQL once the API is wired up.
