#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

say() { printf "\n🌸 %s\n" "$1"; }

upsert_env_var() {
  local file="$1"
  local key="$2"
  local value="$3"

  mkdir -p "$(dirname "$file")"
  touch "$file"

  if grep -Eq "^${key}=" "$file"; then
    sed -i -E "s|^${key}=.*$|${key}=${value}|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi

  chmod 600 "$file"
}

command -v pnpm >/dev/null || { echo "pnpm no está disponible"; exit 1; }
command -v docker >/dev/null || { echo "Docker no está disponible"; exit 1; }
command -v openssl >/dev/null || { echo "openssl no está disponible"; exit 1; }
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 22)) { console.error(`Se requiere Node >=22.22.0 (actual: ${process.version})`); process.exit(1) }'

if [ ! -f infra/dev/.env ]; then
  DB_PASSWORD="$(openssl rand -hex 18)"
  cat > infra/dev/.env <<EOF
POSTGRES_DB=neni
POSTGRES_USER=neni
POSTGRES_PASSWORD=$DB_PASSWORD
EOF
  chmod 600 infra/dev/.env
fi

set -a
# shellcheck disable=SC1091
source infra/dev/.env
set +a

if [ "${CODESPACES:-false}" = "true" ]; then
  FORWARD_DOMAIN="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
  STOREFRONT_ORIGIN="https://${CODESPACE_NAME}-4321.${FORWARD_DOMAIN}"
  BACKEND_ORIGIN="https://${CODESPACE_NAME}-9000.${FORWARD_DOMAIN}"
else
  STOREFRONT_ORIGIN="http://localhost:4321"
  BACKEND_ORIGIN="http://localhost:9000"
fi

if [ ! -f apps/backend/.env ]; then
  JWT_SECRET="$(openssl rand -hex 32)"
  COOKIE_SECRET="$(openssl rand -hex 32)"

  cat > apps/backend/.env <<EOF
DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5433/${POSTGRES_DB}
REDIS_URL=redis://127.0.0.1:6380
STORE_CORS=http://localhost:4321,http://127.0.0.1:4321,${STOREFRONT_ORIGIN}
ADMIN_CORS=http://localhost:9000,http://127.0.0.1:9000,${BACKEND_ORIGIN}
AUTH_CORS=http://localhost:4321,http://127.0.0.1:4321,http://localhost:9000,http://127.0.0.1:9000,${STOREFRONT_ORIGIN},${BACKEND_ORIGIN}
JWT_SECRET=${JWT_SECRET}
COOKIE_SECRET=${COOKIE_SECRET}
EOF
  chmod 600 apps/backend/.env
fi

if [ -f apps/backend/.env ]; then
  upsert_env_var "apps/backend/.env" "DATABASE_URL" "postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5433/${POSTGRES_DB}"
  upsert_env_var "apps/backend/.env" "REDIS_URL" "redis://127.0.0.1:6380"
  upsert_env_var "apps/backend/.env" "STORE_CORS" "http://localhost:4321,http://127.0.0.1:4321,${STOREFRONT_ORIGIN}"
  upsert_env_var "apps/backend/.env" "ADMIN_CORS" "http://localhost:9000,http://127.0.0.1:9000,${BACKEND_ORIGIN}"
  upsert_env_var "apps/backend/.env" "AUTH_CORS" "http://localhost:4321,http://127.0.0.1:4321,http://localhost:9000,http://127.0.0.1:9000,${STOREFRONT_ORIGIN},${BACKEND_ORIGIN}"
  if ! grep -Eq '^JWT_SECRET=' apps/backend/.env; then
    upsert_env_var "apps/backend/.env" "JWT_SECRET" "$(openssl rand -hex 32)"
  fi
  if ! grep -Eq '^COOKIE_SECRET=' apps/backend/.env; then
    upsert_env_var "apps/backend/.env" "COOKIE_SECRET" "$(openssl rand -hex 32)"
  fi
fi

if [ ! -f apps/storefront/.env ]; then
  cat > apps/storefront/.env <<EOF
PUBLIC_MEDUSA_BACKEND_URL=${BACKEND_ORIGIN}
PUBLIC_MEDUSA_PUBLISHABLE_KEY=${NENI_STORE_PUBLISHABLE_KEY:-}
EOF
  chmod 600 apps/storefront/.env
fi

if [ -f apps/storefront/.env ]; then
  upsert_env_var "apps/storefront/.env" "PUBLIC_MEDUSA_BACKEND_URL" "${BACKEND_ORIGIN}"
  if ! grep -Eq '^PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_' apps/storefront/.env; then
    existing_publishable="$(grep -E '^PUBLIC_MEDUSA_PUBLISHABLE_KEY=' apps/storefront/.env | cut -d= -f2- || true)"
    if [ -n "${NENI_STORE_PUBLISHABLE_KEY:-}" ] && [ "${NENI_STORE_PUBLISHABLE_KEY:-}" != "" ]; then
      upsert_env_var "apps/storefront/.env" "PUBLIC_MEDUSA_PUBLISHABLE_KEY" "${NENI_STORE_PUBLISHABLE_KEY}"
    elif [ -n "$existing_publishable" ] && [ "$existing_publishable" != "" ]; then
      :
    fi
  fi
fi

say "Levantando PostgreSQL y Redis"
docker compose -f infra/dev/compose.yaml --env-file infra/dev/.env up -d

say "Esperando PostgreSQL"
for _ in $(seq 1 30); do
  if docker compose -f infra/dev/compose.yaml --env-file infra/dev/.env exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker compose -f infra/dev/compose.yaml --env-file infra/dev/.env exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null

say "Aplicando migraciones Medusa"
(
  cd apps/backend
  pnpm exec medusa db:migrate
)

say "Aplicando bootstrap de desarrollo Neni"
pnpm neni:bootstrap

say "Entorno base listo"
echo "Backend:    $BACKEND_ORIGIN"
echo "Storefront: $STOREFRONT_ORIGIN"

echo
echo "Siguiente comando:"
echo "  pnpm neni:dev"
