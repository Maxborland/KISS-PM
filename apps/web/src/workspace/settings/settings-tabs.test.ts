import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Честность блока 12: прод-роут «Настройки рабочей области» не должен нести
// мёртвых контролов. Вкладки «Интеграции»/«Оплата» контракта не имеют и скрыты —
// вместо вечно-disabled demoAction-кнопки, которая выглядела кликабельной.
const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "settings-surface.tsx"),
  "utf8"
);

describe("workspace settings surface — скрытые вкладки без мёртвых контролов", () => {
  it("оставляет только вкладки с боевым контрактом", () => {
    expect(source).toContain('type Tab = "profile" | "notifications" | "references";');
    expect(source).toContain('{ value: "profile", label: "Профиль" }');
    expect(source).toContain('{ value: "notifications", label: "Уведомления" }');
    expect(source).toContain('{ value: "references", label: "Справочники" }');
  });

  it("не содержит вкладок-заглушек «Интеграции»/«Оплата»", () => {
    expect(source).not.toContain('value: "integrations"');
    expect(source).not.toContain('value: "billing"');
    expect(source).not.toContain("IntegrationsTab");
    expect(source).not.toContain("BillingTab");
  });

  it("не заводит demoAction/EmptyState-заглушку на прод-роуте", () => {
    expect(source).not.toContain("demoAction");
    expect(source).not.toContain("EmptyState");
  });
});
