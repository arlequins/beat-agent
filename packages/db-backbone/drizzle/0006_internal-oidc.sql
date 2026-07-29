CREATE TABLE "auth"."local_identity" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."local_identity" ADD CONSTRAINT "local_identity_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."app_user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "local_identity_email_uidx" ON "auth"."local_identity" USING btree ("email");
--> statement-breakpoint
CREATE TABLE "auth"."authorization_code" (
	"code_hash" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"code_challenge" text NOT NULL,
	"nonce" text,
	"scope" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."authorization_code" ADD CONSTRAINT "authorization_code_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."app_user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "authorization_code_expires_at_idx" ON "auth"."authorization_code" USING btree ("expires_at");
--> statement-breakpoint
CREATE TABLE "auth"."refresh_token" (
	"token_hash" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"scope" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."refresh_token" ADD CONSTRAINT "refresh_token_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."app_user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "refresh_token_expires_at_idx" ON "auth"."refresh_token" USING btree ("expires_at");
