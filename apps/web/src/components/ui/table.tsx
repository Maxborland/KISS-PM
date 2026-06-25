"use client"

import * as React from "react"

import { cn } from "@/lib/cn"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t border-[var(--border-subtle)] bg-[var(--panel-strong)] font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-[var(--border-subtle)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--panel-strong)] has-aria-expanded:bg-[var(--panel-strong)] data-[state=selected]:bg-[var(--accent-soft)]",
        className
      )}
      {...props}
    />
  )
}

type CellAlign = "left" | "right" | "center"

// numeric ⇒ right-aligned + tabular figures so digit places line up (Principle 1).
// Pass `align` to override; default is left (cells) / left (heads).
const alignClass = (align: CellAlign | undefined, numeric: boolean | undefined) => {
  const resolved = align ?? (numeric ? "right" : undefined)
  return cn(
    resolved === "right" && "text-right",
    resolved === "center" && "text-center",
    resolved === "left" && "text-left",
    numeric && "[font-variant-numeric:tabular-nums]"
  )
}

function TableHead({
  className,
  align,
  numeric,
  ...props
}: React.ComponentProps<"th"> & { align?: CellAlign; numeric?: boolean }) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-[var(--space-2)] align-middle text-[var(--text-xs)] font-semibold uppercase tracking-[0.04em] whitespace-nowrap text-[var(--muted-strong)] [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        alignClass(align, numeric) || "text-left",
        className
      )}
      {...props}
    />
  )
}

function TableCell({
  className,
  align,
  numeric,
  truncate,
  ...props
}: React.ComponentProps<"td"> & { align?: CellAlign; numeric?: boolean; truncate?: boolean }) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        truncate ? "max-w-[var(--col-max,16rem)] truncate" : "whitespace-nowrap",
        alignClass(align, numeric),
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-[var(--text-sm)] text-[var(--muted)]", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
