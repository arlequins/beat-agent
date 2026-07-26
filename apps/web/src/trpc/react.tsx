"use client";

import type { AppRouter } from "@arlequins/trpc/client";
import { TRPC_HTTP_PATH } from "@arlequins/trpc/client";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createTRPCClient,
  httpBatchStreamLink,
  loggerLink,
} from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useMemo } from "react";
import SuperJSON from "superjson";
import { useAuth } from "~/auth/provider";
import { env } from "~/env";
import { createQueryClient } from "./query-client";

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    return createQueryClient();
  }
  browserQueryClient ??= createQueryClient();
  return browserQueryClient;
}

export const { useTRPC, TRPCProvider } = createTRPCContext<AppRouter>();

/** Batch URL = validated `NEXT_PUBLIC_API_URL` base + `TRPC_HTTP_PATH`. */
function getTrpcBatchHttpUrl(): string {
  const base = env.NEXT_PUBLIC_API_URL.trim().replace(/\/+$/, "");
  return new URL(TRPC_HTTP_PATH, `${base}/`).href.replace(/\/$/, "");
}

function getNodeEnv(): string {
  return env.NODE_ENV;
}

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const { user } = useAuth();

  const trpcClient = useMemo(
    () =>
      createTRPCClient<AppRouter>({
        links: [
          loggerLink({
            enabled: (op) =>
              getNodeEnv() === "development" ||
              (op.direction === "down" && op.result instanceof Error),
          }),
          httpBatchStreamLink({
            transformer: SuperJSON,
            url: getTrpcBatchHttpUrl(),
            headers() {
              const headers = new Headers();
              if (user?.access_token && !user.expired) {
                headers.set("Authorization", `Bearer ${user.access_token}`);
              }
              return headers;
            },
          }),
        ],
      }),
    [user],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {props.children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
