CREATE TABLE "sample"."idempotency_record" (
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"fingerprint" varchar(128) NOT NULL,
	"key" varchar(256) NOT NULL,
	"result" jsonb,
	"scope" varchar(128) NOT NULL,
	CONSTRAINT "idempotency_record_scope_key_pk" PRIMARY KEY("scope","key")
);
--> statement-breakpoint
ALTER TABLE "sample"."post" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;