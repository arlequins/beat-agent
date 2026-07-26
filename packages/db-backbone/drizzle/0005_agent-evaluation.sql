CREATE TABLE "agent"."evaluation_case" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "agent"."workspace"("id") ON DELETE cascade,
  "question" text NOT NULL,
  "expected_chunk_ids" jsonb NOT NULL,
  "status" varchar(24) DEFAULT 'approved' NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "evaluation_case_workspace_status_idx" ON "agent"."evaluation_case" USING btree ("workspace_id", "status");
--> statement-breakpoint
CREATE TABLE "agent"."evaluation_run" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "agent"."workspace"("id") ON DELETE cascade,
  "trigger" varchar(32) NOT NULL,
  "status" varchar(24) DEFAULT 'queued' NOT NULL,
  "summary" jsonb,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "evaluation_run_workspace_created_idx" ON "agent"."evaluation_run" USING btree ("workspace_id", "created_at");
--> statement-breakpoint
CREATE TABLE "agent"."evaluation_result" (
  "evaluation_run_id" uuid NOT NULL REFERENCES "agent"."evaluation_run"("id") ON DELETE cascade,
  "evaluation_case_id" uuid NOT NULL REFERENCES "agent"."evaluation_case"("id") ON DELETE cascade,
  "citation_recall" real NOT NULL,
  "retrieved_chunk_ids" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "evaluation_result_evaluation_run_id_evaluation_case_id_pk" PRIMARY KEY("evaluation_run_id","evaluation_case_id")
);
