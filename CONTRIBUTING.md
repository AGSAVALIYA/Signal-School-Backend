# Contributing

Thank you for helping a school for children who would otherwise be on the street. Please read [AGENTS.md](AGENTS.md)
(setup, project map, rules) before your first change.

## Workflow
1. Open or pick an issue. Describe the problem in the words of the teacher or clerk who has it.
2. Branch from `main` (`feature/<short-name>` or `fix/<short-name>`).
3. Keep each commit focused; the message says **what and why** and ends with `Fixes #<issue>` when it closes one.
4. Before pushing: `npm run lint && npm run format:check && npm test && npm audit --audit-level=moderate`.
5. Open a pull request to `main`; CI must be green. Changes to the API contract need the matching web-app PR linked.

## Rules of thumb
- Every new route: permission, validation, school scoping and a test (the scope-matrix test catches the obvious misses).
- New error code → message in `src/utils/errors.js` and translations in all four web locale files.
- New user-visible behaviour → update `docs/user-stories.md` and `docs/user-guide.md`; new endpoint → `docs/api.md`.
- Never commit `.env`, real student data, photos or exports. Use `npm run db:seed` data in examples and screenshots.
- Add a line to `CHANGELOG.md` under "Unreleased".
