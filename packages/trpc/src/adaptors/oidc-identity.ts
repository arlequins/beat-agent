import { createHash } from "node:crypto";
import { AppRole, type AuthSession } from "@arlequins/auth";

function stableUuid(value: string) {
  const bytes = createHash("sha256").update(value).digest().subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16,
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Beat delegates authentication to its existing OIDC provider. The application
 * derives a non-reversible, issuer-scoped identifier and does not maintain a
 * second credential or refresh-token database.
 */
export function deriveBeatSession(
  session: AuthSession,
  administratorIdentities: ReadonlySet<string>,
): AuthSession {
  const identity = `${session.user.issuer}|${session.user.subject}`;
  return {
    ...session,
    user: {
      ...session.user,
      id: stableUuid(identity),
      roles: administratorIdentities.has(identity)
        ? [AppRole.MEMBER, AppRole.ADMIN]
        : [AppRole.MEMBER],
    },
  };
}
