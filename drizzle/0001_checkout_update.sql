ALTER TYPE "public"."provider_operation" ADD VALUE 'change_of_agent' BEFORE 'formation';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "intake_draft" jsonb;