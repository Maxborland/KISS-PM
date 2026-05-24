"use client";

import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";

import { cn } from "@/lib/cn";

function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("check-row", className)}
      {...props}
    />
  );
}

export type RadioGroupItemProps = React.ComponentProps<typeof RadioGroupPrimitive.Item> & {
  /** Текст рядом с радио (parity с design-v2 `.check`). */
  children?: React.ReactNode;
};

function RadioGroupItem({ className, children, id, ...props }: RadioGroupItemProps) {
  const reactId = React.useId();
  const itemId = id ?? reactId;
  return (
    <label htmlFor={itemId} className={cn("check", className)}>
      <RadioGroupPrimitive.Item
        id={itemId}
        data-slot="radio-group-item"
        className="check__input"
        {...props}
      >
        <span aria-hidden className="check__box check__box--round">
          <RadioGroupPrimitive.Indicator className="check__dot" />
        </span>
      </RadioGroupPrimitive.Item>
      {children ? <span className="check__label">{children}</span> : null}
    </label>
  );
}

export { RadioGroup, RadioGroupItem };
