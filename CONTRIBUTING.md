# Contributing to Budget Runner

[Versión en español](CONTRIBUTING_Es.md)

This file is the canonical reference for repository workflow, branch promotion, and backlog maintenance. Product behaviour and requirements belong in `PRD.md`; identified future work belongs in `BACKLOG.md`; deployment details belong in `DEPLOYMENT_FREE_TIER.md` when that file is present on the deployment branch.

## Branch roles

### `dev`: primary development branch

- Develop new features and bug fixes in `dev`.
- For complex, delicate, or isolated work, create a short-lived topic branch from `dev`, preferably `codex/feature/...` or `codex/fix/...` for work performed with Codex.
- Keep the topic branch available locally and remotely throughout implementation, review, and maintainer validation.
- Do not merge a topic branch into `dev`, or close or delete it, until the maintainer explicitly approves updating the persistent branch. Passing automated checks does not replace that approval.
- After approval, merge the work into `dev`, confirm that the commit is available at its local and remote destination, and only then close the auxiliary branch. Use a different order only when the maintainer expressly requests it.
- When a delivery is awaiting local validation, finish the work with a clean checkout on the exact branch the maintainer must test. If documentation, promotion, or deployment required switching to other branches, return to the validation branch before handing off unless instructed otherwise.
- Code integrated into `dev` is tested locally and requires maintainer acceptance before promotion to `main`. Documentation may be updated and pushed without waiting for that functional validation.

### `main`: stable branch

- Keep `main` in a stable, releasable state.
- Update it from `dev` when a complete feature or coherent set of fixes is ready.
- A completed feature or urgent fix may also be promoted from a secondary development branch when necessary.
- If an urgent fix reaches `main` without passing through `dev`, make sure the same fix is incorporated into `dev` so the branches do not regress.

### `prod`: deployment branch

- Keep the configuration and dependencies required by the hybrid Firebase, Vercel, and Neon deployment in `prod`.
- Deploy releases only from `prod`.
- Once the deployment setup is complete, do not use `prod` for regular feature or bug-fix development.
- Update `prod` only from `main`. When resolving promotion conflicts, preserve the deployment-specific configuration unless the incoming stable change intentionally replaces it.
- Do not merge deployment-only changes back into `main` or `dev` unless they have been reviewed and made environment-independent.

## Promotion flow

```text
topic branch (optional, created from dev)
                    │
                    ▼
                   dev ──────► main ──────► prod ──────► deployment
```

The normal path is `dev` → `main` → `prod`. Topic branches normally return to `dev` after the approval checkpoint described above; direct promotion to `main` is reserved for a completed feature or an urgent fix that justifies it.

## Publishing and deployment

- Commits and topic branches may be pushed as part of normal development after confirming that they contain no secrets or unrelated changes.
- Pushing a topic branch makes it available for testing and review, but does not authorize merging it into `dev`, closing it, or promoting it. Each persistent-branch update requires its corresponding approval.
- Pushing `dev` does not authorize promotion to `main`; promotion requires complete, verified, and accepted code.
- `main` contains stable work only. `prod` is updated only from `main` and never receives feature development directly.
- Vercel uses `prod` as its Production Branch and ignores Git builds from every other branch. A push to `prod` can start a live deployment and requires the corresponding release approval.
- Firebase is deployed only from `prod` using the documented procedure; a Git push does not replace that verification.

## Backlog management

- `BACKLOG.md` is the informational source for identified future work. An entry does not authorize implementation or expand the current thread's scope.
- Before work begins, the maintainer confirms its priority, scope, and acceptance criteria. When started, mark it **in progress** and record the working branch.
- Completed entries are never deleted: mark them **resolved**, move them to the history, and add the date, outcome, decisions, commits or pull requests, verification, and relevant residual debt.
- New findings outside the current scope belong in the backlog instead of being silently added to the implementation.

## Readiness checklist

Before promoting a change:

- Confirm that the feature or fix is complete and internally coherent.
- Run the tests, linting, and builds appropriate to the affected area.
- Update user-facing and technical documentation when behaviour or operations change.
- Check that no credentials, local environment files, generated deployment metadata, or unrelated work are included.
- If maintainer validation is pending, confirm the active branch and leave a clean working tree on that branch.
- When updating `prod`, confirm that its hybrid-deployment configuration still works and that the release is being prepared from `main`.

Remote synchronization during development is allowed, while promotion and deployment remain separate decisions with their own checks.
