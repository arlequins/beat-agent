import { Permission } from "@arlequins/auth";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { permissionProcedure } from "../trpc";

export const fileRouter = {
  createUpload: permissionProcedure(Permission.POST_WRITE)
    .input(
      z.object({
        contentType: z.string().min(1).max(128),
        fileName: z.string().min(1).max(255),
        size: z.number().int().positive(),
      }),
    )
    .mutation(({ ctx, input }) => {
      if (!ctx.services.fileUpload)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "File uploads are not configured",
        });
      return ctx.services.fileUpload.requestUpload(input);
    }),
} satisfies TRPCRouterRecord;
