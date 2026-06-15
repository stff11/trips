import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { v2 as cloudinary } from 'cloudinary';
import exifr from 'exifr';
import { eq, asc } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { photos, trips } from '../../src/db/schema';
import crypto from 'crypto';

// Self-contained DB connection using HTTP transport — no ws, no Pool,
// no shared src/db/index.ts (which imports ws and crashes on Lambda load).
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Constants ───────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/tiff',
]);

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const MAX_DISTANCE_KM = 100;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function json(statusCode: number, body: object): HandlerResponse {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function toDecimal(val: unknown): number | null {
  if (typeof val === 'number' && isFinite(val)) return val;
  if (Array.isArray(val) && val.length >= 3) {
    const r = Number(val[0]) + Number(val[1]) / 60 + Number(val[2]) / 3600;
    return isFinite(r) ? r : null;
  }
  return null;
}

async function getLocationName(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en-GB`,
      { headers: { 'User-Agent': 'WanderlensJournal/1.0' } },
    );
    const data = await res.json();
    const addr = data?.address;
    if (!addr) return 'Unknown Location';
    const place = addr.city ?? addr.town ?? addr.village ?? addr.state;
    return place ? `${place}, ${addr.country ?? ''}` : (addr.country ?? 'Unknown Location');
  } catch {
    return 'Unknown Location';
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Multipart parser ─────────────────────────────────────────────────────────

interface ParsedMultipart {
  fields: Record<string, string>;
  file: { buffer: Buffer; filename: string; mimeType: string } | null;
}

function parseMultipart(rawBody: Buffer, contentType: string): ParsedMultipart {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/i);
  if (!boundaryMatch) throw new Error(`No boundary in Content-Type: "${contentType}"`);

  const boundary = Buffer.from(`--${boundaryMatch[1] ?? boundaryMatch[2]}`);
  const CRLFCRLF = Buffer.from('\r\n\r\n');
  const result: ParsedMultipart = { fields: {}, file: null };

  let pos = 0;
  while (pos < rawBody.length) {
    const boundaryPos = rawBody.indexOf(boundary, pos);
    if (boundaryPos === -1) break;
    pos = boundaryPos + boundary.length;

    if (rawBody[pos] === 0x2d && rawBody[pos + 1] === 0x2d) break; // terminal --

    if (rawBody[pos] === 0x0d && rawBody[pos + 1] === 0x0a) pos += 2; // skip \r\n

    const headersEnd = rawBody.indexOf(CRLFCRLF, pos);
    if (headersEnd === -1) break;

    const headersRaw = rawBody.slice(pos, headersEnd).toString('utf8');
    pos = headersEnd + 4;

    const nextBoundary = rawBody.indexOf(boundary, pos);
    if (nextBoundary === -1) break;

    const content = rawBody.slice(pos, nextBoundary - 2); // -2 strips trailing \r\n
    pos = nextBoundary;

    const headers: Record<string, string> = {};
    for (const line of headersRaw.split('\r\n')) {
      const colon = line.indexOf(':');
      if (colon === -1) continue;
      headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
    }

    const disposition = headers['content-disposition'] ?? '';
    const nameMatch = disposition.match(/\bname="([^"]+)"/);
    const filenameMatch = disposition.match(/\bfilename="([^"]+)"/);

    if (filenameMatch) {
      result.file = { buffer: content, filename: filenameMatch[1], mimeType: headers['content-type'] ?? 'application/octet-stream' };
    } else if (nameMatch) {
      result.fields[nameMatch[1]] = content.toString('utf8');
    }
  }

  return result;
}

// ─── Core processing ──────────────────────────────────────────────────────────

async function processUpload(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  requestedTripId: number | null,
): Promise<HandlerResponse> {
  const normalisedMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
  if (!ALLOWED_MIME_TYPES.has(normalisedMime)) {
    return json(400, { error: `Unsupported file type: ${mimeType}` });
  }

  // 1. Deduplicate
  const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
  const existing = await db.select({ id: photos.id }).from(photos).where(eq(photos.fileHash, fileHash));
  if (existing.length > 0) return json(200, { success: true, skipped: 'duplicate' });

  // 2. Parse EXIF
  const metadata = await exifr
    .parse(fileBuffer, { tiff: true, xmp: true, iptc: true, reviveValues: true })
    .catch(() => null) ?? {};

  let lat = toDecimal(metadata.GPSLatitude);
  let lng = toDecimal(metadata.GPSLongitude);
  if (lat !== null && metadata.GPSLatitudeRef === 'S') lat *= -1;
  if (lng !== null && metadata.GPSLongitudeRef === 'W') lng *= -1;

  const rawDate = metadata.DateTimeOriginal ?? metadata.CreateDate ?? metadata.DateTime ?? null;
  const takenAt: Date | null = rawDate instanceof Date ? rawDate : rawDate ? new Date(rawDate) : null;

  console.log(`[process-uploads] EXIF lat=${lat} lng=${lng} takenAt=${takenAt?.toISOString() ?? 'null'}`);

  // 3. Match or create trip
  let targetTripId: number | null = requestedTripId;

  if (!targetTripId) {
    if (lat === null || lng === null || takenAt === null) {
      console.log('[process-uploads] missing coords or date — will create new trip');
    } else {
      const existingTrips = await db.select().from(trips).orderBy(asc(trips.startDate));
      let bestTrip: typeof existingTrips[number] | null = null;
      let bestScore = Infinity;

      for (const trip of existingTrips) {
        if (trip.centerLat === null || trip.centerLng === null) continue;

        const distKm = haversineKm(lat, lng, trip.centerLat, trip.centerLng);
        if (distKm > MAX_DISTANCE_KM) continue;

        // Hard year guard — a 1-year difference is never the same trip
        if (takenAt.getFullYear() !== new Date(trip.startDate).getFullYear()) continue;

        const tripStart = new Date(trip.startDate);
        const tripEnd = new Date(trip.endDate);
        const inWindow =
          takenAt.getTime() >= tripStart.getTime() - FIVE_DAYS_MS &&
          takenAt.getTime() <= tripEnd.getTime() + FIVE_DAYS_MS;
        if (!inWindow) continue;

        const daysFromEdge = Math.min(
          Math.abs(takenAt.getTime() - tripStart.getTime()),
          Math.abs(takenAt.getTime() - tripEnd.getTime()),
        ) / 86_400_000;

        const score = distKm * 100 + daysFromEdge;
        console.log(`[process-uploads] candidate trip=${trip.id} name="${trip.name}" dist=${distKm.toFixed(1)}km days=${daysFromEdge.toFixed(1)} score=${score.toFixed(0)}`);

        if (score < bestScore) { bestScore = score; bestTrip = trip; }
      }

      if (bestTrip) {
        targetTripId = bestTrip.id;
        const tripStart = new Date(bestTrip.startDate);
        const tripEnd = new Date(bestTrip.endDate);
        await db.update(trips).set({
          startDate: takenAt < tripStart ? takenAt : tripStart,
          endDate: takenAt > tripEnd ? takenAt : tripEnd,
          photoCount: (bestTrip.photoCount ?? 0) + 1,
          updatedAt: new Date(),
        }).where(eq(trips.id, bestTrip.id));
        console.log(`[process-uploads] matched trip=${bestTrip.id} "${bestTrip.name}"`);
      }
    }
  }

  if (!targetTripId) {
    await sleep(1100);
    const locationName = lat !== null && lng !== null ? await getLocationName(lat, lng) : 'Unknown Location';
    // Use EXIF date for the trip's date range if available; fall back to now()
    // only for the name label and startDate/endDate of a brand-new trip.
    // This fallback never touches existing trips so it can't corrupt their range.
    const tripDate = takenAt ?? new Date();
    const label = tripDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const [newTrip] = await db.insert(trips).values({
      name: `${locationName} (${label})`,
      startDate: tripDate,
      endDate: tripDate,
      locationName,
      centerLat: lat,
      centerLng: lng,
      photoCount: 1,
    }).returning({ id: trips.id });
    targetTripId = newTrip.id;
    console.log(`[process-uploads] created new trip=${targetTripId} "${locationName} (${label})"`);
  }

  // 4. Upload to Cloudinary
  const cloudinaryResult = await new Promise<any>((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder: 'wanderlens' },
      (error, result) => error ? reject(error) : resolve(result),
    ).end(fileBuffer);
  });

  // 5. Insert photo row — takenAt stored as null when EXIF date is absent.
  // We never fabricate a date so the trip's startDate/endDate stays accurate.
  const [newPhoto] = await db.insert(photos).values({
    tripId: targetTripId,
    fileHash,
    filename: fileName,
    originalName: fileName,
    cloudinaryUrl: cloudinaryResult.secure_url,
    cloudinaryPublicId: cloudinaryResult.public_id,
    mimeType: normalisedMime,
    lat,
    lng,
    takenAt,  // null when no EXIF — intentional
  }).returning({ id: photos.id });

  // 6. Set cover if trip has none
  if (newPhoto) {
    const [trip] = await db.select().from(trips).where(eq(trips.id, targetTripId!));
    if (trip && !trip.coverPhotoId) {
      await db.update(trips).set({ coverPhotoId: newPhoto.id, updatedAt: new Date() }).where(eq(trips.id, targetTripId!));
    }
  }

  return json(200, { success: true });
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  try {
    if (!event.body) return json(400, { error: 'Empty request body' });

    const contentType = event.headers['content-type'] ?? event.headers['Content-Type'] ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return json(400, { error: `Expected multipart/form-data, got: "${contentType}"` });
    }

    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body, 'latin1');

    console.log(`[process-uploads] received body=${rawBody.length}b base64=${event.isBase64Encoded}`);

    const parsed = parseMultipart(rawBody, contentType);
    console.log(`[process-uploads] parsed file="${parsed.file?.filename ?? 'NONE'}" mime="${parsed.file?.mimeType ?? '-'}" fields=${JSON.stringify(parsed.fields)}`);

    if (!parsed.file) return json(400, { error: 'No file part found in multipart body' });

    const requestedTripId = parsed.fields['tripId'] ? (Number(parsed.fields['tripId']) || null) : null;

    return await processUpload(parsed.file.buffer, parsed.file.filename, parsed.file.mimeType, requestedTripId);

  } catch (e) {
    console.error('[process-uploads] fatal:', e);
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
};
