import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type DataTableProps = {
  children: ReactNode;
  compact?: boolean;
  className?: string;
};

export function DataTable({ children, compact, className }: DataTableProps) {
  return (
    <div className={cn("table-wrap", className)}>
      <table className={cn("table", compact && "table--compact")}>{children}</table>
    </div>
  );
}
