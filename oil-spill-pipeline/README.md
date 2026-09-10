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

The landing page at `/` works with no further setup.

**`/investigate` needs the backend running** — it loads real demonstration
cases from the API and runs the actual investigation pipeline. See below.

## Backend (required for /investigate)

The workspace fetches cases from the API and runs the real pipeline, so the
backend must be running or you'll see *"Could not reach the backend"*.

```bash
cd backend
cp .env.example .env          # sets CORS_ALLOWED_ORIGIN=http://localhost:3000
python -m venv .venv          # first time only
.venv/Scripts/activate        # Windows;  source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend runs on http://localhost:8000 — check `GET /api/health`.

**Do not skip `cp .env.example .env`.** Without it the backend defaults to
allowing `http://localhost:5173` (Vite's port, predating this frontend), the
browser blocks every request as a CORS violation, and the frontend reports it
as *"Could not reach the backend"* — the same message you'd get if it weren't
running at all. If the backend is up and you still see that error, this is
almost always why.

No third-party API keys are needed for the backend.

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

- `/` uses its own sample visualisation content and needs no backend. It is an
  introduction, not analysis output.
- `/` is WebGL-heavy. On a machine without a usable GPU it will still run, but
  expect a lower frame rate.
- `?p=<0-1>` on `/` pins the cinematic sequence to a scroll fraction
  (e.g. `/?p=0.55`) — a QA aid for inspecting a single beat.
- Cinematic video plates are not committed; see `public/cinematic/README.md`.
  The procedural WebGL scene is used whenever they're absent.
