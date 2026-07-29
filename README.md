# Miniscout T01

## Run stack

```sh
docker compose up --build
```

Admin UI listens on `http://127.0.0.1:8081/admin`. Host bind is loopback only. Override local port without exposing LAN access:

```sh
ADMIN_PORT=9090 docker compose up --build
```

Named `mongo_data` and `profile_data` volumes start empty on first run. Stop and remove seeded data with:

```sh
docker compose down -v
```

## Profile API

`POST /api/admin/profiles` validates and saves JSON under `PROFILE_STORAGE_PATH`, defaulting to `/data/profiles` in backend container. Profile names become `<name>.json` and accept letters, numbers, dots, hyphens, and underscores.

```sh
curl -X POST http://127.0.0.1:8081/api/admin/profiles \
  -H 'Content-Type: application/json' \
  --data-binary @e2e/fixtures/profile.json

curl http://127.0.0.1:8081/api/admin/profiles/e2e-profile
```

Invalid JSON returns HTTP 400 with `errors[]` entries containing `path`, `message`, and `code`.

## Verify

```sh
npm install
npm test
npm run lint
npm run typecheck
npx playwright install chromium
npm run e2e
```
