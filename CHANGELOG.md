# Changelog

All notable changes to the Signal School API. Dates are release dates; the format follows
[Keep a Changelog](https://keepachangelog.com/) and versions follow [Semantic Versioning](https://semver.org/).

## Unreleased

### Added
- `GET /students/possible-duplicates` — similar name or same guardian phone, so returning children are re-admitted (#3).
- Dashboard `consecutiveAbsences`: children absent on their latest 3+ marked school days (#4).
- `GET /students/:id/attendance?month=YYYY-MM` — one child's month with holidays and totals (#5).
- `GET /audit?areas=` filter by area of the app.
- `AGENTS.md`, `CONTRIBUTING.md`, screenshots in the docs (#6).
- Seed data: guardian languages and an absence streak per class for demos.

## 1.0.0

First release for Signal School.

### Added
- Schools and trusts with roles (owner, admin, clerk, teacher) and per-school permissions.
- Students with yearly enrollments, GR numbers, approximate age, Excel import/export, leaving and re-admission with destination school.
- One-call attendance per class with offline-safe "newest mark wins", edit window, holidays and weekly offs, monthly register.
- Diary notes with photos, syllabus with "taught" ticks, marks and report cards, health check-ups with follow-ups.
- Academic years with a rollover wizard (copy classes, subjects, syllabus, teachers; promote/detain/leave/graduate), read-only past years and timed unlock.
- Principal dashboard, teacher home, activity log.

### Security
- JWT pinned to HS256, rotating refresh tokens with reuse detection, constant-time login, lockout and rate limits.
- Private files via S3 signed URLs or HMAC-signed local links; images re-encoded; strict tenant scoping tested on every route.
