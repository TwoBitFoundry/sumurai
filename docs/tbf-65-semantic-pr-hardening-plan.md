# TBF-65 Semantic PR Workflow Hardening Plan

## Context

Ticket TBF-65 tracks TM-008 from `docs/sumurai-threat-model.md`: `.github/workflows/semantic-pr.yml` uses `pull_request_target`, which runs workflow code from the base branch context for pull requests, including forked pull requests. The current workflow validates pull request titles with `amannn/action-semantic-pull-request@v5`, grants `pull-requests: write`, and grants `contents: read`.

The workflow is title-only and does not need to check out repository contents, run contributor-controlled scripts, access secrets beyond `GITHUB_TOKEN`, or mutate pull requests. The safest design is therefore to preserve fork pull request support while removing write permissions and making the third-party action immutable.

## Best-Practice Basis

- GitHub recommends granting `GITHUB_TOKEN` only the minimum required permissions and setting tighter permissions at the workflow or job level.
- GitHub recommends pinning third-party actions to a full-length commit SHA because a full SHA is the immutable reference form for an action dependency.
- GitHub recommends auditing third-party actions because a compromised action can access the workflow token and secrets available to the job.
- The semantic pull request action documents `pull-requests: read` for normal title validation and reserves `pull-requests: write` for the optional WIP behavior.
- The semantic pull request action documents `pull_request_target` as the fork-compatible trigger and `pull_request` as suitable when all contributors have write access to the repository.

Sources:

- [GitHub Actions secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub GITHUB_TOKEN authentication and permissions](https://docs.github.com/en/actions/configuring-and-managing-workflows/authenticating-with-the-github_token)
- [semantic-pull-request Marketplace documentation](https://github.com/marketplace/actions/semantic-pull-request)

## Decision

Use `pull_request_target` for this workflow, but constrain it so it cannot execute PR head code or write to repository or pull request resources.

This fits the repository because Sumurai appears to support external contribution flows, and `semantic-pr.yml` only needs pull request metadata. Switching to `pull_request` would reduce base-context risk, but the action documentation notes that forked pull requests can fail because the token environment parameter is unavailable. A constrained `pull_request_target` keeps the check useful for forks while removing the dangerous combination identified in TM-008.

## Implementation Steps

1. Update `.github/workflows/semantic-pr.yml`.

   - Keep the `pull_request_target` trigger.
   - Keep the existing event types: `opened`, `edited`, `synchronize`, `reopened`, `ready_for_review`.
   - Set permissions to only:

     ```yaml
     permissions:
       pull-requests: read
     ```

   - Remove `contents: read` because no checkout or repository content read is needed.
   - Remove `pull-requests: write` because the workflow does not enable `wip: true`, does not comment, and does not update PR state.
   - Keep the job-level draft guard.
   - Keep the workflow free of `actions/checkout`, `run`, local actions, composite actions from this repository, or any step that evaluates PR-controlled files.

2. Pin `amannn/action-semantic-pull-request` to a full commit SHA.

   - Resolve the desired upstream version to a full 40-character SHA before editing:

     ```bash
     git ls-remote https://github.com/amannn/action-semantic-pull-request.git refs/tags/v5.5.3
     ```

   - Prefer the latest compatible v5 patch release for minimal behavior change unless the implementation intentionally validates v6 compatibility.
   - Replace `amannn/action-semantic-pull-request@v5` with `amannn/action-semantic-pull-request@<full-sha>`.
   - Record the human-readable upstream version in the PR body, not as a workflow comment.

3. Add a CI workflow safety check for this repository.

   - Validate the workflow file directly by inspection and keep the final workflow free of checkout, shell execution, and write permissions.
   - Keep the action reference pinned to a full commit SHA.

4. Audit adjacent workflow exposure.

   - Confirm `.github/workflows/ci.yml` continues to use `pull_request` with `contents: read`.
   - Confirm `.github/workflows/release.yml` only runs on `push` to `main` and `workflow_dispatch`, not pull request events.
   - Do not broaden this ticket into pinning every workflow action unless the PR scope is explicitly expanded.

## Target Workflow Shape

```yaml
name: conventional-commits

on:
  pull_request_target:
    types: [opened, edited, synchronize, reopened, ready_for_review]

permissions:
  pull-requests: read

jobs:
  validate:
    name: Validate PR title
    runs-on: ubuntu-latest
    if: github.event.pull_request.draft == false
    steps:
      - uses: amannn/action-semantic-pull-request@<full-sha>
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          types: |
            build
            chore
            ci
            docs
            feat
            fix
            perf
            refactor
            revert
            style
            test
          ignoreLabels: |
            bot
            dependencies
          validateSingleCommit: true
```

## Validation Plan

Run local checks:

```bash
sed -n '1,120p' .github/workflows/semantic-pr.yml
```

Verify in GitHub after opening the PR:

- A same-repository pull request with a valid title passes.
- A same-repository pull request with an invalid title fails.
- A fork pull request with a valid title runs without checkout and passes.
- A fork pull request with an invalid title fails without exposing write permissions.
- The workflow run log shows no checkout, no shell command execution, and no write-permission step.

## Acceptance Mapping

- Replace or restructure `pull_request_target`: retained only for fork compatibility, with no checkout, no PR head code execution, no shell execution, and read-only PR metadata access.
- Gate write-permission steps for same-repository PRs: no write-permission steps remain, so the gate is unnecessary.
- Pin action to full commit SHA: implementation replaces the `@v5` tag with a 40-character SHA.
- Scope permissions to minimum required: workflow permissions reduce to `pull-requests: read` only.

## Residual Risk

The workflow still depends on a third-party action. Pinning prevents tag movement but does not remove risk from the pinned code itself. The implementation PR should include a short note that the pinned upstream revision was reviewed for the expected behavior: reading PR metadata, validating title text, and reporting status without repository checkout or arbitrary command execution from PR content.

## Validation Log

- Reviewed `.github/workflows/semantic-pr.yml` after the edit to confirm `pull_request_target` remains the trigger, permissions are reduced to `pull-requests: read`, and the action reference is pinned to a full SHA.
- Skipped a framework-level workflow test by request; validation was limited to direct file inspection.
