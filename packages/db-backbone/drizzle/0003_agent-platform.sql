CREATE SCHEMA IF NOT EXISTS "agent";
--> statement-breakpoint
CREATE TABLE "agent"."workspace" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "slug" varchar(96) NOT NULL, "name" varchar(256) NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_slug_uidx" ON "agent"."workspace" USING btree ("slug");
--> statement-breakpoint
CREATE TABLE "agent"."workspace_member" ("workspace_id" uuid NOT NULL REFERENCES "agent"."workspace"("id") ON DELETE cascade, "user_id" uuid NOT NULL, "role" varchar(32) DEFAULT 'member' NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL, CONSTRAINT "workspace_member_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id"));
--> statement-breakpoint
CREATE INDEX "workspace_member_user_idx" ON "agent"."workspace_member" USING btree ("user_id");
--> statement-breakpoint
CREATE TABLE "agent"."conversation" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "workspace_id" uuid NOT NULL REFERENCES "agent"."workspace"("id") ON DELETE cascade, "created_by_user_id" uuid NOT NULL, "title" varchar(256) DEFAULT 'New conversation' NOT NULL, "summary" text, "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL, "archived_at" timestamp with time zone);
--> statement-breakpoint
CREATE INDEX "conversation_workspace_updated_idx" ON "agent"."conversation" USING btree ("workspace_id","updated_at");
--> statement-breakpoint
CREATE TABLE "agent"."message" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "conversation_id" uuid NOT NULL REFERENCES "agent"."conversation"("id") ON DELETE cascade, "role" varchar(16) NOT NULL, "content" text NOT NULL, "model" varchar(128), "created_at" timestamp with time zone DEFAULT now() NOT NULL);
--> statement-breakpoint
CREATE INDEX "message_conversation_created_idx" ON "agent"."message" USING btree ("conversation_id","created_at");
--> statement-breakpoint
CREATE TABLE "agent"."memory" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "workspace_id" uuid NOT NULL REFERENCES "agent"."workspace"("id") ON DELETE cascade, "source_conversation_id" uuid REFERENCES "agent"."conversation"("id") ON DELETE set null, "content" text NOT NULL, "importance" integer DEFAULT 50 NOT NULL, "status" varchar(24) DEFAULT 'candidate' NOT NULL, "expires_at" timestamp with time zone, "created_at" timestamp with time zone DEFAULT now() NOT NULL, "reviewed_at" timestamp with time zone);
--> statement-breakpoint
CREATE INDEX "memory_workspace_status_idx" ON "agent"."memory" USING btree ("workspace_id","status");
--> statement-breakpoint
CREATE TABLE "agent"."document" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "workspace_id" uuid NOT NULL REFERENCES "agent"."workspace"("id") ON DELETE cascade, "uploaded_by_user_id" uuid NOT NULL, "filename" varchar(512) NOT NULL, "content_type" varchar(256) NOT NULL, "source_uri" text NOT NULL, "content_hash" varchar(128) NOT NULL, "size_bytes" bigint NOT NULL, "status" varchar(24) DEFAULT 'pending' NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL, "deleted_at" timestamp with time zone);
--> statement-breakpoint
CREATE UNIQUE INDEX "document_workspace_hash_uidx" ON "agent"."document" USING btree ("workspace_id","content_hash");
--> statement-breakpoint
CREATE INDEX "document_workspace_status_idx" ON "agent"."document" USING btree ("workspace_id","status");
--> statement-breakpoint
CREATE TABLE "agent"."document_chunk" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "document_id" uuid NOT NULL REFERENCES "agent"."document"("id") ON DELETE cascade, "ordinal" integer NOT NULL, "content" text NOT NULL, "locator" varchar(256), "vector_record_id" varchar(256), "created_at" timestamp with time zone DEFAULT now() NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX "document_chunk_document_ordinal_uidx" ON "agent"."document_chunk" USING btree ("document_id","ordinal");
--> statement-breakpoint
CREATE INDEX "document_chunk_vector_record_idx" ON "agent"."document_chunk" USING btree ("vector_record_id");
--> statement-breakpoint
CREATE TABLE "agent"."message_citation" ("message_id" uuid NOT NULL REFERENCES "agent"."message"("id") ON DELETE cascade, "chunk_id" uuid NOT NULL REFERENCES "agent"."document_chunk"("id") ON DELETE restrict, "ordinal" integer NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL, CONSTRAINT "message_citation_message_id_chunk_id_pk" PRIMARY KEY("message_id","chunk_id"));
--> statement-breakpoint
CREATE TABLE "agent"."feedback" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "workspace_id" uuid NOT NULL REFERENCES "agent"."workspace"("id") ON DELETE cascade, "message_id" uuid NOT NULL REFERENCES "agent"."message"("id") ON DELETE cascade, "submitted_by_user_id" uuid NOT NULL, "kind" varchar(32) NOT NULL, "comment" text, "created_at" timestamp with time zone DEFAULT now() NOT NULL);
--> statement-breakpoint
CREATE INDEX "feedback_workspace_created_idx" ON "agent"."feedback" USING btree ("workspace_id","created_at");
--> statement-breakpoint
CREATE TABLE "agent"."investigation" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "feedback_id" uuid NOT NULL UNIQUE REFERENCES "agent"."feedback"("id") ON DELETE cascade, "status" varchar(24) DEFAULT 'queued' NOT NULL, "findings" jsonb, "resolution" text, "started_at" timestamp with time zone, "completed_at" timestamp with time zone, "created_at" timestamp with time zone DEFAULT now() NOT NULL);
--> statement-breakpoint
CREATE INDEX "investigation_status_created_idx" ON "agent"."investigation" USING btree ("status","created_at");
--> statement-breakpoint
CREATE TABLE "agent"."index_run" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "workspace_id" uuid NOT NULL REFERENCES "agent"."workspace"("id") ON DELETE cascade, "document_id" uuid REFERENCES "agent"."document"("id") ON DELETE set null, "status" varchar(24) DEFAULT 'queued' NOT NULL, "provider" varchar(64) DEFAULT 'local' NOT NULL, "error" text, "started_at" timestamp with time zone, "completed_at" timestamp with time zone, "created_at" timestamp with time zone DEFAULT now() NOT NULL);
--> statement-breakpoint
CREATE INDEX "index_run_workspace_status_idx" ON "agent"."index_run" USING btree ("workspace_id","status");
