# Full Product Evaluation Loop — KISS PM

Прогон Loop #010 «Full Product Evaluation Loop» (signals.forwardfuture.com/loop-library), 2026-07-04.

## Актуальный checkpoint — 2026-07-11

- Schedule closeout: projects-schedule-closeout-2026-07-10.md.
- Shell/list/detail/Overview closeout: projects-shell-overview-closeout-2026-07-11.md.
- Machine-readable project matrix: projects-coverage-matrix-2026-07-10.json.
- Schedule: 40/40 свежих role × scenario строк пройдено, 11/11 browser bundles.
- Shell/list/detail/Overview: 68/68 свежих role × scenario строк пройдено, 7/7 browser bundles.
- Глобальная project-матрица: 169 pass, 54 non-pass. Эти строки не считаются закрытыми без собственного свежего evidence.

## Артефакты

- `env-diff.md` — окружение, учётки, отличия от прода.
- `inventory/` — полный инвентарь пользовательских поверхностей (329 позиций):
  - `auth.md` — 47 (AUTH-001…047)
  - `shell-dashboard.md` — 56 (SHELL/DASH/MYWORK/SET/PROF/AGENT)
  - `projects.md` — 122 (PROJ-001…122)
  - `crm.md` — 32 (CRM-001…032)
  - `communications.md` — 46 (COMM-001…046)
  - `admin.md` — 26 (ADM-001…026)
- `bugs.md` — сводный лог багов (смоук + слияние по областям).
- `bugs/` — детальные логи багов по областям, пишутся во время фазы 3.

## Правила статусов инвентаря

- ⬜ не проверено · ✅ пройдено · ❌ провалено (ссылка на BUG-id) · 🚧 заблокировано (причина, НЕ засчитывается как пройденное).

## Критерий выхода

Каждая инвентаризованная поверхность удовлетворяет документированным критериям приёмки; финальный полный регресс покрывает весь инвентарь и edge-кейсы. Остановка — только «чистый полный проход» или явный blocked-handoff.
