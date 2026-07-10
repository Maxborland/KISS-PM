# Schedule evidence freshness and closeout gate

Audit cutoff: `2026-07-10T09:30:18Z`

## Findings

**Verdict: BLOCKED.** Current matrix shape is internally consistent (`223` rows, `130` source scenarios), but all three Schedule rows marked `historical_evidence_only` still lack fresh end-to-end proof against the current source snapshot. None may be promoted now.

| Row | Historical claim | What can be reproduced safely now | Freshness decision |
|---|---|---|---|
| `PROJ-035` A | Indent/outdent, correct disabled states | Domain reducer tests cover `task.move_wbs`, but there is no current UI/focused test or browser run that clicks both controls and verifies apply/readback/reload. | **Remain `historical_evidence_only`.** No full fresh reproduction. |
| `PROJ-036` A | Batch mode, `Пакет · N`, two edits -> one commit, reset | Fresh Schedule tests cover staged apply/discard lifecycle and fresh API/domain tests cover atomic batch mechanics. They do not prove the literal toolbar mode, count `2`, one browser request/version increment, persisted two-edit readback, and zero-write reset. | **Remain `historical_evidence_only`.** Partial unit evidence only. |
| `PROJ-037` A | Undo by compensating batch restores data | Fresh unit/domain tests cover undo guards and reverse compensation. No fresh browser artifact proves click -> preview/apply batch -> restored API readback -> reload, or the stale-version zero-write path on current UI. | **Remain `historical_evidence_only`.** Partial unit evidence only. |

Current matrix counts, read directly from `docs/qa/full-eval/projects-coverage-matrix-2026-07-10.json`:

| Status | Count |
|---|---:|
| blocked | 4 |
| fail | 46 |
| historical_evidence_only | 59 |
| partial | 3 |
| pass | 80 |
| unverified | 31 |
| **total** | **223** |

There are `49` expanded Schedule rows. Exactly three are historical: `PROJ-035`, `PROJ-036`, `PROJ-037`.

## Fresh command evidence from this audit

These are new command results captured during this audit, not promotions of older artifacts:

1. Matrix integrity: `223/223` expanded rows, `130/130` unique scenarios, `59` historical rows, `3` Schedule historical rows.
2. Focused Schedule/domain/client command:

   ```powershell
   .\node_modules\.bin\vitest.cmd run packages/domain/src packages/planning-client/src apps/web/src/delivery/schedule --config vitest.config.ts
   ```

   Latest execution result: **36 files passed, 206 tests passed**. This includes nine Schedule navigation-guard tests, nine Schedule productivity tests, permission/UI tests, reducer tests, and compensation tests. The passing navigation tests emitted non-fatal `ECONNRESET` / `ECONNREFUSED localhost:3000` stderr. More importantly, `schedule-saved-views.tsx` changed again at `09:30:18Z`, after this run started at `09:29:21Z`; therefore the green result is **superseded/stale for the cutoff snapshot**, not fresh closeout evidence. It also does not include a literal `PROJ-035` browser action or complete `PROJ-036/037` browser oracles.

3. Race/unit command from the 22-row race inventory:

   ```powershell
   .\node_modules\.bin\vitest.cmd run apps/api/src/projectIntakeService.test.ts apps/api/src/projectIntakeParsers.test.ts apps/api/src/projectWorkParsers.test.ts apps/api/src/retrospectiveRoutes.test.ts apps/api/src/planningParsers.test.ts apps/api/src/planning/planningCommandCore.test.ts apps/api/src/planningAutoSolverRoutes.test.ts
   ```

   Result: **7 files passed, 64 tests passed**. The Markdown race inventory still has exactly `22` numbered rows (`1..22`). Its planning DB claims remain historical/static until rerun against an explicitly disposable database.

