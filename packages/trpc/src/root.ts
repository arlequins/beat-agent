import { agentRouter } from "./router/agent";
import { authRouter } from "./router/auth";
import { createTRPCRouter } from "./trpc";

export const AppRouter = createTRPCRouter({
  agent: agentRouter,
  auth: authRouter,
});

// export type definition of API
export type AppRouter = typeof AppRouter;
