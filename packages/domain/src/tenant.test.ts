import { describe, expect, it } from "vitest";
import {
  createTenant,
  createTenantUser,
  listTenantUsers,
  type TenantUser
} from "./index";

describe("tenant domain", () => {
  it("creates tenant-owned users that belong to exactly one tenant", () => {
    const tenant = createTenant({ id: "tenant-alpha", name: "Альфа Проект" });
    const user = createTenantUser({
      id: "user-alpha-admin",
      tenantId: tenant.id,
      name: "Анна Администратор",
      accessProfileId: "tenant-admin"
    });

    expect(user.tenantId).toBe("tenant-alpha");
    expect(user).toEqual({
      id: "user-alpha-admin",
      tenantId: "tenant-alpha",
      name: "Анна Администратор",
      accessProfileId: "tenant-admin"
    });
  });

  it("filters users by tenant without leaking another tenant", () => {
    const users: TenantUser[] = [
      createTenantUser({
        id: "user-alpha-admin",
        tenantId: "tenant-alpha",
        name: "Анна Администратор",
        accessProfileId: "tenant-admin"
      }),
      createTenantUser({
        id: "user-beta-admin",
        tenantId: "tenant-beta",
        name: "Борис Администратор",
        accessProfileId: "tenant-admin"
      })
    ];

    expect(listTenantUsers(users, "tenant-alpha")).toEqual([users[0]]);
  });
});