4. Full repository typecheck:

   ```powershell
   pnpm typecheck
   ```

   An initial run passed, then an intermediate rerun correctly caught four diagnostics while a concurrent Schedule source edit was incomplete. The latest execution passed with exit `0`; landing covered `102` files with `0 errors`, `0 warnings`, `0 hints`. However, `schedule-saved-views.tsx` changed at `09:30:18Z` after that typecheck started at `09:29:32Z`. The pass is therefore **superseded/stale for the cutoff snapshot**. Current typecheck status is **missing fresh rerun**, not pass or fail.

The first sandboxed Vitest attempt failed before test collection with `spawn EPERM`; both listed Vitest commands were rerun outside the process sandbox and passed. This is an environment failure, not a test result.

## Stale and insufficient existing artifacts

No artifact listed below is called fresh. A same-day filename is not enough: accepted evidence must be produced after the current source snapshot by a command that reaches the claimed action, and it must be source-bound or captured in the same unchanged-source gate.

### Historical source records

- `docs/qa/full-eval/inventory/projects.md`: dated `2026-07-04`; it is the explicit historical source for `PROJ-035/036/037` and requires rerun.
- `docs/qa/full-eval/evidence/reconciliation-2026-07-07/bug-proj-09-schedule-actions-2026-07-07.json`: dated `2026-07-07`, source/test-only, and about Baseline/fake controls rather than `PROJ-035/036/037`.
- `docs/qa/full-eval/bugs/projects.md`: diagnostic bug inventory, not passing evidence.

### Schedule write/action browser records

- `.superloopy/evidence/projects-2026-07-10/projects-schedule-write-admin-playwright.json`
- `.superloopy/evidence/projects-2026-07-10/projects-schedule-write-playwright.json`
- `.superloopy/evidence/projects-2026-07-10/projects-schedule-write.json`

These runs are stale: they started on `2026-07-09T22:53Z` / `23:12Z`, the spec was later modified (`2026-07-10T00:07Z`), and `schedule-surface.tsx` was later modified (`05:14Z`). They cover create/delete and PLAN denial, not indent/outdent, literal batch mode/reset, or reversible undo. Both Playwright JSON files contain **zero screenshots**.

### Schedule productivity records

- `.superloopy/evidence/projects-2026-07-10/schedule-productivity-playwright.json`
- `.superloopy/evidence/projects-2026-07-10/schedule-productivity-fix.json`
- `.superloopy/evidence/projects-2026-07-10/qa-schedule-productivity-independent.md`
- `.superloopy/evidence/projects-2026-07-10/qa-schedule-productivity-final.md`
- `.superloopy/evidence/projects-2026-07-10/qa-schedule-productivity-qa-gate.md`
- `.superloopy/evidence/projects-2026-07-10/qa-schedule-productivity-recheck.md`
- `.superloopy/evidence/projects-2026-07-10/qa-schedule-productivity-recheck-final-a.md`

The Playwright run started `2026-07-10T04:09:47Z` and contains `4 expected / 0 unexpected / 0 flaky / 0 skipped`, with embedded PNG attachments `schedule-productivity-390.png`, `schedule-productivity-768.png`, and `schedule-productivity-1280.png`. It is stale for current source because `schedule-surface.tsx` changed at `05:14Z`. The JSON is not commit/hash-bound. It covers `PROJ-046/123/124/125/126`, not the exact `PROJ-035/036` contracts; its undo flow is relevant to `PROJ-037` but cannot be reused as fresh proof.

### Route, permission, identity, and screenshots

