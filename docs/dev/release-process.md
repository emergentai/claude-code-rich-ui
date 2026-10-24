# rich-ui: Release process

`main` is the production distribution: what users get from
`claude plugin install rich-ui --marketplace emergentai/claude-code-rich-ui`. Nothing
lands on `main` except a finished release, and every commit on `main` is a version.

## Branches

| Branch | Purpose | Merges into |
|---|---|---|
| `main` | Released code only. Tagged `vX.Y.Z` at each release. | n/a |
| `release` | The single long-lived branch that collects the features for the next version and carries the version bump and changelog. | `main` |
| `feature/<name>` (also `fix/`, `docs/`) | One feature or fix. | `release` |

There is always exactly one `release` branch. Versions only move forward in a line, so the
version number lives in the files and the tag (`v0.2.0`), not in a branch name. Create
`release` from `main` once; after each release it is realigned with `main` (see below).

## Adding a feature to a release

1. Branch from `release`: `git checkout release && git checkout -b feature/<name>`.
2. Build it following [`FEATURES.md`](../FEATURES.md) ("Adding a feature") and
   [`architecture.md`](architecture.md). Docs for the feature go in the same branch
   (`docs/features/<name>.md`).
3. Before pushing, from `tools/`: `npm run typecheck`, `npm test`, `npm run validate`.
4. Open a PR with `release` as its **base** (not `main`). Describe what changed,
   anything reviewers should look at, and how it was checked, including whether it was
   run in a real session.
5. Merge into `release` once it is reviewed and checks pass. Feature PRs do
   **not** touch the version number or `CHANGELOG.md`: those belong to `release` at cut time,
   which keeps parallel feature PRs from conflicting on them.

A feature that is not ready when the release is cut stays unmerged (or is reverted from
`release` before the release PR) and goes in the next release.

## Cutting the release

All of this happens on `release` itself, in one or more commits, after the last
feature PR is merged:

1. **Version.** Set the new version in all three places; `npm run check:version` (in
   `tools/`) fails if they disagree:
   - `.claude-plugin/plugin.json` (`version`)
   - `hooks/core/version.ts` (`VERSION`)
   - the pane footer in `docs/usage.md` ("rich-ui 0.2.0")
2. **Changelog.** Add a `## X.Y.Z - YYYY-MM-DD` section to `CHANGELOG.md` (create the file
   with the first release that uses this process) listing user-visible changes under
   *Added*, *Changed*, *Fixed* and *Removed*, one line each, each linking its PR.
   Developer-only changes (tests, docs, tooling) go under one *Internal* line at most.
   Write it from the merged PR list: `gh pr list --base release --state merged`.
3. **Docs.** `README.md` feature table, `docs/FEATURES.md` (move shipped features out of
   Backlog; tag the version), `docs/usage.md`, and `THIRD_PARTY_NOTICES.md` if a vendored
   library changed. Re-run `npm run build:vendor` if one did.
4. **Verify.** `npm run typecheck`, `npm test`, `npm run validate`, `npm run check:version`
   from `tools/`, then a manual run in a real terminal with `claude --plugin-dir .`
   (each feature's checklist; for mermaid, [`mermaid-manual-test.md`](mermaid-manual-test.md)).
   Record anything unexpected in [`verification-notes.md`](verification-notes.md).
5. **Release PR.** Open a PR from `release` into `main`, titled
   `Release X.Y.Z`, with the changelog section as the body. This is the only PR into
   `main`.

## After the release PR merges

1. Merge with a merge commit (not squash), so the feature history survives on `main`.
2. Tag `main`: `git tag vX.Y.Z && git push origin vX.Y.Z`, and create a GitHub release
   from the tag using the changelog section as the notes.
3. Check the real install on a throwaway profile:
   `CLAUDE_CONFIG_DIR=$(mktemp -d) claude plugin install rich-ui --marketplace emergentai/claude-code-rich-ui --yes`.
4. Realign `release` with `main`: `git checkout release && git merge main` (the merge
   commit is the only thing `release` lacks), then push. Delete the merged feature
   branches.
5. The next feature PRs go into `release` as before. Its version stays at the released
   number until the next cut.

## Fixing a bug in production

Normally a fix is just another feature PR into `release`, shipped in the next version. For
an urgent fix that cannot wait for what is queued on `release`, branch `fix/<name>` from
`main`, open a PR into `main` titled `Release X.Y.Z` with the patch version bump and
changelog entry in it, tag it, then merge `main` into `release` so the fix is not lost.

## Rules

- No direct pushes to `main`, and no feature PR into `main` (only `release`, or an urgent
  fix as described above). Turn on branch protection for
  `main` requiring a pull request, so the rule is enforced and not just written down.
- The mods API is early access: re-run validate, type-check and tests after every Claude
  Code upgrade, and record the tested Claude Code version in the README on each release.
- Versions are `MAJOR.MINOR.PATCH`: a new feature bumps the minor, a fix the patch. While
  the version starts with `0`, a breaking change to saved settings also bumps the minor.
