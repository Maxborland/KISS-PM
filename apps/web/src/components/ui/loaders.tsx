import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Accent ring spinner. */
export function Spinner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Загрузка"
      className={cn(
        "size-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]",
        className
      )}
    />
  );
}

/** Full-screen branded preloader — initial workspace / session load. */
export function AppPreloader({ label = "Загрузка рабочего пространства" }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-[var(--space-4)] bg-[var(--canvas)]">
      <div className="flex items-center gap-[var(--space-2)]">
        <div
          aria-hidden
          className="grid size-9 place-items-center rounded-[var(--radius-md)] text-[length:var(--text-md)] font-bold text-white [background-image:var(--accent-grad)]"
        >
          K
        </div>
        <span className="text-[length:var(--text-lg)] font-bold tracking-[-0.02em] text-[var(--text)]">KISS PM</span>
      </div>
      <Spinner className="size-7" />
      <p className="text-[length:var(--text-sm)] text-[var(--muted)]">{label}</p>
    </div>
  );
}

/** Skeleton that mirrors a real data table (same Table primitives → exact layout). */
export function TableSkeleton({ columns = 4, rows = 6, className }: { columns?: number; rows?: number; className?: string }) {
  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          {Array.from({ length: columns }).map((_, i) => (
            <TableHead key={i}>
              <Skeleton variant="text" width="sm" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, r) => (
          <TableRow key={r}>
            {Array.from({ length: columns }).map((_, c) => (
              <TableCell key={c}>
                <Skeleton variant="text" width={c === 0 ? "lg" : "md"} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Skeleton for an avatar feed (activity / audit log). */
export function FeedSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-[var(--space-4)] p-[var(--space-4)]", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-[var(--space-3)]">
          <Skeleton variant="avatar" />
          <div className="flex flex-1 flex-col gap-[var(--space-2)]">
            <Skeleton variant="text" width="md" />
            <Skeleton variant="text" width="sm" />
          </div>
        </div>
      ))}
    </div>
  );
}