- `.superloopy/evidence/projects-2026-07-10/worker-09-schedule-permission.md`
- `.superloopy/evidence/projects-2026-07-10/projects-permissions-integrated-playwright.json`
- `.superloopy/evidence/projects-2026-07-10/projects-role-routes.json`
- `.superloopy/evidence/projects-2026-07-10/projects-role-routes-playwright.json`
- `.superloopy/evidence/auth-shell-2026-07-10/auth-route-guards/screenshots/anon-projects-project-vektor-portal-schedule.png`
- `.superloopy/evidence/projects-2026-07-10/navigation/screenshots/schedule.png`
- `.superloopy/evidence/projects-2026-07-10/project-detail-identity/screenshots/admin-header-schedule.png`
- `.superloopy/evidence/projects-2026-07-10/role-routes/screenshots/admin-projects-project-vektor-portal-schedule.png`
- `.superloopy/evidence/projects-2026-07-10/role-routes/screenshots/beta-projects-project-vektor-portal-schedule.png`
- `.superloopy/evidence/projects-2026-07-10/role-routes/screenshots/engineer-projects-project-vektor-portal-schedule.png`
- `.superloopy/evidence/projects-2026-07-10/role-routes/screenshots/planReader-projects-project-vektor-portal-schedule.png`
- `.superloopy/evidence/projects-2026-07-10/role-routes/screenshots/resourceReader-projects-project-vektor-portal-schedule.png`

These artifacts are stale or insufficient for the target rows. They establish route/identity/barrier/permission states only; no screenshot shows the required action transition with command/readback evidence. The latest identity screenshot (`08:42Z`) still predates current HEAD `ff334fc` (`08:44Z`) and carries no source digest. Duplicate SHA-256 between the admin role-route and identity screenshot further confirms reuse of the same visual state, not a new action run.

### Legacy suite and race inventory

- `.superloopy/evidence/projects-2026-07-10/projects-legacy-contract-reconciliation.json`
- `.superloopy/evidence/projects-2026-07-10/projects-old-planning-suite.json`
- `.superloopy/evidence/projects-2026-07-10/projects-old-planning-suite-batch2.json`
- `.superloopy/evidence/projects-2026-07-10/lane-05-e2e-coverage.md`
- `.superloopy/evidence/projects-2026-07-10/lane-03-race-idempotency.md`
- `.superloopy/evidence/schedule-closeout-2026-07-10/lane-matrix.md`
- `.superloopy/evidence/schedule-closeout-2026-07-10/lane-api-data.md`
- `.superloopy/evidence/schedule-closeout-2026-07-10/lane-code-review.md`
- `.superloopy/evidence/schedule-closeout-2026-07-10/lane-write-races.md`

The legacy full run was `0 passed / 17 failed / 1 skipped`; batch 2 was `0 passed / 12 failed`. The E2E inventory explicitly says Schedule action tests were blocked before target actions or used obsolete fixtures/selectors. The race report is a valuable 22-row inventory, but its planning single/batch/revert rows are marked `STATIC`; DB suites were intentionally not rerun. It must not be treated as a fresh race execution.

The concurrent closeout reports are supporting analysis, not replacements for the missing target artifacts:

- `lane-matrix.md` independently recommends `0/40` promotions and keeps all three historical rows blocked.
- `lane-code-review.md` finds active product blockers directly relevant to `PROJ-036/037`: staged packages are lost on preview cancel, many write paths bypass visible batch mode, dirty batch mode can be toggled off and interleaved, and cancelling undo preview consumes the undo.
- `lane-api-data.md` reports five API/data findings and executes only non-DB focused checks (`7 files / 15 tests` plus `1 passed / 56 skipped`); it explicitly does not execute destructive planning DB suites.
- `lane-write-races.md` reports undefined-outcome apply, staged-package loss, non-atomic/non-idempotent server `revert-last`, and other race gaps. It states that three complete DB files passed, but records no disposable DB URL/name, raw reporter artifact, exact test counts, or source hash. Under this audit's strict freshness rule that prose claim is insufficient for the machine gate and is not labeled fresh here.

## Missing artifacts and blockers

The following are absent and required before any promotion:

