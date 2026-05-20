import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

function readText(path: string): string {
  return readFileSync(path, "utf8");
}

describe("CRM entity workspace contract", () => {
  const detailViews = [
    "apps/web/src/ClientCrmView.tsx",
    "apps/web/src/ContactCrmView.tsx",
    "apps/web/src/ProductCrmView.tsx"
  ];

  test("uses one entity workspace template for client, contact and product cards", () => {
    for (const viewPath of detailViews) {
      const text = readText(viewPath);

      expect(text).toContain("CrmEntityWorkspace");
      expect(text).toContain("CrmActivityPanel");
      expect(text).not.toContain("CrmEntityActivityPlaceholder");
      expect(text).toContain("CrmEntityFactList");
      expect(text).not.toContain("crm-card-layout");
    }
  });

  test("keeps CRM detail pages editable inline through persisted mutations", () => {
    const clientView = readText("apps/web/src/ClientCrmView.tsx");
    const contactView = readText("apps/web/src/ContactCrmView.tsx");
    const productView = readText("apps/web/src/ProductCrmView.tsx");

    expect(clientView).toContain("saveClientInline");
    expect(clientView).toContain("crmMutations.updateClient.mutateAsync");
    expect(contactView).toContain("saveContactInline");
    expect(contactView).toContain("crmMutations.updateContact.mutateAsync");
    expect(productView).toContain("saveProductInline");
    expect(productView).toContain("crmMutations.updateProduct.mutateAsync");
  });

  test("does not leave the removed horizontal CRM card layout in active styles", () => {
    const styles = readText("apps/web/src/styles.css");

    expect(styles).not.toContain(".crm-card-layout");
  });
});
