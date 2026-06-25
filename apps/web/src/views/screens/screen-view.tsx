import type { ReactNode } from "react";

import { ProjectKpiBlock } from "@/views/blocks/project-kpi-block";
import { ScreenPlaceholderBlock } from "@/views/blocks/screen-placeholder-block";
import { SpaceDisciplineBlock } from "@/views/blocks/space-discipline-block";
import { StateScreenBlock } from "@/views/blocks/state-screen-block";
import { TaskCreateModalBlock } from "@/views/blocks/task-create-modal-block";
import { type ScreenId, SCREEN_META } from "@/views/catalog";
import { WorkspaceChrome } from "@/views/layout/workspace-chrome";

/* ============================================================
   Каталог статических экранов-прототипов (Views/Screens).
   Большинство экранов 00–19 переведены в функциональные surface
   (Project Delivery / CRM / Communications / Auth / Workspace / Admin)
   и удалены отсюда как дубли. Здесь остаются ТОЛЬКО экраны без полного
   функционального аналога — честные прототипы с demoAction:
   00 дисциплина отступов, 04 модалка создания задачи, 16 KPI, состояния.
   (01 дашборд → workspace/dashboard; 10 настройки → workspace/settings;
   11 меню аватара → auth/avatar-menu.)
   ============================================================ */
const BLOCK_BY_ID: Partial<Record<ScreenId, () => ReactNode>> = {
  "00-space-discipline": () => <SpaceDisciplineBlock />,
  "04-create-task-modal": () => <TaskCreateModalBlock />,
  "16-project-kpi": () => <ProjectKpiBlock />,
  "state-empty": () => <StateScreenBlock kind="empty" />,
  "state-error": () => <StateScreenBlock kind="error" />,
  "state-forbidden": () => <StateScreenBlock kind="forbidden" />,
  "state-loading": () => <StateScreenBlock kind="loading" />
};

export function ScreenView({ id }: { id: ScreenId }) {
  const meta = SCREEN_META[id];
  const block = BLOCK_BY_ID[id];
  const Block = block ?? (() => <ScreenPlaceholderBlock title={meta.pageTitle} lead={meta.lead} />);

  if (meta.variant === "bare") {
    return (
      <div className="app-canvas">
        <div className="app-canvas__panel app-canvas__panel--bare">{Block()}</div>
      </div>
    );
  }

  return <WorkspaceChrome meta={meta}>{Block()}</WorkspaceChrome>;
}
