# Deployment & operations

A small NGO server is enough: 1 vCPU, 1–2 GB RAM. Two ways to run it:

- **Docker (recommended)**: one command starts PostgreSQL, Redis, the API and the web app — see [Docker](#docker).
- **By hand**: PostgreSQL 16, Node.js 22, a reverse proxy with HTTPS (Caddy or nginx); the web app is static files.

## Environment variables (API)

| Variable | Required | Example / default | Notes |
|---|---|---|---|
| `NODE_ENV` | yes | `production` | Enables production checks |
| `PORT` | | `3000` | |
| `DATABASE_URL` | yes | `postgres://signal:…@db:5432/signal` | Use a non-superuser role |
| `DATABASE_SSL` / `DATABASE_CA` | | `true` / PEM with `\n` | For managed/remote databases |
| `JWT_SECRET` | yes | `openssl rand -base64 48` | ≥ 32 chars in production; changing it logs everyone out |
| `ACCESS_TOKEN_TTL` | | `15m` | |
| `REFRESH_TOKEN_DAYS` | | `30` | |
| `CORS_ORIGINS` | yes | `https://app.signalschool.org` | Comma-separated exact origins |
| `PUBLIC_API_URL` | when web and API are on different origins and local storage is used | `https://api.signalschool.org` | Makes photo links absolute |
| `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | | | Leave `S3_BUCKET` empty to store files on disk |
| `UPLOAD_DIR` | | `uploads` | Must be persistent and backed up when used |
| `LOG_LEVEL` | | `info` | |
| `LOGIN_RATE_LIMIT` | | `20` | Logins per IP per 15 min. Keep the default in production; raise only for local e2e runs |
| `API_RATE_LIMIT` | | `600` | Requests per IP per minute across the API; raise only for load tests |
| `REDIS_URL` | when running more than one API instance | `redis://redis:6379` | Shares rate limits and the response cache. Optional on one server (in-process cache) |
| `CACHE_TTL` | | `60` | Seconds a cached read may live; writes invalidate at once. `0` turns the cache off |
| `RUN_MIGRATIONS` | | `true` | Docker image only: run migrations before starting. Set `false` when several API containers start together |

Web app: `VITE_API_URL` at build time (empty when the API is served under the same origin at `/api`).

## First installation

```bash
# API
git clone …/Signal-School-Backend && cd Signal-School-Backend
cp .env.example .env            # fill in the values above
npm ci --omit=dev
npm run db:migrate
npm run create-owner -- --org "Samarth Bharat Vyaspeeth" --school "Signal Shala, Thane" --name "Principal Name" --phone 98XXXXXXXX
# prints a one-time password; the owner sets their own at first login
node src/server.js              # run under systemd / pm2 / Docker with restart on failure

# Web
git clone …/Signal-School-Frontend && cd Signal-School-Frontend
npm ci && VITE_API_URL= npm run build    # outputs dist/
```

Then, logged in as the owner, follow the dashboard checklist: academic year → class levels → classes and subjects →
staff → students (or Excel import).

## Reverse proxy (nginx example, single origin)

```nginx
server {
  listen 443 ssl http2;
  server_name app.signalschool.org;
  # ssl_certificate …; ssl_certificate_key …;

  client_max_body_size 10m;
  root /srv/signal-web/dist;

  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;
  add_header Permissions-Policy "camera=(self), geolocation=(), microphone=()" always;
  add_header Content-Security-Policy "default-src 'self'; img-src 'self' data: blob: https://*.amazonaws.com; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;

  location /api/  { proxy_pass http://127.0.0.1:3000; proxy_set_header X-Forwarded-For $remote_addr; proxy_set_header X-Forwarded-Proto $scheme; }
  location /files/ { proxy_pass http://127.0.0.1:3000; }
  location /health { proxy_pass http://127.0.0.1:3000; }

  location = /sw.js { add_header Cache-Control "no-cache"; }
  location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
  location / { try_files $uri /index.html; add_header Cache-Control "no-cache"; }
}
```

`style-src 'unsafe-inline'` is needed by the component library's runtime styles. The API trusts one proxy hop
(`trust proxy = 1`) so rate limits see the real client IP; keep exactly one proxy in front of it.

## Backups & restore

```bash
# nightly (cron), keep 30 days, copy off the server
pg_dump --format=custom --file=/backups/signal-$(date +%F).dump "$DATABASE_URL"
tar czf /backups/uploads-$(date +%F).tgz uploads/      # only when files are stored on disk
# restore
pg_restore --clean --if-exists --dbname="$DATABASE_URL" /backups/signal-2026-10-01.dump
redis-cli -u "$REDIS_URL" FLUSHDB                       # only with Redis: drop answers cached from the old data
```

With Docker:

```bash
docker compose --env-file .env.stack exec -T db pg_dump -U signal --format=custom signal > /backups/signal-$(date +%F).dump
docker run --rm -v signal-school_uploads:/u -v /backups:/b alpine tar czf /b/uploads-$(date +%F).tgz -C /u .
# restore
docker compose --env-file .env.stack exec -T db pg_restore -U signal --clean --if-exists -d signal < /backups/signal-2026-10-01.dump
docker compose --env-file .env.stack exec redis redis-cli FLUSHDB
```

Test a restore on a spare database once per term. Encrypt backups that leave the server.

## Upgrades

1. Back up the database.
2. `git pull && npm ci --omit=dev && npm run db:migrate` (migrations are transactional SQL; `npm run db:rollback` reverts
   the last one).
3. Restart the API, then deploy the new web `dist/`. Open tabs show "A new version is available"; old tabs that try to
   load removed code reload themselves once.

With Docker: back up, `git pull`, `npm run stack` (migrations run when the API container starts).

Photos uploaded before thumbnails existed (or imported from the old app): `npm run thumbnails` once
(`npm run stack -- thumbnails` with Docker). Lists show initials until a thumbnail exists.

## Monitoring

- `GET /health` returns 200 with the version, or 503 when the database is unreachable — point an uptime checker at it.
  `"redis": "down"` means the API is running without its cache (slower, still correct); `"off"` means no Redis configured.
- Logs are JSON (pino) with `requestId`; users can quote the request id shown in error reports.
- Watch for repeated `401 SESSION_EXPIRED` from one user after a refresh-token reuse (possible stolen token): reset their
  password.

## Docker

`docker-compose.yml` in this repository runs everything on one machine:

| Service | Image | Notes |
|---|---|---|
| `db` | `postgres:16-alpine` | Data in the `db-data` volume; not published outside Docker |
| `redis` | `redis:7-alpine` | Cache and rate-limit counters only: no persistence, 128 MB, oldest keys evicted |
| `api` | built from `Dockerfile` | Runs migrations, then the API as the `node` user; photos in the `uploads` volume |
| `web` | built from the web app's `Dockerfile` | nginx: the app, `/api` and `/files` proxied to `api`, gzip, security headers. Published on `WEB_PORT` (8080) |

```bash
npm run stack                    # first run: creates .env.stack with random secrets, clones the web app into
                                 # .stack/frontend, builds both images, starts all four and waits until healthy
npm run stack -- owner --org "Samarth Bharat Vyaspeeth" --school "Signal Shala, Thane" --name "Principal" --phone 98XXXXXXXX
npm run stack -- demo            # or: demo data instead (WIPES the stack's database)
npm run stack -- ps | logs | down
npm run stack                    # later: pulls the latest web app, rebuilds, restarts what changed
```

Options (environment variables or lines in `.env.stack`): `FRONTEND_REF` (branch/tag of the web app, default `main`),
`FRONTEND_REPO`, `FRONTEND_DIR` (use your own checkout as it is), `WEB_PORT`, `WEB_ORIGIN`, `S3_BUCKET` and AWS keys,
`LOGIN_RATE_LIMIT`, `LOG_LEVEL`. Keep `.env.stack` private and backed up: changing `JWT_SECRET` logs everyone out,
and `POSTGRES_PASSWORD` is fixed once the database volume exists.

**HTTPS.** The `web` container speaks plain HTTP. Put Caddy or a host nginx with a certificate in front of port 8080,
set `WEB_ORIGIN=https://your.domain` in `.env.stack`, and in `docker/nginx.conf.template` of the web app enable
`set_real_ip_from` for that proxy (so rate limits see each phone's IP, not the proxy's) and the
`Strict-Transport-Security` header. Example `Caddyfile`: `app.signalschool.org { reverse_proxy localhost:8080 }`.

**Images on their own.** `docker build -t signal-school-api .` here and `docker build -t signal-school-web .` in the web
app. The web image takes `API_UPSTREAM` (default `http://api:3000`) at run time and `VITE_API_URL` as a build argument.
