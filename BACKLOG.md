# Budget Runner — Backlog

This file records future work that has already been identified, but **does not authorize its implementation**. The priority and scope of each entry must be confirmed before work begins. The complete workflow is defined in `CONTRIBUTING.md` and `CONTRIBUTING_Es.md`.

## Pending

### BR-BL-007 — Audit session theft and reuse through cookies

**Status:** pending

**Priority:** high

**Exploratory test owner:** maintainer

Attempt to compromise a Budget Runner session owned by the tester through cookies and related mechanisms to identify debt in refresh tokens, rotation, revocation, `HttpOnly`, `Secure`, and `SameSite` attributes, session fixation or reuse, and indirect exposure through XSS or CSRF. Testing must be limited to the local environment or expressly authorized test accounts; it must never target real users or third-party infrastructure.

When addressing this entry, document the threat model, reproducible steps without secrets, observed evidence, and proposed mitigations. Any fix must be developed in an independent auxiliary branch created from `dev`.

### BR-BL-012 — Prevent Flux and streak farming through overlapping Budgets

**Status:** pending product decision

**Priority:** high

The current documented model intentionally permits overlapping global and category Budgets and grants the fixed completion Flux plus one weekly or monthly streak increment for every successful close, including a zero-spend close. A user can therefore create multiple empty or very generous Budgets for the same interval and farm progression even though SynthCoin allocations remain protected against duplication.

Before implementation, define whether completion Flux and streaks belong to each Budget, each canonical calendar cycle, or only to a qualifying close. The chosen rule must preserve legitimate overlapping constraints, remain deterministic under concurrent closure and include a migration policy for existing history. Candidate controls include one streak transition per user/frequency/window, a capped Flux pool per canonical window, and an explicit minimum participation rule. This entry does not authorize changing the current behavior.

### BR-BL-013 — Adopt a lossless monetary wire format

**Status:** pending

**Priority:** medium

The closure engine now uses exact integer arithmetic and isolates aggregates that exceed PostgreSQL `BIGINT`, but the public API DTOs and frontend domain still represent minor units as JavaScript `number`. Individual writes are restricted to safe integers; sufficiently large historical aggregates, balances or direct database imports could nevertheless lose display precision when converted for Dashboard and Budget reads.

Define and migrate to a lossless end-to-end contract, preferably decimal strings for minor units with a shared parser/formatter and explicit range errors. The change must cover transactions, Budget snapshots, Dashboard aggregates, SynthCoin balances, purchases and repairs without silently clamping money. Add compatibility/versioning tests before enabling values outside the current safe display range.

## Resolved history

Completed entries are never deleted. They are moved to this section, marked as resolved, and expanded with:

- resolution date;
- a summary of the outcome and any relevant decision;
- pertinent branches, pull requests, or commits;
- verification performed;
- associated documentation or residual debt.

### BR-BL-005 — Implement real Budget persistence

**Status:** resolved

**Resolution date:** September 11, 2026

**Priority:** high

**Working branch:** `codex/feature/budget-persistence-weekly-store`, validated by the maintainer and promoted through `dev`, `main`, and `prod`.

**Relevant commits:** `423420a` (PostgreSQL schema, Budget engine, weekly store rotation, internal jobs, and backend tests), `cfe722c` (persistent Budget UI, real Dashboard projections, compensating adjustments, and localized integration), `17d2f57` (contracts and operational documentation), `6b93ea2` (final Cyberdeck tab order), and production merge `d1e7de1`.

**Outcome:** demonstration Budgets were replaced by user-isolated PostgreSQL templates and immutable period snapshots. The API supports creation, reading, next-period edits, pause, resume, archive, and historical detail. Calendar boundaries use the account IANA time zone, preserve monthly anchors, and remain correct across DST. Serializable, idempotent closures persist the counted transaction snapshot, reward allocation, Flux, SynthCoins, penalties, and Cyberdeck damage. Rewarded originals remain immutable and accept one linked compensating correction.

The Dashboard now derives its balance, committed capacity, next close, category distribution, and seven monthly cashflow cycles from posted transactions in the primary currency. The Cyberdeck store has one per-user rotation for each global Sunday 02:00 UTC window: a persisted cryptographic seed selects six distinct eligible definitions independently of installed modules or needs, while rarity and price remain level-weighted. The protected weekly job pre-creates rotations and `GET /game/store` provides an idempotent lazy fallback.

**Production rollout:** four additive migrations (`005_custom_cursor_preference.sql`, `007_weekly_store_rotation.sql`, `008_budget_persistence.sql`, and `009_budget_owner_integrity.sql`) were applied before the backend deployment, bringing production to 11 recorded migrations with no duplicate weekly windows. Firebase Hosting received the API-backed frontend; Vercel production received the merged API and both protected jobs. The final runtime compatibility fix is `e6f0405`.

