ALTER TABLE "photos" ALTER COLUMN "cloudinary_public_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ALTER COLUMN "cloudinary_url" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" DROP COLUMN IF EXISTS "file_path";