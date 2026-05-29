"use client";

import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";

const TENANTS = [
  { id: "acme", label: "ACME Studio", slug: "acme.studio" },
  { id: "demo", label: "Демо арендатор", slug: "demo.kisspm.local" }
] as const;

export type TenantSwitcherProps = {
  className?: string;
};

export function TenantSwitcher({ className }: TenantSwitcherProps) {
  const [tenantId, setTenantId] = useState<(typeof TENANTS)[number]["id"]>("acme");
  const tenant = TENANTS.find((t) => t.id === tenantId) ?? TENANTS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn("tenant-switcher", className)} aria-label="Сменить арендатора">
          <span className="tenant-switcher__mark" aria-hidden>
            {tenant.label.slice(0, 1)}
          </span>
          <span className="tenant-switcher__text">
            <span className="tenant-switcher__title">{tenant.label}</span>
            <span className="tenant-switcher__slug">{tenant.slug}</span>
          </span>
          <ChevronsUpDown className="tenant-switcher__chevron size-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        {TENANTS.map((item) => (
          <DropdownMenuItem key={item.id} onSelect={() => setTenantId(item.id)}>
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{item.label}</span>
              <span className="text-[var(--text-xs)] text-[var(--muted)]">{item.slug}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
