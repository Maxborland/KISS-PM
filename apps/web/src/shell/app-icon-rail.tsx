import type { RailSectionId } from "@/shell/navigation-registry";
import { railSectionsForPermissions } from "@/shell/navigation-registry";
import { cn } from "@/lib/cn";

export type AppIconRailProps = {
  activeSection: RailSectionId;
  permissions?: readonly string[] | undefined;
};

export function AppIconRail({ activeSection, permissions }: AppIconRailProps) {
  const sections = railSectionsForPermissions(permissions);

  return (
    <nav className="app-icon-rail" aria-label="Разделы продукта">
      <div className="app-icon-rail__logo" aria-hidden>
        <span className="brand-mark">К</span>
      </div>
      <div className="app-icon-rail__sections">
        {sections.map((section) => {
          const Icon = section.icon;
          const active = section.id === activeSection;
          return (
            <a
              key={section.id}
              href={section.href}
              className={cn("app-icon-rail__btn", active && "is-active")}
              aria-label={section.label}
              aria-current={active ? "page" : undefined}
              title={section.label}
            >
              <Icon className="size-5" strokeWidth={1.75} aria-hidden />
            </a>
          );
        })}
      </div>
    </nav>
  );
}
