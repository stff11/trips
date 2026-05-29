import { pgTable, serial, text, integer, real, timestamp } from 'drizzle-orm/pg-core';

export const trips = pgTable('trips', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  coverPhotoId: integer('cover_photo_id'),
  locationName: text('location_name'),
  centerLat: real('center_lat'),
  centerLng: real('center_lng'),
  photoCount: integer('photo_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const photos = pgTable('photos', {
  id: serial('id').primaryKey(),
  tripId: integer('trip_id')
    .references(() => trips.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  filePath: text('file_path').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(),
  fileHash: text('file_hash'),
  cloudinaryPublicId: text('cloudinary_public_id'),
  cloudinaryUrl: text('cloudinary_url'),
  width: integer('width'),
  height: integer('height'),
  lat: real('lat'),
  lng: real('lng'),
  altitude: real('altitude'),
  takenAt: timestamp('taken_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});