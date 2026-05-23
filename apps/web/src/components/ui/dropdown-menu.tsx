"use client";

import * as RadixDropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ComponentProps, ReactNode } from "react";

export function PlanningDropdownMenu(props: {
  trigger: ReactNode;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <RadixDropdownMenu.Root
      {...(props.open !== undefined ? { open: props.open } : {})}
      {...(props.onOpenChange ? { onOpenChange: props.onOpenChange } : {})}
    >
      <RadixDropdownMenu.Trigger asChild>{props.trigger}</RadixDropdownMenu.Trigger>
      <RadixDropdownMenu.Portal>
        <RadixDropdownMenu.Content className="planning-dropdown-content" sideOffset={4}>
          {props.children}
        </RadixDropdownMenu.Content>
      </RadixDropdownMenu.Portal>
    </RadixDropdownMenu.Root>
  );
}

export function PlanningDropdownItem(props: {
  label: string;
  onSelect?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <RadixDropdownMenu.Item
      className="planning-dropdown-item"
      {...(props.disabled !== undefined ? { disabled: props.disabled } : {})}
      {...(props.title ? { title: props.title } : {})}
      onSelect={(event) => {
        event.preventDefault();
        props.onSelect?.();
      }}
    >
      {props.label}
    </RadixDropdownMenu.Item>
  );
}

export function DropdownMenu(props: ComponentProps<typeof RadixDropdownMenu.Root>) {
  return <RadixDropdownMenu.Root {...props} />;
}

export function DropdownMenuTrigger(props: ComponentProps<typeof RadixDropdownMenu.Trigger>) {
  return <RadixDropdownMenu.Trigger {...props} />;
}

export function DropdownMenuContent(props: ComponentProps<typeof RadixDropdownMenu.Content>) {
  return (
    <RadixDropdownMenu.Portal>
      <RadixDropdownMenu.Content {...props} />
    </RadixDropdownMenu.Portal>
  );
}

export function DropdownMenuItem({
  variant,
  className,
  ...props
}: ComponentProps<typeof RadixDropdownMenu.Item> & { variant?: "default" | "destructive" }) {
  const mergedClassName = [className, variant === "destructive" ? "dropdown-item-destructive" : ""]
    .filter(Boolean)
    .join(" ");
  return <RadixDropdownMenu.Item {...props} className={mergedClassName || undefined} />;
}
