# Signal School — documentation (v1)

Signal School is a student-management app for schools that teach under-privileged children — first built for
**Signal Shala**, the school in a shipping container at Teen Hath Naka, Thane, run by Samarth Bharat Vyaspeeth for
children who lived and worked at traffic signals. Most teachers are not technical, children come from migrant families
(often without birth certificates), and the school runs on cheap phones with patchy internet, in Marathi, Hindi,
Gujarati and English.

| Document | For | What's inside |
|---|---|---|
| [User stories](user-stories.md) | Everyone | Personas, user stories with acceptance criteria, and where each is implemented |
| [User guide](user-guide.md) | Teachers, office staff | Step-by-step: first login, attendance, students, syllabus, new academic year |
| [Architecture](architecture.md) | Developers | Stack, modules, data model, multi-school, academic years, offline, languages |
| [API reference](api.md) | Developers | Every endpoint with its permission, conventions, error codes |
| [Security](security.md) | Developers, admins | Threat model, controls in place, privacy of children's data, dependency policy |
| [Testing strategy](testing.md) | Developers, testers | Test pyramid, how to run each layer, what a release must pass, field testing with teachers |
| [Deployment & operations](deployment.md) | Admins | Environment variables, first setup, backups, HTTPS headers, upgrades |

The web app lives in the sibling repository **Signal-School-Frontend** (its README covers front-end conventions).
