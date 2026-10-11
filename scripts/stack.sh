#!/bin/sh
# Runs the whole Signal School (database, Redis, API, web app) with Docker Compose.
#
#   npm run stack                 clone/update the web app, build, start, wait until healthy
#   npm run stack -- demo         also load demo data (WIPES the stack's database)
#   npm run stack -- qa           demo data plus the fixed children and logins of the manual QA pack (WIPES it too)
#   npm run stack -- owner --org "Trust" --school "School" --name "Name" --phone 98XXXXXXXX
#   npm run stack -- logs | ps | down
#
# Settings (environment or .env.stack): FRONTEND_REPO, FRONTEND_REF (default main), FRONTEND_DIR (use your own
# checkout instead of cloning), WEB_PORT (default 8080). Secrets are generated once into .env.stack (git-ignored).
set -eu
cd "$(dirname "$0")/.."

ENV_FILE=.env.stack
if [ ! -f "$ENV_FILE" ]; then
  secret() { head -c 48 /dev/urandom | base64 | tr -d '\n/+='; }
  # Private file, without changing the umask for the rest of the script (the web app clone must stay readable).
  touch "$ENV_FILE" && chmod 600 "$ENV_FILE"
  cat > "$ENV_FILE" <<EOF
# Created by scripts/stack.sh. Keep it private; changing JWT_SECRET logs everyone out.
POSTGRES_PASSWORD=$(secret)
JWT_SECRET=$(secret)
WEB_PORT=8080
WEB_ORIGIN=http://localhost:8080
EOF
  echo "Created $ENV_FILE with new secrets."
fi
set -a
. "./$ENV_FILE"
set +a

FRONTEND_REPO=${FRONTEND_REPO:-https://github.com/AGSAVALIYA/Signal-School-Frontend.git}
FRONTEND_REF=${FRONTEND_REF:-main}
if [ -n "${FRONTEND_DIR:-}" ]; then
  # Your own checkout: used as it is, never changed by this script.
  [ -f "$FRONTEND_DIR/Dockerfile" ] || { echo "No Dockerfile in FRONTEND_DIR=$FRONTEND_DIR" >&2; exit 1; }
  FRONTEND_CONTEXT=$(cd "$FRONTEND_DIR" && pwd)
else
  FRONTEND_CONTEXT=.stack/frontend
fi
export FRONTEND_CONTEXT

compose() { docker compose --env-file "$ENV_FILE" "$@"; }

fetch_frontend() {
  [ -n "${FRONTEND_DIR:-}" ] && return
  if [ -d .stack/frontend/.git ]; then
    echo "Updating web app ($FRONTEND_REF)…"
    git -C .stack/frontend fetch --quiet --depth 1 origin "$FRONTEND_REF"
    git -C .stack/frontend checkout --quiet --force FETCH_HEAD
  else
    echo "Cloning web app ($FRONTEND_REPO, $FRONTEND_REF)…"
    mkdir -p .stack
    git clone --quiet --depth 1 --branch "$FRONTEND_REF" "$FRONTEND_REPO" .stack/frontend
  fi
}

up() {
  fetch_frontend
  compose up -d --build --wait
  echo
  echo "Signal School is running: ${WEB_ORIGIN:-http://localhost:${WEB_PORT:-8080}}"
  echo "First time? Create the owner account:  npm run stack -- owner --org \"…\" --school \"…\" --name \"…\" --phone 98XXXXXXXX"
  echo "Or try it with demo data:              npm run stack -- demo"
}

cmd=${1:-up}
[ $# -gt 0 ] && shift
case "$cmd" in
  up) up ;;
  demo | qa)
    compose ps --status running --services | grep -qx api || up
    if [ "$cmd" = qa ]; then compose exec api node scripts/seed.js --force --qa; else compose exec api node scripts/seed.js --force; fi
    # Drop answers cached from the old data (with an outside Redis they expire within a minute).
    compose exec redis redis-cli FLUSHDB >/dev/null 2>&1 || true
    echo "Demo logins (password password123): owner@demo.test, principal@demo.test, clerk@demo.test, sunita@demo.test (teacher)"
    ;;
  owner) compose exec api node scripts/create-owner.js "$@" ;;
  thumbnails) compose exec api node scripts/make-thumbnails.js ;;
  logs) if [ -t 1 ]; then compose logs -f "$@"; else compose logs "$@"; fi ;; # follow only in a terminal
  ps) compose ps ;;
  down) compose down "$@" ;;
  *)
    echo "Usage: npm run stack -- [up|demo|qa|owner …|thumbnails|logs|ps|down]" >&2
    exit 1
    ;;
esac