1. `e2e/full-eval/projects-schedule-closeout.spec.ts`: a dedicated three-test acceptance spec for `PROJ-035`, `PROJ-036`, `PROJ-037` does not exist.
2. A fail-closed disposable browser runner/config. `playwright.config.ts` falls back to shared `127.0.0.1:55432/kiss_pm`, starts mutating Schedule specs, and may reuse existing servers. Direct root Playwright execution is therefore not an admissible non-destructive closeout command.
3. `.superloopy/evidence/schedule-closeout-2026-07-10/schedule-closeout-playwright.json` with exactly three current-source tests and zero skipped/flaky/unexpected results.
4. Seven current-source action screenshots: `proj-035-indent.png`, `proj-035-outdent.png`, `proj-036-batch-staged.png`, `proj-036-batch-applied.png`, `proj-036-batch-reset.png`, `proj-037-before-undo.png`, `proj-037-after-undo.png`.
5. Source-bound raw disposable-DB results for planning batch atomicity, concurrent duplicate batch idempotency, and concurrent `task.update_schedule` idempotency. The prose-only DB claim in `lane-write-races.md` does not satisfy this requirement.
6. A machine receipt binding the browser run to unchanged hashes of current Schedule source/spec files.
7. Focused tests and full typecheck rerun after Schedule source stops changing; the latest green commands predate the cutoff source mtime.

The concurrently created `.superloopy/evidence/schedule-closeout-2026-07-10/.lane-browser-run.mjs` is an unpublished read-only route harness, not an acceptance spec. It has produced one changing route screenshot, `.superloopy/evidence/schedule-closeout-2026-07-10/admin-schedule-initial.png`, but no completed JSON receipt and no target mutation. The PNG is **insufficient**, not fresh action evidence, and closes none of the gaps above.

## One deterministic final closeout gate

Run the following as **one PowerShell command** only after the missing dedicated browser spec exists and `SCHEDULE_CLOSEOUT_DATABASE_URL` points to a provisioned disposable database whose name begins `kiss_pm_schedule_closeout_`. The command fails closed on a shared/default DB, disables server reuse with `CI=1`, hashes source before and after the browser run, executes all required checks, and validates exact counts.

