export const AppRole = {
  ADMIN: "admin",
  MEMBER: "member",
  VIEWER: "viewer",
} as const;
export type AppRole = (typeof AppRole)[keyof typeof AppRole];

export const Permission = {
  POST_READ: "post:read",
  POST_WRITE: "post:write",
  USER_ADMIN: "user:admin",
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

const permissionsByRole: Record<AppRole, ReadonlySet<Permission>> = {
  [AppRole.ADMIN]: new Set(Object.values(Permission)),
  [AppRole.MEMBER]: new Set([Permission.POST_READ, Permission.POST_WRITE]),
  [AppRole.VIEWER]: new Set([Permission.POST_READ]),
};

export function hasPermission(
  roles: readonly AppRole[],
  permission: Permission,
): boolean {
  return roles.some((role) => permissionsByRole[role].has(permission));
}
