"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Zap
} from "lucide-react";
import { useMemo, useState } from "react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { CardPanel } from "@/components/domain/card-panel";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { KpiTile } from "@/components/domain/kpi-tile";
import { NumericValue } from "@/components/domain/numeric-value";
import { Sparkline } from "@/components/domain/sparkline";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Segmented } from "@/components/ui/segmented";
import { TrendArrow } from "@/components/ui/trend-arrow";
import { TaskDetailDrawer } from "@/views/blocks/task-detail-drawer";
import { MOCK_PROJECT_CRM } from "@/views/catalog";
import { RoutePageIntro } from "@/views/layout/route-page-intro";

type FocusPeriod = "week" | "month";

type DashboardRow = {
  id: string;
  title: string;
  project: string;
  due: string;
  status: { label: string; tone?: "info" | "success" | "warning" | "danger" | "violet" };
  assignee: { initials: string; color: "c1" | "c2" | "c3" | "c4" | "c5" };
};

const ROWS: DashboardRow[] = [
  {
    id: "MDS-39",
    title: "Согласовать ТЗ",
    project: MOCK_PROJECT_CRM,
    due: "23.05",
    status: { label: "В работе", tone: "info" },
    assignee: { initials: "ИИ", color: "c1" }
  },
  {
    id: "MDS-40",
    title: "Подготовить смету этапа 2",
    project: "Ромашка",
    due: "24.05",
    status: { label: "Новая" },
    assignee: { initials: "АП", color: "c2" }
  }
];

const FOCUS_LINE =
  "M0,140 C60,80 120,160 180,90 C240,30 300,130 360,80 C420,40 480,140 540,90 L600,110";
const FOCUS_AREA = `${FOCUS_LINE} L600,200 L0,200 Z`;

export type DashboardBentoProps = {
  empty?: boolean;
};

