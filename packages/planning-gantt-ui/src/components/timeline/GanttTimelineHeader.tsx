import { generateTimelineTiers } from "../../lib/timelineScale";

export function GanttTimelineHeader(props: {
  rangeStart: string;
  rangeFinish: string;
  dayWidth: number;
  width: number;
}) {
  const tiers = generateTimelineTiers(props.rangeStart, props.rangeFinish, props.dayWidth);

  return (
    <g aria-label="Шкала времени">
      {tiers.top.map((cell) => (
        <g key={`${cell.label}:${cell.x}`}>
          <rect x={cell.x} y={0} width={cell.width} height={28} fill="transparent" />
          <text className="planningGanttHeaderText" x={cell.x + 6} y={18}>
            {cell.label}
          </text>
        </g>
      ))}
      {tiers.bottom.map((cell) => (
        <g key={`${cell.label}:${cell.x}`}>
          {cell.isWeekend ? (
            <rect className="planningGanttWeekend" x={cell.x} y={28} width={cell.width} height="100%" />
          ) : null}
          <line className="planningGanttGridLine" x1={cell.x} x2={cell.x} y1={28} y2="100%" />
          <text className="planningGanttHeaderText" x={cell.x + 4} y={48}>
            {cell.label}
          </text>
        </g>
      ))}
      <line className="planningGanttGridLine" x1={0} x2={props.width} y1={56} y2={56} />
      {tiers.todayX >= 0 && tiers.todayX <= props.width ? (
        <line x1={tiers.todayX} x2={tiers.todayX} y1={0} y2="100%" stroke="#0f766e" strokeWidth={1.5} />
      ) : null}
    </g>
  );
}
