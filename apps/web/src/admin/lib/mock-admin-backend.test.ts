import { describe, it, expect } from "vitest";

import { AdminApiError, createAdminClient, type UserCreateInput } from "./admin-client";
import { ALL_PERMISSIONS, createMockAdminFetch } from "./mock-admin-backend";

function client() {
  return createAdminClient({ apiOrigin: "", fetchImpl: createMockAdminFetch() });
}

const newUser = (over: Partial<UserCreateInput> = {}): UserCreateInput => ({
  email: "new.user@kiss-pm.dev",
  name: "Новый Пользователь",
  accessProfileId: "role-observer",
  password: "supersecret",
  ...over
});

describe("contract-mock admin backend", () => {
  it("lists seeded roles (sorted by id) with administrator holding the full permission set", async () => {
    const c = client();
    const { accessRoles } = await c.listAccessRoles();
    expect(accessRoles.map((r) => r.id)).toEqual([...accessRoles.map((r) => r.id)].sort());
    const admin = accessRoles.find((r) => r.id === "role-administrator");
    expect(admin?.permissions).toEqual(ALL_PERMISSIONS);
  });

  it("lists seeded users (sorted by name) and positions", async () => {
    const c = client();
    const { users } = await c.listUsers();
    const { positions } = await c.listPositions();
    expect(users.length).toBe(5);
    expect(users.map((u) => u.name)).toEqual([...users.map((u) => u.name)].sort((a, b) => a.localeCompare(b, "ru")));
    expect(users.find((u) => u.id === "user-oleg")?.status).toBe("inactive");
    expect(users.find((u) => u.id === "user-ivan")?.positionName).toBe("Менеджер по продажам");
    expect(positions.length).toBeGreaterThanOrEqual(3);
  });

  /* ---- роли: CRUD ---- */
  it("creates a role via /api/tenant/current/access-profiles and returns it under accessProfile", async () => {
    const c = client();
    const { accessProfile } = await c.createAccessRole({ id: "role-billing", name: "Биллинг", permissions: ["tenant.users.read", "profile.read"] });
    expect(accessProfile.id).toBe("role-billing");
    expect(accessProfile.tenantId).toBe("tenant-alpha");
    const { accessRoles } = await c.listAccessRoles();
    expect(accessRoles.some((r) => r.id === "role-billing")).toBe(true);
  });

  it("rejects a duplicate role name on create (409 access_role_name_taken)", async () => {
    const c = client();
    await expect(c.createAccessRole({ id: "role-dup", name: "Наблюдатель", permissions: ["profile.read"] }))
      .rejects.toMatchObject({ status: 409, code: "access_role_name_taken" });
  });

  it("rejects a duplicate role id on create (409 access_role_id_taken)", async () => {
    const c = client();
    await expect(c.createAccessRole({ id: "role-observer", name: "Другое Имя", permissions: ["profile.read"] }))
      .rejects.toMatchObject({ status: 409, code: "access_role_id_taken" });
  });

  it("rejects unknown permission strings on create (400 invalid_permissions)", async () => {
    const c = client();
    await expect(c.createAccessRole({ id: "role-x", name: "Иксы", permissions: ["tenant.users.read", "made.up.permission"] }))
      .rejects.toMatchObject({ status: 400, code: "invalid_permissions" });
  });

  it("updates a non-actor role (full-replace) and returns it under accessRole", async () => {
    const c = client();
    const { accessRole } = await c.updateAccessRole("role-observer", { name: "Наблюдатель+", permissions: ["profile.read", "tenant.users.read"] });
    expect(accessRole.name).toBe("Наблюдатель+");
    expect(accessRole.permissions).toEqual(["profile.read", "tenant.users.read"]);
  });

  it("rejects renaming a role to an existing name (409 access_role_name_taken)", async () => {
    const c = client();
    await expect(c.updateAccessRole("role-observer", { name: "Менеджер", permissions: ["profile.read"] }))
      .rejects.toMatchObject({ status: 409, code: "access_role_name_taken" });
  });

  it("forbids updating the actor's own role (400 self_access_role_update_forbidden)", async () => {
    const c = client();
    await expect(c.updateAccessRole("role-administrator", { name: "Админ2", permissions: [...ALL_PERMISSIONS] }))
      .rejects.toMatchObject({ status: 400, code: "self_access_role_update_forbidden" });
  });

  it("rejects deleting a role that is assigned to users (409 access_role_assigned)", async () => {
    const c = client();
    await expect(c.deleteAccessRole("role-manager")).rejects.toMatchObject({ status: 409, code: "access_role_assigned" });
  });

  it("forbids deleting the actor's own role (400 self_access_role_delete_forbidden)", async () => {
    const c = client();
    await expect(c.deleteAccessRole("role-administrator")).rejects.toMatchObject({ status: 400, code: "self_access_role_delete_forbidden" });
  });

  it("deletes an unassigned role after detaching its users", async () => {
    const c = client();
    // role-observer назначена user-maria и user-oleg → сначала переназначим их, потом удалим роль.
    await c.updateUser("user-maria", { accessProfileId: "role-manager" });
    await c.updateUser("user-oleg", { accessProfileId: "role-manager", status: "inactive" });
    const del = await c.deleteAccessRole("role-observer");
    expect(del.status).toBe("deleted");
    const { accessRoles } = await c.listAccessRoles();
    expect(accessRoles.some((r) => r.id === "role-observer")).toBe(false);
  });

  it("returns 404 access_role_not_found for an unknown non-actor role on update", async () => {
    const c = client();
    await expect(c.updateAccessRole("role-ghost", { name: "Призрак", permissions: ["profile.read"] }))
      .rejects.toMatchObject({ status: 404, code: "access_role_not_found" });
  });

  /* ---- пользователи: CRUD ---- */
  it("creates a user with status active by default and joins positionName", async () => {
    const c = client();
    const { user } = await c.createUser(newUser({ positionId: "position-engineer" }));
    expect(user.status).toBe("active");
    expect(user.email).toBe("new.user@kiss-pm.dev");
    expect(user.positionName).toBe("Инженер");
    const { users } = await c.listUsers();
    expect(users.some((u) => u.id === user.id)).toBe(true);
  });

  it("rejects a duplicate user email on create (409 user_email_taken)", async () => {
    const c = client();
    await expect(c.createUser(newUser({ email: "ivan@kiss-pm.dev" }))).rejects.toMatchObject({ status: 409, code: "user_email_taken" });
  });

  it("rejects a duplicate user id on create (409 user_id_taken)", async () => {
    const c = client();
    await expect(c.createUser(newUser({ id: "user-ivan" }))).rejects.toMatchObject({ status: 409, code: "user_id_taken" });
  });

  it("rejects a too-short password on create (400 invalid_user_password)", async () => {
    const c = client();
    await expect(c.createUser(newUser({ password: "short" }))).rejects.toMatchObject({ status: 400, code: "invalid_user_password" });
  });

  it("rejects a user with an unknown access role on create (400 invalid_access_role)", async () => {
    const c = client();
    await expect(c.createUser(newUser({ accessProfileId: "role-ghost" }))).rejects.toMatchObject({ status: 400, code: "invalid_access_role" });
  });

  it("rejects a user with an unknown position on create (400 invalid_position)", async () => {
    const c = client();
    await expect(c.createUser(newUser({ positionId: "position-ghost" }))).rejects.toMatchObject({ status: 400, code: "invalid_position" });
  });

  it("rejects an invalid email on create (400 invalid_user_email)", async () => {
    const c = client();
    await expect(c.createUser(newUser({ email: "not-an-email" }))).rejects.toMatchObject({ status: 400, code: "invalid_user_email" });
  });

  it("updates a user (partial-merge keeps untouched fields)", async () => {
    const c = client();
    const { user } = await c.updateUser("user-maria", { name: "Мария Обновлённая" });
    expect(user.name).toBe("Мария Обновлённая");
    expect(user.email).toBe("maria@kiss-pm.dev"); // не тронут
    expect(user.accessProfileId).toBe("role-observer"); // не тронут
  });

  it("rejects updating a user to an existing email (409 user_email_taken)", async () => {
    const c = client();
    await expect(c.updateUser("user-maria", { email: "ivan@kiss-pm.dev" })).rejects.toMatchObject({ status: 409, code: "user_email_taken" });
  });

  it("rejects updating a user to an unknown access role (400 invalid_access_role)", async () => {
    const c = client();
    await expect(c.updateUser("user-maria", { accessProfileId: "role-ghost" })).rejects.toMatchObject({ status: 400, code: "invalid_access_role" });
  });

  it("deactivates a non-actor user via PATCH status inactive", async () => {
    const c = client();
    const { user } = await c.deactivateUser("user-ivan");
    expect(user.status).toBe("inactive");
    const { users } = await c.listUsers();
    expect(users.find((u) => u.id === "user-ivan")?.status).toBe("inactive");
  });

  it("forbids the actor deactivating themselves (400 self_access_change_forbidden)", async () => {
    const c = client();
    await expect(c.deactivateUser("user-anna")).rejects.toMatchObject({ status: 400, code: "self_access_change_forbidden" });
  });

  it("forbids the actor changing their own role (400 self_access_change_forbidden)", async () => {
    const c = client();
    await expect(c.updateUser("user-anna", { accessProfileId: "role-manager" })).rejects.toMatchObject({ status: 400, code: "self_access_change_forbidden" });
  });

  it("allows the actor to edit their own non-sensitive fields (name) without tripping self-guard", async () => {
    const c = client();
    const { user } = await c.updateUser("user-anna", { name: "Анна А." });
    expect(user.name).toBe("Анна А.");
    expect(user.status).toBe("active");
    expect(user.accessProfileId).toBe("role-administrator");
  });

  it("returns 404 user_not_found for an unknown user on update", async () => {
    const c = client();
    await expect(c.updateUser("user-ghost", { name: "Призрак" })).rejects.toMatchObject({ status: 404, code: "user_not_found" });
  });

  it("rejects malformed route ids before resolution (400 invalid_user_id)", async () => {
    const c = client();
    await expect(c.updateUser("Bad..Id", { name: "X" })).rejects.toMatchObject({ status: 400, code: "invalid_user_id" });
  });

  it("surfaces AdminApiError instances with status/code/body", async () => {
    const c = client();
    try {
      await c.createUser(newUser({ email: "ivan@kiss-pm.dev" }));
      throw new Error("expected rejection");
    } catch (e) {
      expect(e).toBeInstanceOf(AdminApiError);
      expect((e as AdminApiError).status).toBe(409);
      expect((e as AdminApiError).code).toBe("user_email_taken");
      expect((e as AdminApiError).body).toMatchObject({ error: "user_email_taken" });
    }
  });
});
