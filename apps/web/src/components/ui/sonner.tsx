"use client";

import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import { useDocumentTheme } from "@/lib/document-theme";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const theme: NonNullable<ToasterProps["theme"]> = useDocumentTheme();

  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />
      }}
      toastOptions={{
        classNames: {
          toast:
            "!bg-[var(--panel-elevated)] !text-[var(--text)] !border-[var(--border)] !shadow-[var(--shadow-lg)] !rounded-[var(--radius-md)]",
          title: "!font-semibold !text-[var(--text)]",
          description: "!text-[var(--muted)] !text-[var(--text-sm)]",
          success: "!border-[var(--success)]",
          error: "!border-[var(--danger)]",
          warning: "!border-[var(--warning)]",
          info: "!border-[var(--info)]"
        }
      }}
      {...props}
    />
  );
};

export { Toaster };
