import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { LoadingState } from "@/components/ui/loading-state";
import { PageIntro } from "@/views/layout/page-intro";
import { TaskCreateDialog } from "@/views/blocks/task-create-modal-block";
import { demoAction } from "@/views/lib/demo";

export type StateKind = "empty" | "error" | "forbidden" | "loading";

export function StateScreenBlock({ kind }: { kind: StateKind }) {
  const copy = {
    empty: {
      title: "Нет задач",
      lead: "Создайте первую задачу или импортируйте из CRM.",
      body: (
        <EmptyState
          title="Пока пусто"
          description="Добавьте задачу или измените фильтры."
          action={<TaskCreateDialog trigger={<Button variant="primary">Создать задачу</Button>} />}
        />
      )
    },
    error: {
      title: "Ошибка загрузки",
      lead: "Не удалось получить данные. Повторите позже.",
      body: (
        <ErrorState
          title="Что-то пошло не так"
          description="Проверьте соединение и повторите запрос."
          action={
            <Button variant="secondary" {...demoAction("повтор загрузки")}>
              Повторить
            </Button>
          }
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
  }[kind];

  return (
    <>
      <PageIntro title={copy.title} lead={copy.lead} />
      {copy.body}
    </>
  );
}
