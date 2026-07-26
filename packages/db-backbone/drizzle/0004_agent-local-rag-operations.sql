ALTER TABLE "agent"."document_chunk" ADD COLUMN IF NOT EXISTS "embedding" jsonb;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent"."audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "agent"."workspace"("id") ON DELETE cascade,
  "actor_user_id" uuid NOT NULL,
  "action" varchar(96) NOT NULL,
  "subject_id" uuid,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_workspace_created_idx" ON "agent"."audit_log" USING btree ("workspace_id", "created_at");
