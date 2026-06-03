"use client";

import { ErrorState } from "@/components/ui/error-state";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ApiError } from "@/lib/api";
import {
  isSessionRequiredError,
  useAuthMeQuery,
  useWorkspaceBootstrapQueries
} from "@/lib/api/bootstrap";
import type { ScreenId } from "@/views/catalog";
import { RuntimeDataScreen } from "@/shell/runtime-data-screen";
import { RuntimeLoginScreen } from "@/shell/runtime-login-screen";

export function RuntimeScreen({
  dealId,
  screenId,
  projectId,
  initialTaskId
}: {
  dealId?: string | undefined;
  screenId: ScreenId;
  projectId?: string | undefined;
  initialTaskId?: string | undefined;
}) {
  if (screenId === "19-login") {
    return <RuntimeLoginScreen mode="login-route" />;
  }

  return (
    <AuthenticatedRuntimeScreen
      screenId={screenId}
      dealId={dealId}
      projectId={projectId}
      initialTaskId={initialTaskId}
    />
  );
}

function AuthenticatedRuntimeScreen({
  dealId,
  screenId,
  projectId,
  initialTaskId
}: {
  dealId?: string | undefined;
  screenId: ScreenId;
  projectId?: string | undefined;
  initialTaskId?: string | undefined;
}) {
  const authQuery = useAuthMeQuery();
  const bootstrapQueries = useWorkspaceBootstrapQueries({
    enabled: authQuery.isSuccess,
    permissions: authQuery.data?.permissions ?? []
  });

  if (authQuery.isPending) {
    return <LoadingState layout="bento" level="L1" label="Загружаем рабочую область…" />;
  }

  if (isSessionRequiredError(authQuery.error)) {
    return (
      <RuntimeLoginScreen
        mode="protected-route"
        onAuthenticated={() => void authQuery.refetch()}
      />
    );
  }

  if (authQuery.error) {
    if (authQuery.error instanceof ApiError && authQuery.error.code === "forbidden") {
      return (
        <ForbiddenState
          level="L1"
          title="Нет доступа"
          description="Недостаточно прав для входа в рабочую область."
        />
      );
    }

    return (
      <ErrorState
        level="L1"
        title="Не удалось загрузить рабочую область"
        description="Повторите попытку или проверьте доступность API."
        onRetry={() => void authQuery.refetch()}
      />
    );
  }

  const bootstrapError = bootstrapQueries.find((query) => query.error)?.error;
  if (bootstrapError) {
    if (bootstrapError instanceof ApiError && bootstrapError.code === "forbidden") {
      return (
        <ForbiddenState
          level="L1"
          title="Нет доступа к справочникам"
          description="Рабочая область доступна, но общие справочники скрыты правами."
        />
      );
    }

    return (
      <ErrorState
        level="L1"
        title="Не удалось загрузить справочники"
        description="Экран не будет открыт, пока базовые данные рабочей области недоступны."
        onRetry={() => {
          for (const query of bootstrapQueries) {
            void query.refetch();
          }
        }}
      />
    );
  }

  if (bootstrapQueries.some((query) => query.isPending || query.isFetching)) {
    return <LoadingState layout="bento" level="L1" label="Подготавливаем справочники…" />;
  }

  return (
    <RuntimeDataScreen
      screenId={screenId}
      dealId={dealId}
      projectId={projectId}
      permissions={authQuery.data?.permissions ?? []}
      currentUserId={authQuery.data.user.id}
      currentAccessProfileId={authQuery.data.user.accessProfileId}
      initialTaskId={initialTaskId}
    />
  );
}
