"use client";

import { ErrorState } from "@/components/ui/error-state";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ApiError } from "@/lib/api";
import {
  useDealsBoardReadModelQueries,
  useProjectsListReadModelQuery
} from "@/lib/api/read-models";
import {
  buildFunnelDeals,
  buildFunnelStagesFromDealStages
} from "@/lib/mock-data/scenario-presenters";
import { DealsBlock } from "@/views/blocks/deals-block";
import { ProjectsListBlock } from "@/views/blocks/projects-list-block";
import type { ScreenId } from "@/views/catalog";
import { ScreenView } from "@/views/screens/screen-view";

type RuntimePermission = string;

const STATIC_SCREEN_PERMISSION_RULES: Partial<Record<ScreenId, readonly RuntimePermission[]>> = {
  "06-deal-card": ["tenant.opportunities.read"],
  "07b-project-detail": ["tenant.projects.read"],
  "08-entities-clients": ["tenant.clients.read"],
  "08-entities-contacts": ["tenant.contacts.read"],
  "08-entities-products": ["tenant.products.read"],
  "09-admin": [
    "tenant.users.read",
    "tenant.access_profiles.read",
    "tenant.positions.read"
  ],
  "10-settings": ["tenant.workspace_config.read"],
  "11-avatar-menu": ["profile.read"],
  "12-project-gantt": ["tenant.project_plan.read"],
  "13-project-resources": ["tenant.project_resources.read"],
  "14-project-baseline": ["tenant.project_baselines.manage"],
  "15-project-scenarios": ["tenant.planning_scenarios.preview"],
  "16-project-kpi": ["tenant.kpi_definitions.read", "tenant.control_signals.read"],
  "17-project-audit": ["tenant.audit_events.read"],
  "18-project-calendars": ["tenant.project_resources.read"]
} as const;

export function canOpenStaticRuntimeScreen(
  screenId: ScreenId,
  permissions: readonly string[]
): boolean {
  const requiredPermissions = STATIC_SCREEN_PERMISSION_RULES[screenId];
  if (!requiredPermissions) return true;

  return requiredPermissions.some((permission) => permissions.includes(permission));
}

export function RuntimeDataScreen({
  screenId,
  permissions = []
}: {
  screenId: ScreenId;
  permissions?: readonly string[];
}) {
  if (screenId === "07-projects-list") {
    return <RuntimeProjectsListScreen />;
  }

  if (screenId === "05-deals") {
    return <RuntimeDealsScreen />;
  }

  if (!canOpenStaticRuntimeScreen(screenId, permissions)) {
    return (
      <ForbiddenState
        level="L1"
        title="Нет доступа"
        description="Недостаточно прав для просмотра этого раздела рабочей области."
      />
    );
  }

  return <ScreenView id={screenId} />;
}

function RuntimeProjectsListScreen() {
  const query = useProjectsListReadModelQuery();

  if (query.isPending || query.isFetching) {
    return <LoadingState layout="table" level="L1" label="Загружаем проекты…" />;
  }

  if (query.error) {
    return (
      <RuntimeReadModelError
        error={query.error}
        title="Не удалось загрузить проекты"
        forbiddenTitle="Нет доступа к проектам"
        onRetry={() => void query.refetch()}
      />
    );
  }

  return <ProjectsListBlock projects={query.data.projects} projectTemplates={[]} readOnly />;
}

function RuntimeDealsScreen() {
  const readModel = useDealsBoardReadModelQueries();

  if (readModel.isPending || readModel.isFetching) {
    return <LoadingState layout="bento" level="L1" label="Загружаем воронку сделок…" />;
  }

  if (readModel.error) {
    return (
      <RuntimeReadModelError
        error={readModel.error}
        title="Не удалось загрузить сделки"
        forbiddenTitle="Нет доступа к сделкам"
        onRetry={readModel.refetchAll}
      />
    );
  }

  const stages = readModel.data ? buildFunnelStagesFromDealStages(readModel.data.dealStages) : [];
  const deals = readModel.data ? buildFunnelDeals(readModel.data.opportunities) : [];

  return <DealsBlock initialDeals={deals} stages={stages} readOnly />;
}

function RuntimeReadModelError({
  error,
  title,
  forbiddenTitle,
  onRetry
}: {
  error: unknown;
  title: string;
  forbiddenTitle: string;
  onRetry: () => void;
}) {
  if (error instanceof ApiError && error.code === "forbidden") {
    return (
      <ForbiddenState
        level="L1"
        title={forbiddenTitle}
        description="Недостаточно прав для просмотра данных рабочей области."
      />
    );
  }

  return (
    <ErrorState
      level="L1"
      title={title}
      description="Повторите попытку или проверьте доступность API."
      onRetry={onRetry}
    />
  );
}
