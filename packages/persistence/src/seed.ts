import { sql } from "drizzle-orm";

import type { AccessProfile, Permission } from "@kiss-pm/access-control";
import type { Tenant, TenantUser } from "@kiss-pm/domain";

import { hashPassword } from "./auth";
import type { KissPmDatabase } from "./connection";
import {
  accessProfiles,
  positions,
  tenantUsers,
  tenants,
  userCredentials
} from "./schema";

export type SeedAccessProfile = AccessProfile & {
  tenantId: string;
  name: string;
};

export type SeedPosition = {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
};

export type SeedTenantUser = TenantUser & {
  email: string;
  positionId?: string | null;
  phone?: string | null;
  telegram?: string | null;
  status?: string;
  theme?: string;
  accentColor?: string;
  password?: string;
};

export type SeedTenantDataset = {
  tenants: readonly Tenant[];
  accessProfiles: readonly SeedAccessProfile[];
  positions?: readonly SeedPosition[];
  users: readonly SeedTenantUser[];
};

export async function seedTenantDataset(
  db: KissPmDatabase,
  dataset: SeedTenantDataset,
  createdAt: Date = new Date()
): Promise<void> {
  await db.transaction(async (transaction) => {
    for (const tenant of dataset.tenants) {
      await transaction
        .insert(tenants)
        .values({
          id: tenant.id,
          name: tenant.name,
          createdAt
        })
        .onConflictDoUpdate({
          target: tenants.id,
          set: {
            name: sql`excluded.name`
          }
        });
    }

    for (const profile of dataset.accessProfiles) {
      await transaction
        .insert(accessProfiles)
        .values({
          id: profile.id,
          tenantId: profile.tenantId,
          name: profile.name,
          permissions: [...profile.permissions],
          createdAt
        })
        .onConflictDoUpdate({
          target: accessProfiles.id,
          set: {
            tenantId: sql`excluded.tenant_id`,
            name: sql`excluded.name`,
            permissions: sql`excluded.permissions`
          }
        });
    }

    for (const position of dataset.positions ?? []) {
      await transaction
        .insert(positions)
        .values({
          id: position.id,
          tenantId: position.tenantId,
          name: position.name,
          description: position.description ?? null,
          createdAt
        })
        .onConflictDoUpdate({
          target: positions.id,
          set: {
            tenantId: sql`excluded.tenant_id`,
            name: sql`excluded.name`,
            description: sql`excluded.description`
          }
        });
    }

    for (const user of dataset.users) {
      await transaction
        .insert(tenantUsers)
        .values({
          id: user.id,
          tenantId: user.tenantId,
          accessProfileId: user.accessProfileId,
          positionId: user.positionId ?? null,
          email: user.email,
          name: user.name,
          phone: user.phone ?? null,
          telegram: user.telegram ?? null,
          status: user.status ?? "active",
          theme: user.theme ?? "light",
          accentColor: user.accentColor ?? "#0f766e",
          createdAt
        })
        .onConflictDoUpdate({
          target: tenantUsers.id,
          set: {
            tenantId: sql`excluded.tenant_id`,
            accessProfileId: sql`excluded.access_profile_id`,
            positionId: sql`excluded.position_id`,
            email: sql`excluded.email`,
            name: sql`excluded.name`,
            phone: sql`excluded.phone`,
            telegram: sql`excluded.telegram`,
            status: sql`excluded.status`,
            theme: sql`excluded.theme`,
            accentColor: sql`excluded.accent_color`
          }
        });

      if (user.password) {
        const password = hashPassword(user.password);

        await transaction
          .insert(userCredentials)
          .values({
            userId: user.id,
            tenantId: user.tenantId,
            email: user.email,
            passwordHash: password.passwordHash,
            passwordSalt: password.passwordSalt,
            createdAt
          })
          .onConflictDoUpdate({
            target: userCredentials.userId,
            set: {
              tenantId: sql`excluded.tenant_id`,
              email: sql`excluded.email`,
              passwordHash: sql`excluded.password_hash`,
              passwordSalt: sql`excluded.password_salt`
            }
          });
      }
    }
  });
}

export function createTenantAdminSeedProfile(input: {
  id: string;
  tenantId: string;
  name?: string;
}): SeedAccessProfile {
  const adminPermissions = [
    "tenant.users.read",
    "tenant.users.manage",
    "tenant.access_profiles.read",
    "tenant.access_profiles.manage",
    "tenant.positions.read",
    "tenant.positions.manage",
    "tenant.audit_events.read",
    "profile.read",
    "profile.update",
    "workspace.theme.manage"
  ] satisfies Permission[];

  return {
    id: input.id,
    tenantId: input.tenantId,
    name: input.name ?? "Администратор",
    permissions: adminPermissions
  };
}
