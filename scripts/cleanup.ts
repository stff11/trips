import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';
import { db } from '../src/db';
import { photos } from '../src/db/schema';
import { eq } from 'drizzle-orm';

// Setup Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

async function reconcile() {
  console.log("Starting cleanup...");
  
  // 1. Get all public_ids from Cloudinary
  const { resources } = await cloudinary.api.resources({
    type: 'upload',
    prefix: 'wanderlens/',
    max_results: 500, // Adjust as needed
  });

  for (const resource of resources) {
    const publicId = resource.public_id;

    // 2. Check if this ID exists in your NeonDB
    const record = await db.select().from(photos).where(eq(photos.cloudinaryPublicId, publicId));

    if (record.length === 0) {
      console.log(`Deleting orphan from Cloudinary: ${publicId}`);
      // 3. Delete from Cloudinary
      // await cloudinary.uploader.destroy(publicId);
    } 
  }
  console.log("Cleanup complete.");
}

reconcile().catch(console.error);