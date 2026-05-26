import "./planning-gantt.css";
import type { ReactNode } from "react";

export function SplitView(props: {
  left: ReactNode;
  right: ReactNode;
  leftLabel: string;
  rightLabel: string;
}) {
  return (
    <section className="planningGanttSplit" aria-label="Рабочая область графика">
      <div className="planningGanttPane" aria-label={props.leftLabel}>
        {props.left}
      </div>
      <div className="planningGanttPane" aria-label={props.rightLabel}>
        {props.right}
      </div>
    </section>
  );
}
