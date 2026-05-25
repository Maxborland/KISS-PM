import { Chip } from "@/components/ui/chip";
import {
  formatPredecessorText,
  type GanttDependencyType
} from "@/lib/gantt/predecessor-text";
import { cn } from "@/lib/cn";

export type DependencyChipProps = {
  rowNumber: number;
  type?: GanttDependencyType;
  lagDays?: number;
  text?: string;
  className?: string;
};

/** Чип предшественника в терминологии Gantt (3FS+2d). */
export function DependencyChip({
  rowNumber,
  type = "FS",
  lagDays = 0,
  text,
  className
}: DependencyChipProps) {
  const display = text ?? formatPredecessorText(rowNumber, type, lagDays);
  return (
    <span className={cn("dependency-chip-wrap", className)} title={`Предшественник: ${display}`}>
      <Chip variant="info" className="dependency-chip mono">
        {display}
      </Chip>
    </span>
  );
}