**Verification:** backend and frontend lint, production builds, and the frontend code-splitting contract pass. The final backend suite reports **80/80 tests**, the complete and runtime-only npm audits report **0 vulnerabilities**, Vercel health and PostgreSQL readiness return 200, and the unauthenticated store job returns 401. An authenticated live read returned six distinct offers expiring at `2026-09-13T02:00:00Z`. The maintainer validated Budget persistence and the Cyberdeck store before authorizing promotion.

**Documentation and residual debt:** `GAME_SYSTEM.md`, the API contract, migration notes, test plan, production deployment guide, and demo-reset runbook describe the delivered behavior. Overlapping-Budget progression policy and a lossless monetary wire format remain explicitly separated as `BR-BL-012` and `BR-BL-013`.

### BR-BL-009 — Complete the AI co-author history cleanup on `prod`

**Status:** resolved

**Resolution date:** September 11, 2026

**Priority:** low

**Working branch:** `prod`.

**Root cause:** commit `733a90c` included a Copilot co-author trailer even though M. Fieldins remained the human author and committer and Codex was the intended symbolic collaborator. A complete audit found no other Copilot attribution in the repository history.

**Outcome:** the published histories of `main`, `dev`, `codex/feature/cyberdeck-hud`, and `firebase-mock-deployment` were atomically rewritten with force-with-lease. Rewritten commit `8af4174` replaces the Copilot trailer with the canonical `Co-authored-by: Codex <noreply@openai.com>` trailer. Rewritten commit `cd79b2a`, which prepared the Firebase-hosted mock release for the Devpost hackathon, records the same symbolic Codex co-authorship. Human authorship, commit trees, branch topology, commit counts, and merge counts were preserved.

The authorized production update subsequently advanced remote `prod` from the old `203d372` history to the rewritten line and merged the validated release as `d1e7de1`. Current release commits continue to use the same symbolic Codex trailer without transferring repository ownership or control.

**Verification:** the verified pre-rewrite bundle remains at `.git/codex-backups/pre-copilot-cleanup-733a90c.bundle`; rewritten published refs contain no Copilot trailer and retain the intended Codex trailers; old and new branch tips have identical trees; `git fsck` reported no structural errors; and the rewritten `prod` line deployed successfully.

**Residual debt:** none identified. History rewrites remain exceptional operations and future collaboration attribution should be added only to new commits.

### BR-BL-011 — Add an optional desktop neon cursor

**Status:** resolved

**Resolution date:** September 10, 2026

**Priority:** low

**Working branch:** `dev`, validated by the maintainer and promoted to `main` in merge commit `86ac79e`.

**Relevant commits:** `e8af793` (initial optional cursor), `36b49a5` (tail-free triangular silhouette), and `1395b76` (thicker softened neon geometry).

**Outcome:** desktop devices with a fine pointer now use a lightweight, tail-free triangular SVG cursor. Its hollow silhouette combines a thicker magenta-to-violet-to-cyan neon outline, a soft outer fade, subtly rounded vertices, an asymmetric color blend, a lightly translucent glass core, and an exact hotspot at the leading tip. The feature is enabled by default for new and existing profiles and can be disabled through a Settings switch translated into all eight supported languages. Its value participates in the existing unsaved-changes workflow and persists through both the HTTP repository and the local mock experience.

**Implementation decision:** the protected application shell reflects the preference on the document root so the cursor also covers portaled dialogs and help layers. Its CSS is guarded by `(hover: hover) and (pointer: fine)`, leaving touch devices unchanged. Text fields retain the text cursor and disabled controls retain their unavailable cursor. Migration `005_custom_cursor_preference.sql` backfills `customCursor: true` without overwriting other preference keys and updates the database default.

**Verification:** complete backend and frontend lint and builds, the frontend code-splitting contract, and all 39 PostgreSQL-backed tests passed after applying the migration locally. UI smoke testing covered the enabled default, disabled and enabled persistence across reloads, correct cursor application, preserved text and disabled-control cursors, and all eight localized toggle variants. The maintainer confirmed that the final softened triangular design matched the requested result before merging it to `main`.

**Residual debt:** inclusion in the authorized end-of-day `prod` bundle remains part of the consolidated production promotion; no cursor-specific implementation debt was identified.

### BR-BL-010 — Warn before leaving Settings with unsaved preferences

**Status:** resolved

**Resolution date:** September 10, 2026

**Priority:** low

**Working branch:** `dev`, validated by the maintainer.

**Relevant commits:** `e049efe` (localized navigation guard) and `9d9d990` (viewport-centered responsive dialog).

