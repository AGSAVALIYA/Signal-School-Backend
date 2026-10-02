# Security & privacy

The app holds data about **minors from vulnerable families**: names, photos, addresses, guardians' phones, health notes.
The rule is simple: only the school that admitted a child can see that child, and only staff of that school, each with the
least access their job needs.

## Threat model (what we defend against)

| Threat | Example | Controls |
|---|---|---|
| Another school/trust reading data | Admin of trust B guesses student ids of trust A | Every query filtered by `school_id`; other schools' ids return 404; automated **scope-matrix test** hits every route with another trust's token |
| A teacher acting beyond their class | Teacher edits attendance of a class they don't teach | Role matrix + `assertSectionWrite` on every write; tests |
| Stolen phone / shared phone | Next user opens the app | 15-min access tokens; logout revokes the refresh token, clears offline queue and cached API data; admins deactivate users (sessions end at once) |
| Stolen refresh token | Copied from a phone backup | Tokens stored only as SHA-256 hashes; rotation on every use; a replayed old token (after a 60 s grace for flaky networks) **revokes all sessions** of that user |
| Password guessing | Script tries passwords | Login rate limit (20 / 15 min / IP), account lock after 10 failures (15 min), bcrypt hashes, same answer and similar timing for unknown users |
| Forged tokens | `alg: none`, other secret | JWT verified with HS256 only; secret ≥ 32 chars enforced in production; example secret refused |
| Public photo links | Photo URL shared or guessed | S3 bucket private with 2-hour signed URLs; local storage serves files only with HMAC-signed, expiring links; random UUID keys |
| Malicious uploads | Script disguised as JPEG; decompression bomb | Type allow-list, size limits (8 MB photo, 5 MB sheet), every image decoded and re-encoded by sharp (EXIF/GPS stripped, ≤ 40 MP), invalid images → `FILE_TYPE` |
| Injection | SQL in search box; formula in Excel | Parameterised queries only (Sequelize replacements); zod strips unknown fields (no mass assignment); Excel cells written as text values |
| XSS | Note containing `<script>` | React escapes all text; no `dangerouslySetInnerHTML`; recommended CSP in [deployment](deployment.md) |
| Abuse / DoS | Flood of requests | 1 MB JSON limit, per-IP rate limit (600/min), list page size ≤ 100, import ≤ 2000 rows |
| Log injection | Crafted `X-Request-Id` | Accepted only if `[\w.-]{1,64}`, else replaced |
| Insider mistakes | Clerk deletes a year with data | Children are never hard-deleted; years with data cannot be deleted; closed years read-only; **audit log** of every change (2 years) |

## Privacy choices

- **Aadhaar:** only the last 4 digits are stored. No PAN or bank data for children.
- **Photo consent** flag per child. Photos are compressed and stripped of location data.
- **Teachers** see colleagues' names only, not their phones/emails or login history.
- **Health notes** are visible to staff of the child's school only; deletion limited to the author or admins.
- **WhatsApp/call** buttons open the staff member's own phone apps; the server never sends messages or shares numbers
  with third parties.
- **Retention:** audit log 2 years; refresh tokens deleted 7 days after they expire (maintenance job every 6 hours).
- **Seed script** refuses to run against `NODE_ENV=production` (it wipes the database).

## Dependencies

- `npm audit` must report **0 vulnerabilities** in both repositories (CI runs `npm audit --audit-level=moderate`).
- Transitive fixes are pinned with `overrides` (e.g. `uuid` ≥ 11.1.1 for Sequelize/ExcelJS).
- Prefer maintained, widely used packages; review the changelog of every major upgrade.
- Renovate/Dependabot (recommended) for weekly update PRs; merge only with green CI.

## Operational checklist (production)

- [ ] HTTPS only (TLS at the reverse proxy), HSTS on.
- [ ] `NODE_ENV=production`, a random `JWT_SECRET` of 32+ characters (`openssl rand -base64 48`), kept outside git.
- [ ] `CORS_ORIGINS` set to the web app's exact origin(s).
- [ ] Database user without superuser rights; `DATABASE_SSL=true` when the DB is remote.
- [ ] S3 bucket with **Block all public access**, or a persistent `UPLOAD_DIR` included in backups.
- [ ] Daily encrypted backups of Postgres and uploads; a restore tested every term.
- [ ] Owner accounts limited to trustees; admins reviewed each academic year (deactivate staff who left).
- [ ] Security headers / CSP from [deployment](deployment.md) on the web app.

## Reporting a problem

Email the maintainer (see repository owner) with steps to reproduce. Please do not open public issues containing
children's data.
