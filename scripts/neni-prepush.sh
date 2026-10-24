#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$HOME/Proyectos/FloresNeni}"
cd "$ROOT"
BRANCH="$(git branch --show-current)"
echo "=== NENI PRE-PUSH ==="
echo "Branch: $BRANCH"
echo "HEAD:   $(git rev-parse --short HEAD)"
[[ "$BRANCH" != "main" ]] || { echo "ERROR: main es legacy/reference." >&2; exit 1; }
git diff --check
pnpm neni:scripts:check
if git ls-files | grep -Eq '(^|/)\.env$'; then
  git ls-files | grep -E '(^|/)\.env$'
  echo "ERROR: .env real versionado." >&2; exit 1
fi
PATTERN='github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|sk_live_[A-Za-z0-9]+'
if git grep -nEI "$PATTERN" -- ':!pnpm-lock.yaml' ':!docs/**' ':!*.md' >/tmp/neni-secret-scan.txt 2>/dev/null; then
  cat /tmp/neni-secret-scan.txt
  echo "ERROR: posible secreto detectado." >&2; exit 1
fi
git status --short --branch
echo "✅ Neni pre-push OK"
