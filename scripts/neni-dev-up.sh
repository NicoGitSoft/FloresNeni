#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$HOME/Proyectos/FloresNeni}"
cd "$ROOT"

echo "=== NENI DEV UP ==="

docker compose -f infra/dev/compose.yaml up -d

if curl -fsS http://127.0.0.1:9000/health >/dev/null 2>&1; then
  echo "Backend ya estaba activo ✅"
else
  echo "Levantando backend..."
  nohup pnpm --filter @dtc/backend dev > /tmp/neni-backend.log 2>&1 < /dev/null &
  echo $! > /tmp/neni-backend.pid
fi

if curl -fsS http://127.0.0.1:4321/ >/dev/null 2>&1; then
  echo "Storefront ya estaba activo ✅"
else
  echo "Levantando storefront..."
  nohup pnpm --filter @neni/storefront dev > /tmp/neni-storefront.log 2>&1 < /dev/null &
  echo $! > /tmp/neni-storefront.pid
fi

echo "Esperando servicios..."
for i in $(seq 1 60); do
  BACK=0
  FRONT=0
  curl -fsS http://127.0.0.1:9000/health >/dev/null 2>&1 && BACK=1
  curl -fsS http://127.0.0.1:4321/ >/dev/null 2>&1 && FRONT=1

  if [[ "$BACK" -eq 1 && "$FRONT" -eq 1 ]]; then
    echo "Backend + storefront listos ✅"
    exec bash scripts/neni-dev-status.sh "$ROOT"
  fi

  if (( i % 5 == 0 )); then
    echo "  ${i}s backend=$BACK storefront=$FRONT"
  fi
  sleep 1
done

echo "ERROR: los servicios no quedaron listos." >&2
echo "--- backend log ---"
tail -n 80 /tmp/neni-backend.log 2>/dev/null || true
echo "--- storefront log ---"
tail -n 80 /tmp/neni-storefront.log 2>/dev/null || true
exit 1
