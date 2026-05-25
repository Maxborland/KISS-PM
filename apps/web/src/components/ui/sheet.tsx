"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";

import { cn } from "@/lib/cn";

function Sheet(props: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger(props: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose(props: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal(props: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "ds-sheet-overlay fixed inset-0",
        "bg-[rgba(15,23,42,0.4)] backdrop-blur-[2px]",
        className
      )}
      style={{ zIndex: "var(--z-modal)" } as React.CSSProperties}
      {...props}
    />
  );
}

export type SheetSize = "md" | "lg" | "xl";

export type SheetContentProps = React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "left" | "right";
  size?: SheetSize;
  showCloseButton?: boolean;
};

const SHEET_SIZE_CLASS: Record<SheetSize, string> = {
  md: "w-[420px] max-w-[90vw]",
  lg: "w-[720px] max-w-[92vw]",
  xl: "w-[1080px] max-w-[96vw]"
};

function SheetContent({
  className,
  children,
  side = "right",
  size = "md",
  showCloseButton = true,
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-size={size}
        className={cn(
          "fixed inset-y-0 flex flex-col bg-[var(--panel-elevated)] shadow-[var(--shadow-xl)]",
          SHEET_SIZE_CLASS[size],
          side === "right" && "right-0 border-l border-[var(--border)] ds-sheet-content--right",
          side === "left" && "left-0 border-r border-[var(--border)] ds-sheet-content--left",
          className
        )}
        style={{ zIndex: "var(--z-modal)" } as React.CSSProperties}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <SheetPrimitive.Close
            className="absolute top-3 right-3 inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--panel-strong)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]"
            aria-label="Закрыть"
          >
            <XIcon className="size-4" />
          </SheetPrimitive.Close>
        ) : null}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(
        "flex flex-col gap-1 px-[var(--space-5)] py-[var(--space-4)] border-b border-[var(--border-subtle)]",
        className
      )}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "mt-auto flex justify-end gap-[var(--space-2)] px-[var(--space-5)] py-[var(--space-4)] border-t border-[var(--border-subtle)]",
        className
      )}
      {...props}
    />
  );
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("flex-1 overflow-auto px-[var(--space-5)] py-[var(--space-4)]", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "text-[length:var(--text-h3)] leading-[var(--lh-h3)] font-semibold text-[var(--text-strong)]",
        "font-[family-name:var(--font-display)]",
        className
      )}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-[length:var(--text-md)] leading-[var(--lh-md)] text-[var(--muted-strong)]", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription
};