**Outcome:** Settings detects real differences between the persisted preference switches and profile values. Internal navigation, including browser back and forward actions, opens an accessible confirmation dialog with localized “Save and leave” and “Discard and leave” actions. The warning remains centered in the visible viewport at desktop and mobile sizes, respects device safe areas, and scrolls internally when vertical space is constrained. Saving continues only after persistence succeeds; failures retain the draft and display a localized error. Discarding restores the saved profile values. Reloading or closing the tab is protected by the browser-native unsaved-changes prompt. The immediately persisted language selector does not create a false dirty state, and its current locale controls the confirmation copy in all eight supported languages.

**Implementation decision:** the application uses React Router's data router so navigation blocking relies on the supported router state machine instead of intercepting links or patching browser history. The centered warning is portaled to the document root so the page entrance transform and scroll position cannot alter its viewport positioning. Existing route paths, lazy feature boundaries, authentication, and layout nesting are preserved.

**Verification:** frontend lint, production build, and the code-splitting contract passed. Local UI smoke tests confirmed save-and-leave persistence, discard-and-leave restoration, browser Back protection, navigation without a prompt after returning to the saved value, all eight localized dialog variants, centered placement at 1280×800, 390×844, and 320×480, and no console errors. The maintainer validated the final presentation.

**Residual debt:** none identified. Promotion to `main` and production remains deferred to the maintainer's release flow.

### BR-BL-008 — Polish inactive Cyberdeck slots and navigation logo glare

**Status:** resolved

**Resolution date:** September 10, 2026

**Priority:** low

**Working branch:** `dev`, validated by the maintainer before promotion to `main`.

**Main commits:** `de97a95` (inactive Cyberdeck states), `03ee8fb` (lagged navigation-logo glare), and `aff10f3` (application-wide ambient pointer glow); promoted to `main` by merge commit `3011634`.

**Outcome:** empty and destroyed Cyberdeck modules no longer accept pointer or keyboard selection and cannot activate card, connector, or wireframe highlighting. Destroyed modules render a genuinely empty integrity track without the residual zero-length SVG stroke. Empty slots show only their localized “No module” message plus the slot identity and number, omitting Energy, Power, Shield, and the integrity track in both landscape and portrait layouts. The ambient layer adds a restrained, lagged glow that follows the pointer across the application. Over the desktop navigation logo, the same interaction becomes brighter through a lens flare and brief red/cyan glitch echoes while the original artwork remains continuously visible. Both pointer effects follow the existing Ambient effects preference and suppress their motion when reduced motion is active.

**Verification:** frontend lint, production build, and the code-splitting contract passed. Local UI smoke testing confirmed the linked inactive states, empty integrity rendering, logo legibility without layout shift, pointer tracking across views, and coordinated enable/disable behavior through Ambient effects. The maintainer validated the finished experience before merging it into `main`.

**Residual debt:** none identified. Production promotion remains intentionally deferred to the end-of-day bundle.

### BR-BL-004 — Remediate npm dependency security advisories

**Status:** resolved

**Resolution date:** September 10, 2026

**Priority:** high

**Working branch:** `codex/fix/npm-security-advisories`, validated by the maintainer before integration into `dev`.

**Commit:** `29fb694`.

**Root cause:** both lockfiles retained vulnerable transitive releases despite compatible patched ranges. In addition, `firebase-functions@7.2.5` resolved an implicit Firebase Admin 13 peer whose older Google Cloud Storage and Firestore trees contained vulnerable `fast-xml-parser` and `uuid` nodes. New Vitest, `qs`, Browserslist, and baseline-browser-mapping advisories had also appeared since the original August audit.

**Outcome:** backend direct floors are now `firebase-functions@^7.3.2`, explicit `firebase-admin@^14.3.0`, and `vitest@^4.1.11`; frontend floors are `react-router@^7.18.3` and `vite@^8.3.0`. Compatible transitive versions were refreshed in both lockfiles. Narrow overrides move only `gaxios@6` and `teeny-request@9` to `uuid@11.1.1`; both consumers use the compatible `uuid.v4()` API. No forced audit fix, global override, or Firebase downgrade was used.

**Production compatibility addendum (September 11, 2026):** Vercel packages the Express API as CommonJS and cannot start the Firebase Admin 14 `jwks-rsa`/`jose` path used by the shared development tree. The `prod` overlay therefore pins `firebase-admin@13.10.0`, excludes the unused `firebase-functions` package, and declares `uuid@11.1.1` directly with `"uuid": "$uuid"` so the compatible runtime tree remains free of the later transitive advisory. TypeScript 6.0.3 and source type packages are production dependencies because Vercel compiles after omitting dev dependencies.

