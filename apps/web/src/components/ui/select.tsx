"use client";

import * as Popover from "@radix-ui/react-popover";
import { useState, type ReactNode } from "react";

export function PlanningSelect<T extends string>(props: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  "aria-label": string;
}) {
  const [open, setOpen] = useState(false);
  const selected = props.options.find((option) => option.value === props.value);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="planning-select-trigger" aria-label={props["aria-label"]}>
        {selected?.label ?? props.value}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="planning-select-content">
          {props.options.map((option) => (
            <button
              key={option.value}
              className="planning-select-option"
              type="button"
              onClick={() => {
                props.onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function PlanningSelectLabel(props: { children: ReactNode }) {
  return <span className="planning-select-label">{props.children}</span>;
}
