# Oil Spill Investigation Pipeline — Frontend

Next.js frontend for the SIH 2026 satellite-based oil-spill investigation
platform. Two surfaces:

- **`/`** — the cinematic landing experience (WebGL night ocean, scroll-driven
  investigation narrative)
- **`/investigate`** — the operational GIS investigation workspace

## Requirements

- **Node.js 20 or newer** (developed on 22.x)
- npm 10+

Check with `node -v`. If you're on Node 18 or older, Next.js 16 will fail to
build.

## Setup

```bash
cd oil-spill-pipeline
npm install
npm run dev
```

Open http://localhost:3000 — the dev server picks the next free port if 3000
is taken, so check the terminal output.

**The app runs fine with no further setup.** Everything works out of the box
except the map basemap, which needs a free token (below).

## Mapbox token (optional, but needed for the real basemap)

Without a token the workspace still loads and every control works — you'll
just see a "basemap not configured" note instead of the chart.

To enable it:

1. Create a free account at https://account.mapbox.com
2. Copy your **public** token from
   https://account.mapbox.com/access-tokens/ — it starts with `pk.`
3. Create `oil-spill-pipeline/.env.local`:

   ```bash
   cp .env.example .env.local
   ```

4. Paste the token in:

   ```
   NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1Ijoi...
   ```

5. Restart `npm run dev` if it was already running.

**Each developer should use their own token.** `.env.local` is gitignored and
must never be committed — a token in the repo can have its quota consumed by
anyone who finds it. The free tier is far more than enough for development.

Use a **public** (`pk.`) token, not a secret (`sk.`) one. The public token is
sent to the browser by design, which is how the map renders at all.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build (runs TypeScript) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check only |

## Notes

- The backend is **not required** to run the frontend — there are no API calls
  yet, and all demo data is local sample data.
- `/` is WebGL-heavy. On a machine without a usable GPU it will still run, but
  expect a lower frame rate.
- `?p=<0-1>` on `/` pins the cinematic sequence to a scroll fraction
  (e.g. `/?p=0.55`) — a QA aid for inspecting a single beat.
- Cinematic video plates are not committed; see `public/cinematic/README.md`.
  The procedural WebGL scene is used whenever they're absent.
