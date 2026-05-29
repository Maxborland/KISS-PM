import { formatRub } from "@/lib/mock-data/format";
import { cn } from "@/lib/cn";

export type MoneyValueProps = {
  amount: number;
  muted?: boolean;
  className?: string;
};

/** Денежная сумма в рублях с tabular nums. */
export function MoneyValue({ amount, muted, className }: MoneyValueProps) {
  return (
    <span className={cn("money-value mono", muted && "money-value--muted", className)}>
      {formatRub(amount)}
    </span>
  );
}
