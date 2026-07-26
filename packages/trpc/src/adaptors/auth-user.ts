import type { UserProvisioningPort } from "@arlequins/auth";
import { AppRole } from "@arlequins/auth";
import type { Database } from "@arlequins/db-backbone/client";
import { AppUser, UserRole } from "@arlequins/db-backbone/schema";
import { eq } from "drizzle-orm";

const validRoles = new Set<string>(Object.values(AppRole));

export type UserProvisioningOptions = {
  bootstrapAdministrators?: ReadonlySet<string>;
};

export function createDatabaseUserProvisioning(
  database: Database,
  options: UserProvisioningOptions = {},
): UserProvisioningPort {
  return {
    async provision(input) {
      return database.transaction(async (tx) => {
        const [user] = await tx
          .insert(AppUser)
          .values({ ...input, lastLoginAt: new Date() })
          .onConflictDoUpdate({
            target: [AppUser.issuer, AppUser.subject],
            set: {
              name: input.name,
              email: input.email,
              lastLoginAt: new Date(),
              updatedAt: new Date(),
            },
          })
          .returning();
        if (!user) throw new Error("OIDC user provisioning returned no user");

        const roles: AppRole[] = [AppRole.MEMBER];
        if (
          options.bootstrapAdministrators?.has(
            `${input.issuer}|${input.subject}`,
          )
        )
          roles.push(AppRole.ADMIN);
        await tx
          .insert(UserRole)
          .values(roles.map((role) => ({ role, userId: user.id })))
          .onConflictDoNothing();
        const rows = await tx
          .select({ role: UserRole.role })
          .from(UserRole)
          .where(eq(UserRole.userId, user.id));
        return {
          ...user,
          roles: rows
            .map(({ role }) => role)
            .filter((role): role is AppRole => validRoles.has(role)),
        };
      });
    },
  };
}
