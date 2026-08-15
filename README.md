# Miniscout

## Run stack

```sh
docker compose up --build
```

Two reverse proxies come up:

- Admin UI on `http://127.0.0.1:8083/admin` — loopback only, never reachable from LAN.
- Scouter UI on `http://0.0.0.0:8084/scout` — bound to all interfaces. Scouters scan the QR or visit the URL from a phone on the same LAN.

Override the host ports without exposing LAN access:

```sh
ADMIN_PORT=9090 SCOUTER_PORT=9091 docker compose up --build
```

Named `mongo_data` and `profile_data` volumes start empty on first run. Stop and remove seeded data with:

```sh
docker compose down -v
```

### Mobile access via Cloudflare Quick Tunnel (opt-in)

To let scouters reach the mobile UI off-LAN (no port-forwarding, no domain), bring the stack up with the `tunnel` profile:

```sh
docker compose --profile tunnel up --build
```

This starts a `cloudflared` service that opens a Cloudflare Quick Tunnel to `scouter-proxy` only — the unauthenticated admin UI never goes through it. The tunnel's `*.trycloudflare.com` URL changes every restart; the backend reads the discovered URL from `GET /api/admin/tunnel-url`, and the "Mint competition" form prefills the LAN scouter URL field with it (still editable). Without the `tunnel` profile, that endpoint returns 404 and the field stays a manual entry, as before.