**Verification:** clean backend and frontend `npm ci`; full and `--omit=dev` audits for both projects with **0 vulnerabilities**; **39/39 PostgreSQL-backed tests** in the original remediation; root lint and production build; frontend code-splitting contract; and a local smoke test confirming that the compiled Firebase `api` export remains a callable GCF v2 function in `europe-west1` with successful PostgreSQL readiness. The production overlay subsequently passed **80/80 tests**, production-only compilation, direct module loading, and both complete and runtime npm audits with **0 vulnerabilities** before Vercel health and PostgreSQL readiness returned 200.

**Residual debt:** dependency pins in the `prod` overlay are deployment-compatibility constraints and must not be upgraded independently of a Vercel production-only build, module-load check, and runtime audit. npm still prints an upstream `node-domexception` deprecation notice, but reports no advisory for the resolved production tree.

### BR-BL-003 — Revamp the Gamification visuals

**Status:** resolved

**Resolution date:** August 29, 2026

**Priority:** to be determined

**Working branch:** `codex/feature/cyberdeck-hud`, validated by the maintainer before promotion.

**Outcome:** the section now appears as **Cyberdeck** in the navigation and heading in all eight languages. Overview combines progression metrics and the technical diagram in a single tab. `WRIST CORE` remains untranslated, and each module visually links its card, dashed trace, and a specific part of the wireframe model.

Telemetry allows damaged modules to be repaired from their detail view, displays the SynthCoin cost, and immediately updates Energy and the balance. Intact and destroyed modules show the action as disabled; empty slots no longer open the detail view. The Repairs tab continues to provide the specialized listing.

In portrait orientation, the diagram replaces the wide canvas with compact cards in one or two columns and places a WebGL thumbnail below, without the core or connections. The original widescreen layout is retained in landscape orientation. Only the visible canvas is animated to avoid duplicate graphics work.

**Main commits:** `d2137c0` (HUD integration and interactions) and `90e4b99` (responsive portrait layout).

**Verification:** frontend build and lint, the automated code-splitting contract, and Chromium walkthroughs at 320, 390, 600, and 1280 pixels. Coordinated hover, absence of internal overflow in portrait orientation, modal parity, repair cost and application, disabled states, non-interactive empty slots, and absence of WebGL errors were verified.

**Residual debt:** none identified. The portrait visualization retains hover or focus highlighting, although selecting a card is the primary interaction on touch devices.

### BR-BL-002 — Fix the transparent title in Chrome/Chromium

**Status:** resolved

**Resolution date:** August 29, 2026

**Priority:** to be determined

**Outcome:** `frontend/public/media/BudgetRunner_logo.svg` was simplified, removing the inherited Illustrator structure based on masks and redundant layers. The asset now uses a normalized viewport and a single explicit clip to produce the transparent stripes crossing the words Budget and Runner, without a background or additional hidden raster layers.

**Commit:** `234322c`.

**Verification:** SVG inspection and maintainer visual validation in Chrome/Chromium browsers, with no subsequent reproduction of the original artifacts.

**Residual debt:** an automated Safari check was not run from Windows; the SVG now retains only broadly compatible primitives and attributes.

### BR-BL-006 — Add a SQL injection hardening layer

**Status:** resolved

**Resolution date:** August 27, 2026

**Priority:** high

**Working branch:** `codex/feature/sql-injection-hardening`, validated by the maintainer before promotion.

**Outcome:** all queries executed by routes and services use static SQL text and PostgreSQL parameters. The only dynamic filter builder was replaced with a fixed query containing nullable parameters. The API centrally inspects untrusted text, and the frontend applies the same detection to forms and the HTTP and mock repositories; a rejected transmission cancels requests, purges accessible caches, reloads the application, and displays a neutral Ultrawave notice without describing the countermeasure.

**Relevant decisions:** heuristic detection normalizes percent encoding, Unicode, invisible characters, comments, and several concatenation forms, but is considered defense in depth only. The primary guarantee remains that user values are not interpreted as SQL. Queries also have statement, lock, client, and idle-in-transaction timeouts.

**Commit and review:** `65584c0`; pull request `#5` into `dev`.

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

**Main commits:** `2ddda70` (implementation) and `45dc275` (architecture and test plan).

**Verification:** `npm test` with 13/13 tests, complete lint with no warnings, backend and frontend builds, automated chunk contract, and local walkthrough of Dashboard, Expenses, Budgets, Profile, Settings, and every Gamification tab. The maintainer validated the local experience before authorizing promotion.

**Documentation:** `FRONTEND_ARCHITECTURE.md` defines resources, cache, invalidations, thresholds, and metrics; `TEST_PLAN.md` records cases T-107 through T-111.

**Operational follow-up:** review `window.__BUDGET_RUNNER_API_METRICS__` after the next authorized deployment to observe Vercel and Neon and recalibrate thresholds only if real measurements justify it. This observation does not block resolution of the entry.
