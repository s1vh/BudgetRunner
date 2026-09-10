# Budget Runner — Backlog

This file records future work that has already been identified, but **does not authorize its implementation**. The priority and scope of each entry must be confirmed before work begins. The complete workflow is defined in `CONTRIBUTING.md` and `CONTRIBUTING_Es.md`.

## Pending

### BR-BL-005 — Implement real Budget persistence

**Status:** pending

**Priority:** to be determined

Replace the frontend's demonstration budgets with the complete persistent vertical defined in `PRD.md`, `DATABASE.md`, `API.md`, and `GAME_SYSTEM.md`. The work will cover the API, PostgreSQL, the period scheduler, closures, rewards and penalties, as well as the frontend creation and tracking experience.

The implementation must include at least:

- per-user isolation and complete CRUD contracts;
- frequencies, time zones, pauses, resumptions, archiving, and derived periods;
- idempotent closures, concurrency, serializable transactions, and failure recovery;
- auditable calculation of compliance, Flux, SynthCoins, damage, and any compensating adjustment;
- migration from mock data without presenting fictitious budgets as persisted;
- selective invalidation of Dashboard, Budgets, and Gamification;
- unit, integration, scheduler, isolation, and calendar edge-case tests.

### BR-BL-007 — Audit session theft and reuse through cookies

**Status:** pending

**Priority:** high

**Exploratory test owner:** maintainer

Attempt to compromise a Budget Runner session owned by the tester through cookies and related mechanisms to identify debt in refresh tokens, rotation, revocation, `HttpOnly`, `Secure`, and `SameSite` attributes, session fixation or reuse, and indirect exposure through XSS or CSRF. Testing must be limited to the local environment or expressly authorized test accounts; it must never target real users or third-party infrastructure.

When addressing this entry, document the threat model, reproducible steps without secrets, observed evidence, and proposed mitigations. Any fix must be developed in an independent auxiliary branch created from `dev`.

### BR-BL-008 — Polish inactive Cyberdeck slots and navigation logo glare

**Status:** awaiting maintainer validation

**Priority:** low

**Working branch:** `dev`

**Recorded:** September 10, 2026

**Prepared outcome:** empty and destroyed Cyberdeck modules no longer accept pointer or keyboard selection and cannot activate card, connector, or wireframe highlighting. Destroyed modules render a genuinely empty integrity track without the residual zero-length SVG stroke. Empty slots show only their localized “No module” message plus the slot identity and number, omitting Energy, Power, Shield, and the integrity track in both landscape and portrait layouts. The desktop navigation logo adds a subtle red radial glare behind its transparent artwork that eases after the pointer, fades in and out with a short delay, and gently varies its luminance while active, without changing the link behavior or layout.

**Automated verification:** frontend lint, production build, and the code-splitting contract pass.

**Maintainer validation:** confirm inactive hover/click/focus behavior and integrity rendering in both portrait and landscape layouts; sample the empty-slot message in the supported locales; and confirm the logo glare follows the pointer smoothly, stays visually subdued, fades cleanly, causes no layout shift, and remains purely visual. After approval, move this entry to resolved history before promoting the combined `dev` changes to `main`.

## Resolved history

Completed entries are never deleted. They are moved to this section, marked as resolved, and expanded with:

- resolution date;
- a summary of the outcome and any relevant decision;
- pertinent branches, pull requests, or commits;
- verification performed;
- associated documentation or residual debt.

### BR-BL-004 — Remediate npm dependency security advisories

**Status:** resolved

**Resolution date:** September 10, 2026

**Priority:** high

**Working branch:** `codex/fix/npm-security-advisories`, validated by the maintainer before integration into `dev`.

**Commit:** `9861766`.

**Root cause:** both lockfiles retained vulnerable transitive releases despite compatible patched ranges. In addition, `firebase-functions@7.2.5` resolved an implicit Firebase Admin 13 peer whose older Google Cloud Storage and Firestore trees contained vulnerable `fast-xml-parser` and `uuid` nodes. New Vitest, `qs`, Browserslist, and baseline-browser-mapping advisories had also appeared since the original August audit.

**Outcome:** backend direct floors are now `firebase-functions@^7.3.2`, explicit `firebase-admin@^14.3.0`, and `vitest@^4.1.11`; frontend floors are `react-router@^7.18.3` and `vite@^8.3.0`. Compatible transitive versions were refreshed in both lockfiles. Narrow overrides move only `gaxios@6` and `teeny-request@9` to `uuid@11.1.1`; both consumers use the compatible `uuid.v4()` API. No forced audit fix, global override, or Firebase downgrade was used.

**Verification:** clean backend and frontend `npm ci`; full and `--omit=dev` audits for both projects with **0 vulnerabilities**; **39/39 PostgreSQL-backed tests**; root lint and production build; frontend code-splitting contract; and a local smoke test confirming that the compiled Firebase `api` export remains a callable GCF v2 function in `europe-west1` with successful PostgreSQL readiness.

**Residual debt:** backend installation still prints an upstream deprecation notice for `glob@10.5.0`, reached through `firebase-admin > @google-cloud/firestore > google-gax > rimraf`. npm reports no advisory for the resolved tree, so an unsupported forced major override was rejected. Promotion from `dev` to `main` and inclusion in the end-of-day `prod` bundle remain separate approvals.

### BR-BL-003 — Revamp the Gamification visuals

