# P9-008 startup claim cleanup

- Task: `P9-008-template-improvement-governed-action`
- Time: 2026-05-17T01:22:08.4899996+07:00
- Reason: Startup guard failed on stale completed runtime claim `P8-002-control-surface-data-source-read-dtos`.
- Action: normalized runtime claim files to `status: "done"` where the corresponding queue task is already `done`.
- Scope: `.agent-bus/claims/*.claim.json` only; no product files were edited before guard.
- Next: rerun `node scripts/agent-bus-guard.mjs --task P9-008-template-improvement-governed-action --once`.
