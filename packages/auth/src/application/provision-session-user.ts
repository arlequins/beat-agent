import type { AuthSession } from "../domain/session";
import type { UserProvisioningPort } from "./ports/user-provisioning";

export async function provisionSessionUser(
  port: UserProvisioningPort,
  session: AuthSession,
): Promise<AuthSession> {
  const user = await port.provision({
    issuer: session.user.issuer,
    subject: session.user.subject,
    name: session.user.name,
    email: session.user.email,
  });
  return { ...session, user };
}
