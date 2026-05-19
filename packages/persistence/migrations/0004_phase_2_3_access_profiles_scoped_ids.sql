ALTER TABLE "access_profiles" DROP CONSTRAINT IF EXISTS "access_profiles_pkey";
--> statement-breakpoint
ALTER TABLE "access_profiles" ADD CONSTRAINT "access_profiles_pkey" PRIMARY KEY ("tenant_id","id");
