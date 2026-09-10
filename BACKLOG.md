# Budget Runner — Backlog

This file records future work that has already been identified, but **does not authorize its implementation**. The priority and scope of each entry must be confirmed before work begins. The complete workflow is defined in `CONTRIBUTING.md` and `CONTRIBUTING_Es.md`.

## Pending

### BR-BL-004 — Remediate npm dependency security advisories

**Status:** awaiting maintainer validation

**Priority:** high

**Working branch:** `codex/fix/npm-security-advisories`

**Originally detected:** August 27, 2026, with `npm --prefix backend audit` against the then-current lockfile.

**Revalidated:** September 10, 2026. Before remediation, the backend reported **0 critical, 2 high, and 14 moderate affected package nodes**; `--omit=dev` retained **1 high and 12 moderate nodes**. The frontend reported **0 critical, 4 high, and 2 moderate nodes**; `--omit=dev` retained the single high-severity `react-router` advisory. These are affected dependency nodes, not independent vulnerability counts.

#### Root cause

- Both lockfiles retained vulnerable transitive releases even where parent semver ranges already allowed patched versions. This covered `qs`, `postcss`, `nanoid`, `brace-expansion`, `browserslist`, and `baseline-browser-mapping`.
- The direct `react-router@7.18.1` floor still admitted the RSC CSRF advisory fixed after 7.18.1.
- `firebase-functions@7.2.5` automatically resolved its Firebase Admin peer to 13.10.0. That release brought older Google Cloud Storage and Firestore trees containing vulnerable `fast-xml-parser@5.10.0` and `uuid@9.0.1` nodes.
- New `@vitest/mocker`, `qs`, Browserslist, and baseline-browser-mapping advisories had been published since the original August snapshot, which explains the increased September counts.

#### Prepared remediation

- Backend direct floors are `firebase-functions@^7.3.2`, `firebase-admin@^14.3.0`, and `vitest@^4.1.11`. Firebase Admin is now explicit rather than an implicit peer and is compatible with Functions 7.3 and the declared Node 22 runtime.
- The resolved backend tree uses `@google-cloud/firestore@8.7.1`, `@google-cloud/storage@7.22.0`, `fast-xml-parser@5.11.1`, `qs@6.16.0`, `@vitest/mocker@4.1.11`, `vite@8.3.0`, `postcss@8.5.28`, and `nanoid@3.3.18`.
- Google Cloud Storage still constrains `gaxios@6` and `teeny-request@9` to `uuid@^9`. Narrow overrides set only those two legacy consumers to `uuid@11.1.1`; inspection confirms they call the compatible `uuid.v4()` API. No global override and no Firebase downgrade is used.
- Frontend direct floors are `react-router@^7.18.3` and `vite@^8.3.0`. The lockfile resolves `brace-expansion@5.0.9`, `browserslist@4.28.9`, `baseline-browser-mapping@2.11.21`, `postcss@8.5.28`, and `nanoid@3.3.18`.

#### Verification completed

- Clean `npm ci` installations for backend and frontend succeeded without compatibility flags.
- Full and `--omit=dev` audits for both projects report **0 vulnerabilities**.
- Backend `npm ci` still prints an upstream deprecation notice for `glob@10.5.0`, reached through `firebase-admin > @google-cloud/firestore > google-gax > rimraf`. npm reports no advisory for the resolved tree; forcing an unsupported `glob` major would add more risk, so this notice is left for the upstream chain to remove.
- The complete PostgreSQL-backed suite passes: **39/39 tests** across four files.
- Root lint and production build pass; the frontend code-splitting contract also passes.
- The compiled Firebase `api` export is callable, retains the GCF v2 `europe-west1` metadata, and returns a successful PostgreSQL readiness response through the Functions wrapper.

#### Maintainer validation plan

1. Check out `codex/fix/npm-security-advisories` and run clean installs with `npm --prefix backend ci` and `npm --prefix frontend ci`.
2. Run full and production-only audits in each project; all four commands should report 0 vulnerabilities.
3. Start local PostgreSQL, run `npm run db:setup`, then run `npm test`, `npm run lint`, `npm run build`, and `npm --prefix frontend run verify:chunks`.
4. Start the local API and frontend, confirm `/api/v1/internal/readiness`, sign in, and smoke-test Dashboard, Expenses, and Cyberdeck to catch any runtime regression from the Firebase, React Router, or Vite updates.
5. After maintainer approval, merge the topic branch into `dev`, mark this entry resolved with the final commit, and leave promotion to `main` and the end-of-day `prod` bundle as separate approvals.

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

## Resolved history

Completed entries are never deleted. They are moved to this section, marked as resolved, and expanded with:

- resolution date;
- a summary of the outcome and any relevant decision;
- pertinent branches, pull requests, or commits;
- verification performed;
- associated documentation or residual debt.

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
