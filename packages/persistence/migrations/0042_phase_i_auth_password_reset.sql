CREATE TABLE "password_reset_tokens" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "user_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "requested_ip" text,
  "created_at" timestamp with time zone NOT NULL,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY("tenant_id","id"),
  CONSTRAINT "password_reset_tokens_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."tenant_users"("tenant_id","id") ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_uidx" ON "password_reset_tokens" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens" USING btree ("tenant_id","user_id");
