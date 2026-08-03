import { AppRole } from "@arlequins/auth";
import { describe, expect, it } from "vitest";
import { deriveBeatSession } from "./oidc-identity";

const session = {
  claims: { sub: "same-subject" },
  user: {
    email: "arlequin@example.com",
    id: "same-subject",
    issuer: "https://beat.example.com",
    name: "Arlequin",
    roles: [],
    subject: "same-subject",
  },
};

describe("deriveBeatSession", () => {
  it("derives a stable UUID scoped by issuer and grants configured admin role", () => {
    const identity = "https://beat.example.com|same-subject";
    const first = deriveBeatSession(session, new Set([identity]));
    const second = deriveBeatSession(session, new Set([identity]));
    expect(first.user.id).toBe(second.user.id);
    expect(first.user.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(first.user.roles).toEqual([AppRole.MEMBER, AppRole.ADMIN]);
  });

  it("does not collide across issuers", () => {
    const other = deriveBeatSession(
      {
        ...session,
        user: { ...session.user, issuer: "https://other.example.com" },
      },
      new Set(),
    );
    expect(other.user.id).not.toBe(
      deriveBeatSession(session, new Set()).user.id,
    );
  });
});