Design rationale and two non-obvious gotchas (the official `cloudflared` image has no shell; Vite's preview server needs `allowedHosts` opened up for the tunnel hostname) are in [docs/adr/0002-cloudflare-quick-tunnel-mobile-access.md](docs/adr/0002-cloudflare-quick-tunnel-mobile-access.md).

## Profile API (T01)

`POST /api/admin/profiles` validates and saves JSON under `PROFILE_STORAGE_PATH`, defaulting to `/data/profiles` in backend container. Profile names become `<name>.json` and accept letters, numbers, dots, hyphens, and underscores.

```sh
curl -X POST http://127.0.0.1:8083/api/admin/profiles \
  -H 'Content-Type: application/json' \
  --data-binary @e2e/fixtures/profile.json

curl http://127.0.0.1:8083/api/admin/profiles/e2e-profile
```

Invalid JSON returns HTTP 400 with `errors[]` entries containing `path`, `message`, and `code`.

## Scouter flow (T02)

1. Admin mints a Competition under `/admin/competitions`. Provide a Competition `name`, a ScoringProfile `name`, and a LAN base URL (the `http://<lan-ip>:<scouter-port>` that scouters visit). The response contains the QR token and a fully encoded `qr_url`.
2. Admin shows the QR (rendered client-side via `qrcode.react`) to scouters.
3. Scouter scans the QR or visits `http://<lan-ip>:<scouter-port>/scout?c=<token>` on a phone. The scouter flow is rendered as a typed form driven by the active Profile:
   - `counter` → `+/-` stepper
   - `enum` → radio list (one option per `points_per_option` key)
   - `boolean` → switch
   - `number` → numeric input
   - `note` → textarea
4. On first visit the scouter enters a display name. The server issues an `HttpOnly` cookie `scouter_cookie_id` with a 7-day TTL and persists the display name keyed by the cookie id.
5. As the scouter edits match number / team number / field values, the draft auto-saves (~400 ms debounce) via `PUT /api/competitions/:token/draft`. Reloading the page restores the draft.
6. Submit posts `POST /api/competitions/:token/records` and returns `201` with the record id. Multiple scouters may submit records for the same `(match_number, team_number)`; no uniqueness constraint, no collision rejection.
7. Admin views submitted records at `/admin/competitions/:id`. Columns: `submitted_at`, `match_number`, `team_number`, `scouter_name`.

## Scoring engine

`backend/scoring.ts` exports `calculateEstimatedScore(recordValues, profile)`. The function is pure: no DB, no I/O, only the raw `values` object and the active ScoringProfile in scope. Each field contributes:

- `counter` / `number` — `value × points_per_unit` (zero when either operand is missing or non-finite).
- `boolean` — `points_per_unit` when `value === true`, otherwise `0`.
- `enum` — `points_per_option[value]`; missing key or non-string value yields `0`.
- `note` — `0`.

Scores aggregate by phase, by scoring target, and as a grand total. Fields attached to a phase contribute to that phase's sub-score; fields with `phase: null` or no declared phase contribute to `total` only. The pure module is exercised by `backend/scoring.test.ts` (42 cases covering each field type × each points shape).

## CSV export

The admin page exposes an **Export CSV** button. Behind it:

```sh
curl -X POST http://127.0.0.1:8083/api/admin/export/records.csv -o records.csv
```

The handler reads the active Competition (newest by `created_at`), loads its referenced `ScoringProfile` from the shared volume, and emits one row per `ScoutRecord`:

```
competition_id,match_number,team_number,scouter_name,submitted_at,red_score,blue_score,[field keys in profile order…],estimated_score.total
```

`red_score` and `blue_score` are always empty in this milestone (filled by T06). `estimated_score.total` is recomputed on every read using the pure scoring engine so Profile edits always reflect. CSV escaping follows RFC 4180: cells containing `,`, `"`, `\r`, or `\n` are quoted and embedded quotes are doubled.

## Match broadcast API (T04)

`Competition.current_match_number` is shared across every connected scouter via Server-Sent Events. Last write wins across all writers.

```sh
# Read current value
curl http://127.0.0.1:8083/api/scouter/competition/default

# Set / override (admin)
curl -X PUT http://127.0.0.1:8083/api/admin/competition/default/match-number \
  -H 'Content-Type: application/json' \
  -d '{"value": 12}'

# Clear
curl -X DELETE http://127.0.0.1:8083/api/admin/competition/default/match-number

# Subscribe to live updates (text/event-stream)
curl -N http://127.0.0.1:8083/api/scouter/competition/default/stream
```

Body schema for `PUT`: `{ "value": <positive integer> }`. Failures return HTTP 400 with `errors[]` per field. The current value is persisted in the `competitions` MongoDB collection so it survives backend restarts.

The Scouter page at `/scout?c=<token>` subscribes to the live broadcast for the competition it loads. The current value is surfaced as a suggested match number on the form (pre-fills while the input is empty).

## Verify

```sh
npm install
npm test
npm run lint
npm run typecheck
npx playwright install chromium
npm run e2e
```

## Backend layout

The backend is organised by feature. Each feature folder owns its
schema, repository, service, controller, and routes. The composition
root (`backend/app.ts`) wires each router under `/api`. Shared infra
lives in `backend/shared/`.

```
backend/
  app.ts                  composition root — wires each feature router
  server.ts               entry point — boots Mongo + MongoBroadcaster + app
  tsconfig.json
  shared/
    db.ts                 MongoClient + collections + id factories
  test/
    mongo-fixture.ts      mongodb-memory-server fixture for vitest
  features/
    profiles/             admin ScoringProfile upload + fetch
    competitions/         Competition mint/list/lookup-by-QR
    records/              ScoutRecord submit/delete + per-competition groups
    scouter/              Scouter name registration, cookie, draft
    scoring/              pure scoring engine + group aggregation
    broadcast/            current_match_number state + SSE stream
    official-scores/      admin OfficialScore upsert/list + per-match CSV helper
    csv-export/           records.csv + groups.csv generation, Mongo data loader
    teams/                per-team per-match rollup
```

Layered responsibilities:
- `*.schema.ts` — zod input validation
- `*.types.ts` — DTOs and shared types
- `*.repository.ts` — data access only (Mongo or fs)
- `*.service.ts` — orchestrates repositories; no HTTP, no direct DB
- `*.controller.ts` — parses request, validates, calls service, formats response
- `*.routes.ts` — `express.Router()` wiring verbs to controller methods