```powershell
& {
  $ErrorActionPreference = 'Stop'
  $root = (Get-Location).Path
  $evidence = Join-Path $root '.superloopy/evidence/schedule-closeout-2026-07-10'
  $matrixPath = Join-Path $root 'docs/qa/full-eval/projects-coverage-matrix-2026-07-10.json'
  $racePath = Join-Path $root '.superloopy/evidence/projects-2026-07-10/lane-03-race-idempotency.md'
  $browserSpec = Join-Path $root 'e2e/full-eval/projects-schedule-closeout.spec.ts'
  $browserJson = Join-Path $evidence 'schedule-closeout-playwright.json'
  New-Item -ItemType Directory -Force $evidence | Out-Null

  if (!(Test-Path $browserSpec)) { throw "missing browser spec: $browserSpec" }
  if (!$env:SCHEDULE_CLOSEOUT_DATABASE_URL) { throw 'SCHEDULE_CLOSEOUT_DATABASE_URL is required' }
  $db = [Uri]$env:SCHEDULE_CLOSEOUT_DATABASE_URL
  $dbName = $db.AbsolutePath.TrimStart('/')
  if ($dbName -notmatch '^kiss_pm_schedule_closeout_[a-z0-9_]+$') { throw "unsafe database: $dbName" }
  if ($env:SCHEDULE_CLOSEOUT_DATABASE_URL -match '127\.0\.0\.1:55432/kiss_pm(?:$|\?)') { throw 'shared dev DB is forbidden' }

  function Invoke-Checked([string]$name, [scriptblock]$command, [string[]]$patterns) {
    $log = Join-Path $evidence "$name.log"
    $out = & $command 2>&1 | Tee-Object -FilePath $log
    if ($LASTEXITCODE -ne 0) { throw "$name failed with exit $LASTEXITCODE" }
    $text = $out -join "`n"
    foreach ($pattern in $patterns) {
      if ($text -notmatch $pattern) { throw "$name missing expected output: $pattern" }
    }
  }

  function Source-State {
    $files = @(
      Get-ChildItem 'apps/web/src/delivery/schedule' -File -Include '*.ts','*.tsx'
      Get-Item 'e2e/full-eval/projects-schedule-closeout.spec.ts'
      Get-Item 'apps/web/src/delivery/lib/use-planning.ts'
      Get-Item 'apps/api/src/planningRoutes.db.test.ts'
    ) | Sort-Object FullName -Unique
    return ($files | ForEach-Object { "$($_.FullName)=$((Get-FileHash $_.FullName -Algorithm SHA256).Hash)" }) -join "`n"
  }

  $matrix = Get-Content -Raw $matrixPath | ConvertFrom-Json
  if ($matrix.rows.Count -ne 223 -or $matrix.expandedMatrixRowCount -ne 223) { throw 'matrix row count must be 223' }
  if (($matrix.rows.scenarioId | Sort-Object -Unique).Count -ne 130 -or $matrix.sourceScenarioCount -ne 130) { throw 'scenario count must be 130' }
  $targets = @($matrix.rows | Where-Object { $_.scenarioId -in @('PROJ-035','PROJ-036','PROJ-037') })
  if ($targets.Count -ne 3 -or @($targets | Where-Object status -ne 'pass').Count -ne 0) { throw 'three Schedule historical rows must be pass' }
  if (@($matrix.rows | Where-Object status -eq 'historical_evidence_only').Count -ne 56) { throw 'final historical count must be 56' }
  if (@($matrix.rows | Where-Object status -eq 'pass').Count -ne 83) { throw 'final pass count must be 83' }

  $raceRows = @(Select-String -Path $racePath -Pattern '^\|\s*(\d+)\s*\|')
  if ($raceRows.Count -ne 22 -or (($raceRows.Matches.Groups | Where-Object Name -eq 1).Value -join ',') -ne ((1..22) -join ',')) { throw 'race matrix must contain rows 1..22 exactly once' }
  $raceText = Get-Content -Raw $racePath
  if ($raceText -notmatch '(?m)^\|\s*19\s*\|.*\*\*PASS' -or $raceText -notmatch '(?m)^\|\s*20\s*\|.*\*\*PASS') { throw 'planning race rows 19/20 must retain explicit PASS inventory verdicts' }
  if ($raceText -notmatch '(?m)^\|\s*22\s*\|.*\*\*FAIL/STATIC') { throw 'known revert-last residual must remain explicit; Schedule UI undo uses apply-command-batch instead' }

  Invoke-Checked 'focused-tests' {
    & .\node_modules\.bin\vitest.cmd run packages/domain/src packages/planning-client/src apps/web/src/delivery/schedule --config vitest.config.ts
  } @('Test Files\s+36 passed\s+\(36\)', 'Tests\s+206 passed\s+\(206\)')

  Invoke-Checked 'race-unit' {
    & .\node_modules\.bin\vitest.cmd run apps/api/src/projectIntakeService.test.ts apps/api/src/projectIntakeParsers.test.ts apps/api/src/projectWorkParsers.test.ts apps/api/src/retrospectiveRoutes.test.ts apps/api/src/planningParsers.test.ts apps/api/src/planning/planningCommandCore.test.ts apps/api/src/planningAutoSolverRoutes.test.ts
  } @('Test Files\s+7 passed\s+\(7\)', 'Tests\s+64 passed\s+\(64\)')

  $env:DATABASE_URL = $env:SCHEDULE_CLOSEOUT_DATABASE_URL
  Invoke-Checked 'race-db' {
    & .\node_modules\.bin\vitest.cmd run --config vitest.db.config.ts apps/api/src/planningRoutes.db.test.ts -t '(applies command batch atomically with idempotency and version conflict|deduplicates concurrent apply-command-batch requests with the same idempotency key|deduplicates concurrent task.update_schedule apply requests with the same idempotency key)'
  } @('Tests\s+3 passed\s+\|\s+21 skipped\s+\(24\)')

  Invoke-Checked 'typecheck' { pnpm typecheck } @('Result \(102 files\):', '0 errors', '0 warnings', '0 hints')

  $before = Source-State
  $runStart = [DateTime]::UtcNow
  $env:CI = '1'
  $env:E2E_API_PORT = '4310'
  $env:E2E_WEB_PORT = '3310'
  $env:PLAYWRIGHT_JSON_OUTPUT_NAME = $browserJson
  & .\node_modules\.bin\playwright.cmd test $browserSpec --config playwright.config.ts --project chromium --workers 1 --reporter json
  if ($LASTEXITCODE -ne 0) { throw "browser failed with exit $LASTEXITCODE" }
  if ((Source-State) -ne $before) { throw 'source changed during browser run' }

  $browser = Get-Content -Raw $browserJson | ConvertFrom-Json
  if ($browser.stats.expected -ne 3 -or $browser.stats.unexpected -ne 0 -or $browser.stats.flaky -ne 0 -or $browser.stats.skipped -ne 0 -or $browser.errors.Count -ne 0) { throw 'browser counts must be 3 expected, 0 unexpected/flaky/skipped/errors' }

  $shots = @(
    'proj-035-indent.png','proj-035-outdent.png',
    'proj-036-batch-staged.png','proj-036-batch-applied.png','proj-036-batch-reset.png',
    'proj-037-before-undo.png','proj-037-after-undo.png'
  )
  $shotFiles = @($shots | ForEach-Object { Get-Item (Join-Path $evidence $_) -ErrorAction Stop })
  if ($shotFiles.Count -ne 7 -or @($shotFiles | Where-Object { $_.Length -le 0 -or $_.LastWriteTimeUtc -lt $runStart }).Count -ne 0) { throw 'seven non-empty current-run screenshots are required' }

  [pscustomobject]@{
    status = 'PASS'
    matrixRows = 223
    sourceScenarios = 130
    promotedScheduleRows = 3
    finalPass = 83
    finalHistorical = 56
    browser = '3/3'
    screenshots = '7/7'
    focusedTests = '206/206 in 36 files'
    raceUnit = '64/64 in 7 files'
    raceDb = '3/3 (21 skipped)'
    typecheck = 'exit 0'
    raceMatrixRows = '22/22'
  } | ConvertTo-Json | Set-Content (Join-Path $evidence 'schedule-closeout-gate.json') -Encoding utf8
  Get-Content -Raw (Join-Path $evidence 'schedule-closeout-gate.json')
}
```

Expected final counts are therefore exact: matrix `223`, scenarios `130`, promoted rows `3`, final `pass=83`, final `historical_evidence_only=56`, browser `3/3`, screenshots `7/7`, focused tests `206/206` in `36` files, race unit `64/64` in `7` files, race DB `3/3` with `21` skipped, typecheck exit `0`, race inventory `22/22`.

The gate intentionally fails in the current worktree because the dedicated browser spec, browser JSON, seven action screenshots, disposable DB receipt, and matrix promotions do not exist, and concurrent Schedule source changed after the latest focused/typecheck runs. That failure is the correct closeout result today.

## Change index

- Product, test, matrix, and historical evidence files changed by this audit: **none**.
- Added report: `.superloopy/evidence/schedule-closeout-2026-07-10/lane-evidence-gate.md`.
- Source symbols added/changed/removed by this audit: **none** (Markdown-only report).
- CodeGraph before report: `2,228 files / 24,825 nodes / 53,167 edges`.
- CodeGraph at the mandatory cutoff sync: `2,229 files / 24,845 nodes / 53,212 edges`.
- CodeGraph delta from audit entry to cutoff: `+1 file / +20 nodes / +45 edges`. The audit report is Markdown and adds no source nodes; the moving delta came from concurrent `schedule-saved-views.tsx` / `schedule-surface.tsx` and browser-harness work and is not attributed to this lane.

SUPERLOOPY_AUDIT: .superloopy/evidence/schedule-closeout-2026-07-10/lane-evidence-gate.md
