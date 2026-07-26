/**
 * Minimal SST/Pulumi declarations for a fresh clone. `pnpm sst:install` supplies
 * the complete declarations before an actual deployment.
 */
declare const $app: { name: string; stage: string };

declare const $config: (config: {
  app: (input?: { stage?: string }) =>
    | {
        name: string;
        removal: string;
        protect: boolean;
        home: string;
        providers?: { aws?: { profile?: string; region?: string } };
      }
    | Promise<{
        name: string;
        removal: string;
        protect: boolean;
        home: string;
        providers?: { aws?: { profile?: string; region?: string } };
      }>;
  run: () => Record<string, unknown> | Promise<Record<string, unknown>>;
}) => unknown;

declare const aws: {
  rds: {
    SubnetGroup: new (
      name: string,
      args: Record<string, unknown>,
    ) => { name: string };
    Cluster: new (
      name: string,
      args: Record<string, unknown>,
    ) => {
      endpoint: string;
      engine: string;
      id: string;
      port: string;
    };
    ClusterInstance: new (
      name: string,
      args: Record<string, unknown>,
    ) => unknown;
  };
};
