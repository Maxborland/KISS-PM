import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/cn";

const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap cursor-pointer select-none",
    "rounded-[var(--radius-md)] font-medium",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--duration-fast)]",
    "focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]",
    "active:translate-y-[0.5px]",
    "disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
  ].join(" "),
  {
    variants: {
      variant: {
        // Тёмная "primary" — главная кнопка-действие в шаблонах CRM/планирования
        default: [
          "bg-[var(--text-strong)] text-white border border-[var(--text-strong)]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(15,23,42,0.16)]",
          "hover:bg-[#1f2937] hover:border-[#1f2937]"
        ].join(" "),
        // Акцентная (синяя) — выделение положительного действия
        primary: [
          "bg-[var(--accent)] text-white border border-[var(--accent)]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(37,99,235,0.25)]",
          "hover:bg-[var(--accent-hover)] hover:border-[var(--accent-hover)]"
        ].join(" "),
        accent: [
          "bg-[var(--accent)] text-white border border-[var(--accent)]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(37,99,235,0.25)]",
          "hover:bg-[var(--accent-hover)] hover:border-[var(--accent-hover)]"
        ].join(" "),
        // Мягкий accent — нативно для secondary действий
        soft: [
          "bg-[var(--accent-soft)] text-[var(--accent)] border border-transparent",
          "hover:bg-[color-mix(in_oklab,var(--accent-soft),var(--accent)_8%)]",
          "hover:text-[var(--accent-hover)]"
        ].join(" "),
        secondary: [
          "bg-[var(--panel)] text-[var(--text)] border border-[var(--border-strong)]",
          "hover:bg-[var(--panel-strong)] hover:border-[var(--muted-soft)]"
        ].join(" "),
        outline: [
          "bg-transparent text-[var(--text)] border border-[var(--border-strong)]",
          "hover:bg-[var(--panel-strong)] hover:border-[var(--muted-soft)]"
        ].join(" "),
        ghost: [
          "bg-transparent text-[var(--muted-strong)] border border-transparent",
          "hover:bg-[var(--panel-strong)] hover:text-[var(--text)]"
        ].join(" "),
        destructive: [
          "bg-[var(--danger)] text-white border border-[var(--danger)]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(220,38,38,0.25)]",
          "hover:bg-[var(--danger-text,#b91c1c)] hover:border-[var(--danger-text,#b91c1c)]"
        ].join(" "),
        "destructive-soft": [
          "bg-[var(--danger-soft)] text-[var(--danger-text,var(--danger))] border border-transparent",
          "hover:bg-[color-mix(in_oklab,var(--danger-soft),var(--danger)_10%)]"
        ].join(" "),
        link: "text-[var(--accent)] underline-offset-4 hover:underline border-0 bg-transparent p-0 h-auto active:translate-y-0"
      },
      size: {
        default: "h-[var(--row-h)] px-2.5 text-[length:var(--text-sm)] leading-none",
        sm: "h-7 px-2 text-[length:var(--text-xs)] gap-1.5",
        md: "h-[var(--row-h)] px-2.5 text-[length:var(--text-sm)] leading-none",
        lg: "h-8 px-3.5 text-[length:var(--text-md)] rounded-[var(--radius-lg)]",
        icon: "h-[var(--row-h)] w-[var(--row-h)] p-0 [&_svg]:size-3.5",
        "icon-sm": "h-7 w-7 p-0 [&_svg]:size-3.5",
        xs: "h-6 px-2 text-[length:var(--text-xs)] gap-1 rounded-[var(--radius-sm)]"
      }
    },
    defaultVariants: { variant: "default", size: "default" }
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
