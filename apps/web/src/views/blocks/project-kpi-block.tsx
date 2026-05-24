import { AlertTriangle, Target, TrendingUp, Zap } from "lucide-react";

import { CardPanel } from "@/components/domain/card-panel";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { MOCK_PROJECT_CRM, mockProjectScreenTitle } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";

const KPI = [
  { label: "SPI", value: "0.94", delta: "+0.02 неделя", tone: "warm" as const },
  { label: "CPI", value: "1.02", delta: "+0.01 неделя", tone: "cool" as const },
  { label: "Загрузка", value: "82%", delta: "−4 пп", tone: "" as const },
  { label: "Просрочено", value: "3", delta: "+1 за неделю", tone: "" as const }
];

const SIGNALS = [
  { tone: "warning", icon: AlertTriangle, title: "Риск срока — DataHub", body: "−4 дня к базовому плану · срок 12 июня" },
  { tone: "danger", icon: Zap, title: "Перегруз — Петров А.", body: "112% на неделе 21" },
  { tone: "info", icon: TrendingUp, title: `Скоуп +6 SP — ${MOCK_PROJECT_CRM}`, body: "Согласован клиентом 22.05" }
];

export function ProjectKpiBlock() {
  return (
    <>
      <PageIntro
        title={mockProjectScreenTitle("KPI")}
        lead="Показатели и сигналы управления."
        actions={<Button variant="secondary">Открыть управленческую поверхность</Button>}
      />
      <div className="bento">
        {KPI.map((k, i) => (
          <div
            key={k.label}
            className={`bento__cell tile ${i === 0 ? "tile--gradient-warm" : ""} ${i === 1 ? "tile--gradient-cool" : ""}`}
          >
            <div className="tile__head">
              <span className="tile__label">{k.label}</span>
              <span className="tile__icon">
                <Target className="size-4" aria-hidden />
              </span>
            </div>
            <div className="tile__value tile__value--xl">{k.value}</div>
            <div className="tile__sub">{k.delta}</div>
          </div>
        ))}
        <div className="bento__cell bento__cell--12">
          <CardPanel title="Сигналы контроля" subtitle={`${SIGNALS.length} активных`}>
            <ul className="signal-list">
              {SIGNALS.map((s, i) => (
                <li key={i} className="signal-list__item">
                  <span className={`tile__icon tile__icon--${s.tone}`}>
                    <s.icon className="size-4" aria-hidden />
                  </span>
                  <div className="flex-1">
                    <div className="u-text-body u-text-strong">{s.title}</div>
                    <div className="u-text-xs u-text-muted">{s.body}</div>
                  </div>
                  <Chip variant={s.tone === "danger" ? "warning" : s.tone === "warning" ? "warning" : "info"}>
                    {s.tone === "danger" ? "Action" : "Review"}
                  </Chip>
                </li>
              ))}
            </ul>
          </CardPanel>
        </div>
      </div>
    </>
  );
}
