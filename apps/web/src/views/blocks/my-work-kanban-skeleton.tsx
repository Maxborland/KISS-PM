import { Skeleton } from "@/components/ui/skeleton";

const COLUMN_KEYS = ["new", "in_progress", "review", "done"] as const;

/** Скелетон канбана «Моя работа» — 4 колонки как у `<Kanban>`. */
export function MyWorkKanbanSkeleton() {
  return (
    <div className="my-work__board">
      <div className="kanban kanban--skeleton" aria-busy="true" aria-label="Загрузка канбана">
        {COLUMN_KEYS.map((key) => (
          <div key={key} className="kanban-col kanban-col--skeleton">
            <div className="kanban-col__accent" aria-hidden />
            <div className="kanban-col__head my-work-skeleton__head">
              <Skeleton variant="text" width="md" className="my-work-skeleton__col-title" />
              <Skeleton variant="circle" className="my-work-skeleton__menu" />
            </div>
            <div className="kanban-col__body">
              <Skeleton variant="block" className="my-work-skeleton__card" />
              <Skeleton variant="block" className="my-work-skeleton__card my-work-skeleton__card--short" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
