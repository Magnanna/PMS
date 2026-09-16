ALTER TABLE "mpesa_credentials_per_org" ADD COLUMN "webhook_token" text NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider_request_ref" text;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_request_ref_uq" ON "payments" USING btree ("provider_request_ref");