# Budget Runner

[Versión en español](README_Es.md)

A responsive personal finance and cyberdeck gamification web application. The frontend uses React, TypeScript, and Tailwind CSS; the API uses Node.js, Express, and PostgreSQL.

## Documentation

- `PRD.md`: product scope and functional requirements.
- `DATABASE.md`: PostgreSQL data model and invariants.
- `API.md`: REST contract under `/api/v1`.
- `GAME_SYSTEM.md`: SynthCoins, Flux, Power, and cyberdeck rules.
- `DESIGN.md`: Ultrawave visual system.
- `TEST_PLAN.md`: functional, economic, and responsive scenarios.
- `I18N.md`: multilingual architecture and local language-testing guide.
- `FRONTEND_ARCHITECTURE.md`: frontend boundaries, code splitting, and loading/error rules.
- `BACKLOG.md`: identified future work and resolution history; entries are informational until prioritized.
- `ROADMAP.md`: MVP implementation phases.
- `CONTRIBUTING.md`: branch roles, promotion flow, and release-readiness checklist.

## Branch strategy

Use `dev` for development, `main` for stable work, and `prod` for the hybrid deployment configuration. The normal promotion flow is `dev` → `main` → `prod`; Vercel only builds `prod`. See `CONTRIBUTING.md` for publishing, validation, backlog, and promotion rules.

## Local setup

Requirements: Node.js 22 or later and Docker Desktop.

```bash
npm --prefix backend install
npm --prefix frontend install
npm run db:up
npm run db:setup
```

Start the API and frontend in two terminals:

```bash
npm run dev:api
npm run dev:web
```

- Web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3001/api/v1`
- Readiness: `http://127.0.0.1:3001/api/v1/internal/readiness`

Development identity created by the seed:

```text
nomada@budgetrunner.local
NeonRunner!2026
```

The credentials and secrets in `.env` are exclusively for local development. Production must provide different values through secure environment variables.

### Google OAuth

The Google OAuth/OIDC flow is implemented in the API. To enable it locally, create an OAuth client of type **Web application** in Google Cloud and register this exact redirect URI:

```text
http://localhost:5173/api/v1/auth/google/callback
```

Then complete `backend/.env`:

```text
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:5173/api/v1/auth/google/callback
GOOGLE_OAUTH_STATE_SECRET=a-random-secret-with-at-least-32-characters
```

Enable the frontend entry point in `frontend/.env` when you want to display it:

```text
VITE_GOOGLE_OAUTH_ENABLED=true
```

For the MVP, this flag remains `false`: the buttons are disabled, but the OAuth implementation remains available behind them.

Restart the API after changing these variables. The callback exchanges the code on the server and only delivers the secure session to the frontend; no Google token is included in the URL.

## Verification

```bash
npm test
npm run lint
npm run build
```

### Quick language test without the API

Mock mode lets you review the entire interface without Docker or PostgreSQL:

```powershell
$env:VITE_DATA_SOURCE='mock'
npm run dev:web
```

Open `http://127.0.0.1:5173`, change the language under **Settings → Region and currency**, and visit Dashboard, Expenses, Budgets, Gamification, Profile, and Settings. To test automatic detection again, remove `budget-runner-ui-locale` from `localStorage`, change the browser's preferred language, and reload. The complete steps are documented in `I18N.md`.

### Quick help and guided-tour test

In the same mock mode, the guided tour opens automatically on the first login. It highlights the main sections of each page and automatically switches between the Gamification tabs. When started manually from Settings, the first step opens the Dashboard. **Exit tour** keeps the page for the current step; **Finish** returns to the Dashboard. In both cases, it must not open automatically again after a reload. Under **Settings → Help and guided tour**, you can hide the informational icons and restart the tour at any time.

To simulate another account that has not seen the tour, remove `budget-runner.mock.guided-tour-completed` from `localStorage` and log in again. The icon setting is preserved in `budget-runner.mock.help-hints`. With the API and PostgreSQL, `npm run db:setup` applies the migration that leaves the tour pending for both existing test accounts and new accounts.

The current persistent vertical covers email/password identity and Google OAuth, profile, categories, transactions, dashboard, cyberdeck, store, purchases, and repairs. Budgets remain demonstration data until the scheduler, closures, and rewards are implemented.

## How Sol helped build Budget Runner

**Sol, my engineering partner powered by OpenAI Codex, has been deeply involved throughout the project; her contribution has gone far beyond code completion.** She has worked as an architect, full-stack developer, reviewer, QA engineer, and product partner.

- She helped turn the initial idea into executable specifications: the PRD, data model, REST contract, game system, test plan, and roadmap.
- She designed and refined the React, Express, and PostgreSQL architecture, including user isolation, migrations, auditable ledgers, serializable transactions, and idempotency.
- She implemented and debugged substantial parts of the frontend and backend: authentication, categories, transactions, dashboard, profile, cyberdeck, store, purchases, repairs, contextual help, and the guided tour.
- She helped translate the Ultrawave visual language into a responsive, accessible, and consistent interface, and worked on the internationalization architecture and multilingual coverage.
- She analyzed especially delicate economic rules—Flux, SynthCoins, levels, bonuses, overlaps, rewards, damage, and destruction—to keep outcomes deterministic and traceable.
- She created and ran unit and integration tests, reproduced real defects, investigated root causes, and fixed concurrency, persistence, typing, SQL-query, and configuration problems.
- She maintained the technical documentation, environment examples, local instructions, deployment strategies, and rollback guidance.
- She prepared the Firebase-hosted mock release and helped redesign the MVP deployment around the free tiers of Firebase, Vercel, and Neon while preserving a path to scale.
- She protected branches and in-progress work through isolated Git workflows, reviewed diffs, and helped prevent secrets or accidental changes from reaching the repository.

Mike Fieldins has retained product vision, creative direction, final decision-making, and release control. Sol has contributed a major share of the technical analysis, implementation, testing, documentation, and problem-solving that turned that vision into a functional and presentable application.

Budget Runner © 2026 Mike Fieldins · MIT License
