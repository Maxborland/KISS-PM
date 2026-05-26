import type { ReactNode } from "react";

export type VariantMatrixItem = {
  label: string;
  node: ReactNode;
};

export function VariantMatrix({ items }: { items: VariantMatrixItem[] }) {
  return (
    <div className="flex max-w-3xl flex-col gap-[var(--space-3)] p-[var(--space-4)]">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-[var(--space-2)]">
          <span className="type-meta text-[var(--muted)]">{item.label}</span>
          <div className="flex flex-wrap items-center gap-[var(--space-2)]">{item.node}</div>
        </div>
      ))}
    </div>
  );
}
