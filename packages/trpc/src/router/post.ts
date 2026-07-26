import { Permission } from "@arlequins/auth";
import {
  createPostInputSchema,
  listPostsInputSchema,
  updatePostInputSchema,
} from "@arlequins/validators";
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { permissionProcedure, publicProcedure } from "../trpc";

export const postRouter = {
  all: publicProcedure
    .input(listPostsInputSchema.optional())
    .query(({ ctx, input }) => ctx.services.content.listContent(input)),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => ctx.services.content.getContentById(input.id)),

  create: permissionProcedure(Permission.POST_WRITE)
    .input(createPostInputSchema)
    .mutation(({ ctx, input }) => ctx.services.content.createContent(input)),

  update: permissionProcedure(Permission.POST_WRITE)
    .input(updatePostInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.services.content.updateContent(input.id, input.data),
    ),

  delete: permissionProcedure(Permission.POST_WRITE)
    .input(z.string())
    .mutation(({ ctx, input }) => {
      return ctx.services.content.deleteContent(input);
    }),
} satisfies TRPCRouterRecord;
