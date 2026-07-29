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

## Verify

```sh
npm install
npm test
npm run lint
npm run typecheck
npx playwright install chromium
npm run e2e
```