export function DashboardBento({ empty = false }: DashboardBentoProps = {}) {
  const [period, setPeriod] = useState<FocusPeriod>("month");
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  const rows = empty ? [] : ROWS;
  const openRow = useMemo(() => rows.find((r) => r.id === openRowId) ?? null, [rows, openRowId]);

  return (
    <>
      <RoutePageIntro actions={<BemAvatar initials="КБ" color="c4" size="xl" />} />

      <div className="bento">
        <div className="bento__cell tile tile--gradient-warm">
          <KpiTile
            label="Приоритетные задачи"
            value={<NumericValue value={83} suffix="%" />}
            meta={
              <span className="tile__sub">
                <Clock className="size-3.5" aria-hidden /> Среднее завершение
              </span>
            }
          />
        </div>
        <div className="bento__cell tile tile--gradient-cool">
          <KpiTile
            label="Доп. задачи"
            value={<NumericValue value={56} suffix="%" />}
            meta={
              <span className="tile__sub">
                <CheckCircle2 className="size-3.5" aria-hidden /> Среднее завершение
              </span>
            }
          />
        </div>
        <div className="bento__cell tile">
          <KpiTile
            label="Сделки в работе"
            value={<NumericValue value={8} />}
            meta={
              <span className="tile__foot">
                <TrendArrow direction="up" label="+2 за неделю" />
                <span className="u-text-xs u-text-muted">к прошлой</span>
              </span>
            }
          />
        </div>
        <div className="bento__cell tile">
          <KpiTile
            label="Просрочено"
            value={<NumericValue value={2} />}
            meta={
              <span className="tile__foot">
                <TrendArrow direction="down" label="+1" />
                <span className="u-text-xs u-text-muted">требует внимания</span>
              </span>
            }
          />
        </div>

        <div className="bento__cell bento__cell--8">
          <CardPanel
            title="Фокус команды"
            subtitle={`Аналитика продуктивности · ${period === "month" ? "сентябрь 2026" : "неделя 36"}`}
            actions={
              <Segmented
                name="dashboard-focus-period"
                value={period}
                onChange={setPeriod}
                options={[
                  { value: "week", label: "Неделя" },
                  { value: "month", label: "Месяц" }
                ]}
              />
            }
          >
            <Sparkline linePath={FOCUS_LINE} areaPath={FOCUS_AREA} gradientId="dashboard-focus" />
            <div className="u-between u-mt-3">
              <span className="u-text-xs u-text-muted">
                Средняя концентрация: <strong className="u-text-strong">41%</strong>
              </span>
              <div className="legend-row">
                <span className="legend-item">
                  <span className="dot dot--danger" /> Макс. фокус
                </span>
                <span className="legend-item">
                  <span className="dot dot--violet" /> Спад
                </span>
              </div>
            </div>
          </CardPanel>
        </div>

        <div className="bento__cell bento__cell--4">
          <CardPanel
            title="Митинги"
            subtitle="Сегодня — 4"
            actions={
              <IconButton
                label="Календарь"
                disabled
                title="Демо Storybook: календарь митингов подключится к интеграции"
              >
                <Calendar className="size-4" />
              </IconButton>
            }
          >
            <div className="meeting-item">
              <span className="meeting-item__when">
                <strong>Вт, 11 июл</strong>
                08:15
              </span>
              <div>
                <div className="meeting-item__title">Ежедневный синк</div>
                <div className="meeting-item__source">Zoom</div>
              </div>
              <IconButton
                label="Открыть"
                disabled
                title="Демо Storybook: ссылка на митинг откроется в продукте"
              >
                <ExternalLink className="size-4" />
              </IconButton>
            </div>
            <div className="meeting-item">
              <span className="meeting-item__when">
                <strong>Вт, 11 июл</strong>
                09:30
              </span>
              <div>
                <div className="meeting-item__title">Онбординг · Иванов</div>
                <div className="meeting-item__source">Google Meet</div>
              </div>
              <IconButton
                label="Открыть"
                disabled
                title="Демо Storybook: ссылка на митинг откроется в продукте"
              >
                <ExternalLink className="size-4" />
              </IconButton>
            </div>
          </CardPanel>
        </div>

        <div className="bento__cell bento__cell--8">
          <CardPanel
            title="Ближайшие задачи"
            subtitle={empty ? "Нет задач на сегодня" : "12 задач на сегодня"}
            flush
            actions={
              <Button
                variant="ghost"
                size="sm"
                disabled
                title="Демо Storybook: страница «Моя работа» — открыть из боковой навигации"
              >
                Вся работа
                <ArrowUpRight className="size-4" aria-hidden />
              </Button>
            }
          >
            {empty ? (
              <EmptyState
                title="Задач на сегодня нет"
                description="Свободное время — отличный момент пересобрать бэклог."
              />
            ) : (
              <DataTable>
                <thead>
                  <tr>
                    <th>Задача</th>
                    <th>Проект</th>
                    <th>Срок</th>
                    <th>Статус</th>
                    <th>Кто</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`Открыть карточку задачи ${row.id}`}
                      onClick={() => setOpenRowId(row.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setOpenRowId(row.id);
                        }
                      }}
                      className="row-clickable"
                    >
                      <td>
                        <CellStack title={row.title} subtitle={row.id} />
                      </td>
                      <td>{row.project}</td>
                      <td className="mono cell-muted">{row.due}</td>
                      <td>
                        {row.status.tone ? (
                          <Chip variant={row.status.tone}>{row.status.label}</Chip>
                        ) : (
                          <Chip>{row.status.label}</Chip>
                        )}
                      </td>
                      <td>
                        <BemAvatar initials={row.assignee.initials} color={row.assignee.color} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </CardPanel>
        </div>

        <div className="bento__cell bento__cell--4">
          <CardPanel title="Сигналы контроля" subtitle={empty ? "Сигналов нет" : "3 активных"}>
            {empty ? (
              <EmptyState title="Сигналов нет" description="Контур KPI спокоен." />
            ) : (
              <>
                <div className="u-flex u-items-center u-gap-3 u-mb-3">
                  <span className="tile__icon tile__icon--warning">
                    <AlertTriangle className="size-4" aria-hidden />
                  </span>
                  <div>
                    <div className="u-text-body u-text-strong">Риск срока — DataHub</div>
                    <div className="u-text-xs u-text-muted">−4 дня к базовому плану</div>
                  </div>
                </div>
                <div className="u-flex u-items-center u-gap-3 u-mb-3">
                  <span className="tile__icon tile__icon--danger">
                    <Zap className="size-4" aria-hidden />
                  </span>
                  <div>
                    <div className="u-text-body u-text-strong">Перегруз — Петров А.</div>
                    <div className="u-text-xs u-text-muted">112% на неделе 21</div>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  className="u-w-full u-mt-3"
                  disabled
                  title="Демо Storybook: управленческая поверхность откроется из карточки сигнала"
                >
                  Открыть управленческую поверхность
                  <ArrowUpRight className="size-4" aria-hidden />
                </Button>
              </>
            )}
          </CardPanel>
        </div>
      </div>

      <TaskDetailDrawer
        open={openRow != null}
        onOpenChange={(o) => !o && setOpenRowId(null)}
        task={
          openRow
            ? {
                id: openRow.id,
                title: openRow.title,
                project: openRow.project,
                stage:
                  openRow.status.tone === "danger"
                    ? { label: openRow.status.label, tone: "warning" }
                    : openRow.status.tone
                      ? { label: openRow.status.label, tone: openRow.status.tone }
                      : { label: openRow.status.label, tone: "info" }
              }
            : null
        }
      />
    </>
  );
}
