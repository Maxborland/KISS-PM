# 35. Phase C.3 — Scenarios + Baseline

## Решения

- **Overload trigger:** первый overload из `readModel.resourceLoad.overloads` (fallback — seed overload для demo).
- **Baselines history:** `GET /api/workspace/projects/:id/planning/baselines`.
- **Risk accept:** `AcceptRiskDialog` с обязательным `acceptedRiskReason` при apply scenario.
- **Baseline capture:** `baseline.capture` через preview/apply bar.
