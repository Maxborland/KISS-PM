import {
  AlertTriangle,
  ArrowUpRight,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  TrendingDown,
  TrendingUp,
  Zap
} from "lucide-react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { Button } from "@/components/ui/button";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { CardPanel } from "@/components/domain/card-panel";
import { Chip } from "@/components/ui/chip";
import { MOCK_PROJECT_CRM } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";
import { IconButton } from "@/components/ui/icon-button";

export function DashboardBento() {
  return (
    <>
      <PageIntro
        title="Добро пожаловать, Камил"
        lead="Ваш персональный дашборд: 12 задач, 8 сделок, 3 митинга на сегодня."
        actions={<BemAvatar initials="КБ" color="c4" size="xl" />}
      />

      <div className="bento">
        <div className="bento__cell tile tile--gradient-warm">
          <div className="tile__head">
            <span className="tile__label">Приоритетные задачи</span>
            <span className="tile__icon">
              <Clock className="size-4" aria-hidden />
            </span>
          </div>
          <div className="tile__value tile__value--xl">83%</div>
          <div className="tile__sub">Среднее завершение</div>
        </div>
        <div className="bento__cell tile tile--gradient-cool">
          <div className="tile__head">
            <span className="tile__label">Доп. задачи</span>
            <span className="tile__icon">
              <CheckCircle2 className="size-4" aria-hidden />
            </span>
          </div>
          <div className="tile__value tile__value--xl">56%</div>
          <div className="tile__sub">Среднее завершение</div>
        </div>
        <div className="bento__cell tile">
          <div className="tile__head">
            <span className="tile__label">Сделки в работе</span>
            <span className="tile__icon tile__icon--accent">
              <Briefcase className="size-4" aria-hidden />
            </span>
          </div>
          <div className="tile__value">8</div>
          <div className="tile__foot">
            <span className="delta delta--up">
              <TrendingUp className="size-4" aria-hidden />
              +2 неделя
            </span>
            <span className="u-text-xs u-text-muted">vs прошлая</span>
          </div>
        </div>
        <div className="bento__cell tile">
          <div className="tile__head">
            <span className="tile__label">Просрочено</span>
            <span className="tile__icon tile__icon--danger">
              <AlertTriangle className="size-4" aria-hidden />
            </span>
          </div>
          <div className="tile__value">2</div>
          <div className="tile__foot">
            <span className="delta delta--down">
              <TrendingDown className="size-4" aria-hidden />
              +1
            </span>
            <span className="u-text-xs u-text-muted">требует внимания</span>
          </div>
        </div>

        <div className="bento__cell bento__cell--8">
          <CardPanel
            title="Фокус команды"
            subtitle="Аналитика продуктивности · сентябрь 2026"
            actions={
              <Button variant="ghost" size="sm">
                Месяц
              </Button>
            }
          >
            <svg viewBox="0 0 600 200" width="100%" height={200} preserveAspectRatio="none" aria-hidden>
              <defs>
                <linearGradient id="g-warm" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#fda4af" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#fda4af" stopOpacity={0} />
                </linearGradient>
              </defs>
              <path
                d="M0,140 C60,80 120,160 180,90 C240,30 300,130 360,80 C420,40 480,140 540,90 L600,110 L600,200 L0,200 Z"
                fill="url(#g-warm)"
              />
              <path
                d="M0,140 C60,80 120,160 180,90 C240,30 300,130 360,80 C420,40 480,140 540,90 L600,110"
                stroke="#ef4444"
                strokeWidth={2}
                fill="none"
              />
            </svg>
            <div className="u-between u-mt-3">
              <span className="u-text-xs u-text-muted">
                Avg концентрация: <strong className="u-text-strong">41%</strong>
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
          <CardPanel title="Митинги" subtitle="Сегодня — 4" actions={<IconButton label="Календарь"><Calendar className="size-4" /></IconButton>}>
            <div className="meeting-item">
              <span className="meeting-item__when">
                <strong>Вт, 11 июл</strong>
                08:15
              </span>
              <div>
                <div className="meeting-item__title">Quick Daily</div>
                <div className="meeting-item__source">Zoom</div>
              </div>
              <IconButton label="Открыть">
                <ExternalLink className="size-4" />
              </IconButton>
            </div>
            <div className="meeting-item">
              <span className="meeting-item__when">
                <strong>Вт, 11 июл</strong>
                09:30
              </span>
              <div>
                <div className="meeting-item__title">John Onboarding</div>
                <div className="meeting-item__source">Google Meet</div>
              </div>
              <IconButton label="Открыть">
                <ExternalLink className="size-4" />
              </IconButton>
            </div>
          </CardPanel>
        </div>

        <div className="bento__cell bento__cell--8">
          <CardPanel
            title="Ближайшие задачи"
            subtitle="12 задач на сегодня"
            flush
            actions={
              <Button variant="ghost" size="sm">
                Вся работа
                <ArrowUpRight className="size-4" aria-hidden />
              </Button>
            }
          >
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
                <tr>
                  <td>
                    <CellStack title="Согласовать ТЗ" subtitle="MDS-39" />
                  </td>
                  <td>{MOCK_PROJECT_CRM}</td>
                  <td className="mono cell-muted">23.05</td>
                  <td>
                    <Chip variant="info">В работе</Chip>
                  </td>
                  <td>
                    <BemAvatar initials="ИИ" color="c1" />
                  </td>
                </tr>
                <tr>
                  <td>
                    <CellStack title="Подготовить смету этапа 2" subtitle="MDS-40" />
                  </td>
                  <td>Ромашка</td>
                  <td className="mono cell-muted">24.05</td>
                  <td>
                    <Chip>Новая</Chip>
                  </td>
                  <td>
                    <BemAvatar initials="АП" color="c2" />
                  </td>
                </tr>
              </tbody>
            </DataTable>
          </CardPanel>
        </div>

        <div className="bento__cell bento__cell--4">
          <CardPanel title="Сигналы контроля" subtitle="3 активных">
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
            <Button variant="secondary" className="u-w-full u-mt-3">
              Открыть управленческую поверхность
              <ArrowUpRight className="size-4" aria-hidden />
            </Button>
          </CardPanel>
        </div>
      </div>
    </>
  );
}