**Status:** resolved

**Resolution date:** August 29, 2026

**Priority:** to be determined

**Working branch:** `codex/feature/cyberdeck-hud`, validated by the maintainer before promotion.

**Outcome:** the section now appears as **Cyberdeck** in the navigation and heading in all eight languages. Overview combines progression metrics and the technical diagram in a single tab. `WRIST CORE` remains untranslated, and each module visually links its card, dashed trace, and a specific part of the wireframe model.

Telemetry allows damaged modules to be repaired from their detail view, displays the SynthCoin cost, and immediately updates Energy and the balance. Intact and destroyed modules show the action as disabled; empty slots no longer open the detail view. The Repairs tab continues to provide the specialized listing.

In portrait orientation, the diagram replaces the wide canvas with compact cards in one or two columns and places a WebGL thumbnail below, without the core or connections. The original widescreen layout is retained in landscape orientation. Only the visible canvas is animated to avoid duplicate graphics work.

**Main commits:** `bd1a92f` (HUD integration and interactions) and `aca241c` (responsive portrait layout).

**Verification:** frontend build and lint, the automated code-splitting contract, and Chromium walkthroughs at 320, 390, 600, and 1280 pixels. Coordinated hover, absence of internal overflow in portrait orientation, modal parity, repair cost and application, disabled states, non-interactive empty slots, and absence of WebGL errors were verified.

**Residual debt:** none identified. The portrait visualization retains hover or focus highlighting, although selecting a card is the primary interaction on touch devices.

### BR-BL-002 — Fix the transparent title in Chrome/Chromium

**Status:** resolved

**Resolution date:** August 29, 2026

**Priority:** to be determined

**Outcome:** `frontend/public/media/BudgetRunner_logo.svg` was simplified, removing the inherited Illustrator structure based on masks and redundant layers. The asset now uses a normalized viewport and a single explicit clip to produce the transparent stripes crossing the words Budget and Runner, without a background or additional hidden raster layers.

**Commit:** `c753255`.

**Verification:** SVG inspection and maintainer visual validation in Chrome/Chromium browsers, with no subsequent reproduction of the original artifacts.

**Residual debt:** an automated Safari check was not run from Windows; the SVG now retains only broadly compatible primitives and attributes.

### BR-BL-006 — Add a SQL injection hardening layer

**Status:** resolved

**Resolution date:** August 27, 2026

**Priority:** high

**Working branch:** `codex/feature/sql-injection-hardening`, validated by the maintainer before promotion.

**Outcome:** all queries executed by routes and services use static SQL text and PostgreSQL parameters. The only dynamic filter builder was replaced with a fixed query containing nullable parameters. The API centrally inspects untrusted text, and the frontend applies the same detection to forms and the HTTP and mock repositories; a rejected transmission cancels requests, purges accessible caches, reloads the application, and displays a neutral Ultrawave notice without describing the countermeasure.

**Relevant decisions:** heuristic detection normalizes percent encoding, Unicode, invisible characters, comments, and several concatenation forms, but is considered defense in depth only. The primary guarantee remains that user values are not interpreted as SQL. Queries also have statement, lock, client, and idle-in-transaction timeouts.

**Commit and review:** `97b664f`; pull request `#5` into `dev`.

**Verification:** 39/39 tests, including authentication, searches, categories, concepts, notes, obfuscation, and false positives; verification that rejections do not alter rows; static invariant against SQL built at runtime; complete lint; production build; and code-splitting contract.

**Residual debt:** no textual detection can recognize every possible obfuscation and it must not be expanded as a substitute for parameterization. The offensive review of sessions and cookies remains separate under `BR-BL-007`.

### BR-BL-001 — Split data loading by functional area

**Status:** resolved

**Resolution date:** August 27, 2026

**Priority:** high

**Working branch:** `codex/feature/data-loading-splitting`, integrated into `dev` after maintainer validation.

**Outcome:** the private global snapshot of nine reads was removed and replaced with TanStack Query 5.102.8 using independent queries for profile, dashboard, transactions, categories, budgets, and each Gamification resource. Session restoration reuses the profile already fetched, and the HTTP and mock repositories share the same granular contract.

**Relevant decisions:**

- independent cache and loading/error states for each route and tab;
- selective invalidations that use the dashboard recalculated by financial mutations;
- Store code and inventory that can be prefetched through hover, focus, selection, or tour;
- immediate skeleton, accessible text after 700 ms, and a slow-provider warning after 3 s;
- retryable errors within the affected section without reloading the application;
- telemetry limited to the latest 200 requests, with normalized routes and no UUIDs or query strings.

**Main commits:** `567e956` (implementation) and `24e81ef` (architecture and test plan).

**Verification:** `npm test` with 13/13 tests, complete lint with no warnings, backend and frontend builds, automated chunk contract, and local walkthrough of Dashboard, Expenses, Budgets, Profile, Settings, and every Gamification tab. The maintainer validated the local experience before authorizing promotion.

**Documentation:** `FRONTEND_ARCHITECTURE.md` defines resources, cache, invalidations, thresholds, and metrics; `TEST_PLAN.md` records cases T-107 through T-111.

**Operational follow-up:** review `window.__BUDGET_RUNNER_API_METRICS__` after the next authorized deployment to observe Vercel and Neon and recalibrate thresholds only if real measurements justify it. This observation does not block resolution of the entry.
