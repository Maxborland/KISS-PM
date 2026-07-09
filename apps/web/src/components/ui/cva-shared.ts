/** Shared Tailwind class fragments for shadcn CVA overrides (design-v3 / SHADCN-OVERRIDE.md). */

export const focusRing =
  "focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]";

export const disabledBase = "disabled:pointer-events-none disabled:opacity-50";

export const inputBase = [
  "flex h-[var(--row-h)] w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)]",
  "[@media(pointer:coarse)]:min-h-[var(--touch-target)]",
  "bg-[var(--panel)] px-[var(--space-3)] text-[length:var(--text-md)] leading-[var(--lh-md)] text-[var(--text)]",
  "placeholder:text-[var(--muted)] transition-colors duration-[var(--duration-fast)]",
  "focus-visible:border-[var(--accent)] focus-visible:shadow-[var(--ring-focus)]",
  disabledBase
].join(" ");

export const menuContentBase = [
  "z-[var(--z-dropdown)] min-w-[10rem] overflow-hidden rounded-[var(--radius-md)]",
  "border border-[var(--border)] bg-[var(--panel-elevated)] p-[var(--space-1)] shadow-[var(--shadow-md)]"
].join(" ");

export const menuItemBase = [
  "relative flex cursor-pointer select-none items-center gap-[var(--space-2)]",
  "[@media(pointer:coarse)]:min-h-[var(--touch-target)]",
  "rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-md)] text-[var(--text)]",
  "outline-none transition-colors duration-[var(--duration-fast)]",
  "data-[highlighted]:bg-[var(--panel-strong)] data-[highlighted]:text-[var(--text-strong)]",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
].join(" ");
