import { Skeleton } from "@/components/ui/skeleton";

/** Скелетон дашборда — та же 12-колоночная сетка bento, что и в default-сценарии. */
export function DashboardBentoSkeleton() {
  return (
    <div className="bento bento--skeleton" aria-busy="true" aria-label="Загрузка дашборда">
      <div className="bento__cell">
        <div className="kpi-accent-tile kpi-accent-tile--warm kpi-accent-tile--skeleton" aria-hidden>
          <div className="kpi-accent-tile__bar" />
          <div className="kpi-accent-tile__body">
            <Skeleton variant="text" width="md" className="bento-skeleton__line" />
            <Skeleton variant="title" width="sm" className="bento-skeleton__value" />
            <Skeleton variant="text" width="lg" className="bento-skeleton__line" />
          </div>
        </div>
      </div>
      <div className="bento__cell">
        <div className="kpi-accent-tile kpi-accent-tile--cool kpi-accent-tile--skeleton" aria-hidden>
          <div className="kpi-accent-tile__bar" />
          <div className="kpi-accent-tile__body">
            <Skeleton variant="text" width="md" className="bento-skeleton__line" />
            <Skeleton variant="title" width="sm" className="bento-skeleton__value" />
            <Skeleton variant="text" width="lg" className="bento-skeleton__line" />
          </div>
        </div>
      </div>
      {[0, 1].map((key) => (
        <div key={key} className="bento__cell tile tile--metric bento-skeleton__kpi">
          <Skeleton variant="text" width="md" className="bento-skeleton__line" />
          <Skeleton variant="title" width="sm" className="bento-skeleton__value" />
          <Skeleton variant="text" width="lg" className="bento-skeleton__line" />
        </div>
      ))}

      <div className="bento__cell bento__cell--8 tile bento-skeleton__panel bento-skeleton__panel--chart">
        <div className="bento-skeleton__panel-head">
          <Skeleton variant="title" width="md" />
          <Skeleton variant="chip" />
        </div>
        <Skeleton variant="block" className="bento-skeleton__chart" />
        <div className="bento-skeleton__panel-foot">
          <Skeleton variant="text" width="lg" />
          <Skeleton variant="text" width="md" />
        </div>
      </div>

      <div className="bento__cell bento__cell--4 tile bento-skeleton__panel">
        <div className="bento-skeleton__panel-head">
          <Skeleton variant="title" width="md" />
          <Skeleton variant="circle" />
        </div>
        <div className="bento-skeleton__stack">
          <Skeleton variant="row" className="bento-skeleton__row" />
          <Skeleton variant="row" className="bento-skeleton__row" />
        </div>
      </div>

      <div className="bento__cell bento__cell--8 tile bento-skeleton__panel bento-skeleton__panel--table">
        <div className="bento-skeleton__panel-head">
          <Skeleton variant="title" width="md" />
          <Skeleton variant="chip" />
        </div>
        <div className="bento-skeleton__table">
          <Skeleton variant="row" className="bento-skeleton__table-head" />
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} variant="row" className="bento-skeleton__table-row" />
          ))}
        </div>
      </div>

      <div className="bento__cell bento__cell--4 tile bento-skeleton__panel">
        <div className="bento-skeleton__panel-head">
          <Skeleton variant="title" width="md" />
        </div>
        <div className="bento-skeleton__stack">
          <Skeleton variant="row" className="bento-skeleton__row" />
          <Skeleton variant="row" className="bento-skeleton__row" />
          <Skeleton variant="block" className="bento-skeleton__cta" />
        </div>
      </div>
    </div>
  );
}
