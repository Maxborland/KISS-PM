ALTER TABLE "opportunities" DROP CONSTRAINT IF EXISTS "opportunities_primary_contact_fk";
--> statement-breakpoint
ALTER TABLE "opportunities" DROP CONSTRAINT IF EXISTS "opportunities_primary_contact_client_fk";
--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_primary_contact_client_fk" FOREIGN KEY ("tenant_id","client_id","primary_contact_id") REFERENCES "public"."contacts"("tenant_id","client_id","id") ON DELETE restrict;
