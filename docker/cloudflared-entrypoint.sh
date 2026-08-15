#!/bin/sh
set -eu

TUNNEL_URL_FILE="${TUNNEL_URL_FILE:-/data/tunnel/url}"
TUNNEL_TARGET_URL="${TUNNEL_TARGET_URL:-http://scouter-proxy:80}"

mkdir -p "$(dirname "$TUNNEL_URL_FILE")"
rm -f "$TUNNEL_URL_FILE"

# cloudflared logs the discovered *.trycloudflare.com URL to stderr once the
# Quick Tunnel is up; grep it out of the stream and drop it in the shared
# volume so the backend can serve it at GET /api/admin/tunnel-url.
cloudflared tunnel --url "$TUNNEL_TARGET_URL" --no-autoupdate 2>&1 | tee /dev/stderr | {
  while IFS= read -r line; do
    if [ ! -s "$TUNNEL_URL_FILE" ]; then
      url=$(printf '%s' "$line" | grep -oE 'https://[A-Za-z0-9-]+\.trycloudflare\.com' || true)
      if [ -n "$url" ]; then
        echo "$url" > "$TUNNEL_URL_FILE"
      fi
    fi
  done
}
