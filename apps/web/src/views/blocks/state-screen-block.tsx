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

const DEMO_CORRELATION_ID = "kiss-demo-7f3a2c91";

export function StateScreenBlock({ kind }: { kind: StateKind }) {
  const { scenario, state } = useScenarioFixtures();
  const effectiveKind = resolveStateScreenKind(kind, scenario);
  const [retryCount, setRetryCount] = useState(0);

  const copy = {
    empty: {
      title: "По этому виду задач нет",
      lead: "Сохранённый вид активен, но сейчас не находит задач.",
      body: (
        <EmptyState
          level="L3"
          title="Нет задач для работы"
          description="Создайте задачу вручную, импортируйте из CRM или сбросьте фильтры."
          action={
            <>
              <Button variant="primary" onClick={() => toast.success("Задача создана (демо)")}>
                Создать задачу
              </Button>
              <Button variant="secondary" onClick={() => toast.info("Фильтры сброшены (демо)")}>
                Сбросить фильтры
              </Button>
            </>
          }
        />
      )
    },
    error: {
      title: "Ошибка загрузки",
      lead: state.errorMessage ?? "Не удалось обновить рабочие данные.",
      body: (
        <ErrorState
          level="L3"
          errorKey="500"
          correlationId={DEMO_CORRELATION_ID}
          {...(retryCount > 0 || state.errorMessage
            ? {
                description:
                  retryCount > 0
                    ? `Повтор ${retryCount}: ${state.errorMessage ?? "Проверьте соединение и повторите запрос."}`
                    : (state.errorMessage ?? "Данные на экране могли устареть. Повторите запрос.")
              }
            : {})}
          onRetry={() => {
            setRetryCount((n) => n + 1);
            toast.info("Повтор запроса (демо)");
          }}
          onSupport={() => toast.info("Обращение в поддержку (демо)")}
        />
      )
    },
    forbidden: {
      title: "Нет доступа",
      lead: "Текущая роль не открывает этот раздел.",
      body: (
        <ForbiddenState
          level="L3"
          title="Доступ запрещён"
          description="Запросите доступ у администратора рабочей области или переключитесь на профиль с нужной ролью."
          action={
            <Button variant="outline" onClick={() => toast.info("Запрос доступа (демо)")}>
              Запросить доступ
            </Button>
          }
        />
      )
    },
    loading: {
      title: "Загрузка",
      lead: "Подготавливаем рабочую область…",
      body: <LoadingState level="L3" layout="table" label="Загрузка задач…" />
    }
  }[effectiveKind];

  return (
    <>
      <PageIntro title={copy.title} lead={copy.lead} />
      {copy.body}
    </>
  );
}
