"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { LoadingState } from "@/components/ui/loading-state";
import {
  resolveStateScreenKind,
  useScenarioFixtures
} from "@/lib/mock-data/scenario-context";
import { PageIntro } from "@/views/layout/page-intro";

export type StateKind = "empty" | "error" | "forbidden" | "loading";

export function StateScreenBlock({ kind }: { kind: StateKind }) {
  const { scenario, state } = useScenarioFixtures();
  const effectiveKind = resolveStateScreenKind(kind, scenario);
  const [retryCount, setRetryCount] = useState(0);

  const copy = {
    empty: {
      title: "Нет задач",
      lead: "Создайте первую задачу или импортируйте из CRM.",
      body: (
        <EmptyState
          title="Пока пусто"
          description="Добавьте задачу или измените фильтры."
          action={
            <Button variant="primary" onClick={() => toast.success("Задача создана (демо)")}>
              Создать задачу
            </Button>
          }
        />
      )
    },
    error: {
      title: "Ошибка загрузки",
      lead: state.errorMessage ?? "Не удалось получить данные. Повторите позже.",
      body: (
        <ErrorState
          title="Что-то пошло не так"
          description={
            retryCount > 0
              ? `Повтор ${retryCount}: ${state.errorMessage ?? "Проверьте соединение и повторите запрос."}`
              : state.errorMessage ?? "Проверьте соединение и повторите запрос."
          }
          onRetry={() => {
            setRetryCount((n) => n + 1);
            toast.info("Повтор запроса (демо)");
          }}
        />
      )
    },
    forbidden: {
      title: "Нет доступа",
      lead: "Обратитесь к администратору рабочей области.",
      body: <ForbiddenState title="Доступ запрещён" description="Недостаточно прав для этого раздела." />
    },
    loading: {
      title: "Загрузка",
      lead: "Подготавливаем рабочую область…",
      body: <LoadingState label="Загрузка задач…" />
    }
  }[effectiveKind];

  return (
    <>
      <PageIntro title={copy.title} lead={copy.lead} />
      {copy.body}
    </>
  );
}
