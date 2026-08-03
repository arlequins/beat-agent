import type { AppRole } from "../../domain/authorization";

export type ProvisionedUser = {
  id: string;
  issuer: string;
  subject: string;
  name: string | null;
  email: string | null;
  roles: AppRole[];
};

export type UserProvisioningPort = {
  provision(input: {
    issuer: string;
    subject: string;
    name: string | null;
    email: string | null;
  }): Promise<ProvisionedUser>;
};
