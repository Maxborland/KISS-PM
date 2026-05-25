"use client";

import { useMemo, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { GANTT_MOCK_RESOURCES, type GanttResource } from "./gantt-resources";

export function GanttResourcePicker({
  value,
  disabled,
  triggerClassName,
  onAssign
}: {
  value: string;
  disabled?: boolean;
  triggerClassName?: string;
  onAssign: (resource: GanttResource | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GANTT_MOCK_RESOURCES;
    return GANTT_MOCK_RESOURCES.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.initials.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn("gantt2__resource-trigger", triggerClassName)}
          disabled={disabled}
          aria-label="Назначить ресурс"
          title="Назначить ресурс"
        >
          {value || "—"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="gantt2__resource-popover">
        <p className="gantt2__resource-popover-title">Назначить ресурс</p>
        <input
          className="gantt2__resource-search"
          placeholder="Найти ресурс"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="gantt2__resource-list" role="listbox">
          <li>
            <button
              type="button"
              className="gantt2__resource-option"
              onClick={() => {
                onAssign(null);
                setOpen(false);
              }}
            >
              Без ресурса
            </button>
          </li>
          {filtered.map((resource) => (
            <li key={resource.id}>
              <button
                type="button"
                className="gantt2__resource-option"
                onClick={() => {
                  onAssign(resource);
                  setOpen(false);
                }}
              >
                <span className="gantt2__resource-initials">{resource.initials}</span>
                <span className="gantt2__resource-name">{resource.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
