#!/usr/bin/env bash
# Opcional: permite automação Playwright na janela do Chrome já aberta.
# Feche o Chrome por completo (Cmd+Q), depois execute este script UMA vez.
set -euo pipefail

PORT="${CHROME_REMOTE_DEBUG_PORT:-9222}"
PROFILE="${CHROME_USER_DATA_DIR:-$HOME/Library/Application Support/Google/Chrome}"

echo "Iniciando Chrome com depuração remota na porta ${PORT} (perfil padrão)…"
echo "Depois rode: npm run meta:oauth:auto"

exec "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port="${PORT}" \
  --user-data-dir="${PROFILE}"
