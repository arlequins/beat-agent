import { agentRouter } from "./router/agent";
import { authRouter } from "./router/auth";
import { fileRouter } from "./router/file";
import { postRouter } from "./router/post";
import { createTRPCRouter } from "./trpc";

export const AppRouter = createTRPCRouter({
  agent: agentRouter,
  auth: authRouter,
  file: fileRouter,
  post: postRouter,
});

// export type definition of API
export type AppRouter = typeof AppRouter;
