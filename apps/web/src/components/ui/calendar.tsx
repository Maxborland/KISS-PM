"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import { ru } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

function Calendar({
  className,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      locale={ru}
      weekStartsOn={1}
      showOutsideDays={showOutsideDays}
      className={cn("kiss-calendar", className)}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft aria-hidden="true" size={16} />
          ) : (
            <ChevronRight aria-hidden="true" size={16} />
          )
      }}
      {...props}
    />
  )
}

export { Calendar }
