/**
 * compress_cloudinary.js
 *
 * Stiahne každý obrázok z Cloudinary (max WIDTH px, kvalita QUALITY),
 * nahrá ho späť s overwrite:true a vypíše úsporu.
 *
 * Použitie:
 *   node scripts/manual/compress_cloudinary.js
 *   DRY_RUN=1 node scripts/manual/compress_cloudinary.js
 *   MAX_WIDTH=1600 QUALITY=75 node scripts/manual/compress_cloudinary.js
 *
 * Potrebuje backend/.env (alebo premenné prostredia):
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 */

'use strict';

const path = require('path');
const https = require('https');
const fs = require('fs');

// Načítaj .env z backend/
require('dotenv').config({ path: path.resolve(__dirname, '../../backend/.env') });

const cloudinary = require('cloudinary').v2;

const DRY_RUN   = process.env.DRY_RUN === '1';
const MAX_WIDTH  = parseInt(process.env.MAX_WIDTH  || '2000', 10);
const QUALITY    = parseInt(process.env.QUALITY    || '82',   10);

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.error('❌  Chýbajú env premenné: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
  console.error('   Skontroluj backend/.env');
  process.exit(1);
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key:    CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure:     true,
});

// --- helpers ----------------------------------------------------------------

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} pre ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end',  () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function uploadBuffer(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id:    publicId,
        overwrite:    true,
        invalidate:   true,
        resource_type:'image',
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

function buildCompressedUrl(publicId, format) {
  return cloudinary.url(publicId, {
    transformation: [
      { width: MAX_WIDTH, crop: 'limit' },
      { quality: QUALITY, fetch_format: format || 'auto' },
    ],
    secure: true,
  });
}

// --- core -------------------------------------------------------------------

async function fetchAllResources() {
  const resources = [];
  let nextCursor = undefined;

  do {
    const opts = { resource_type: 'image', max_results: 500 };
    if (nextCursor) opts.next_cursor = nextCursor;

    const result = await cloudinary.api.resources(opts);
    resources.push(...result.resources);
    nextCursor = result.next_cursor;
  } while (nextCursor);

  return resources;
}

const NON_IMAGE = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar', 'svg']);

async function run() {
  console.log(`\n🔧  compress_cloudinary.js  [DRY_RUN=${DRY_RUN}, MAX_WIDTH=${MAX_WIDTH}, QUALITY=${QUALITY}]\n`);

  const resources = await fetchAllResources();
  const images = resources.filter(r => !NON_IMAGE.has((r.format || '').toLowerCase()));

  console.log(`📦  Nájdených ${images.length} obrázkov\n`);

  let totalSavedBytes = 0;
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const res of images) {
    const { public_id, bytes: originalBytes, format, secure_url } = res;

    // Zostav URL so skomprimovanou verziou
    const compressedUrl = buildCompressedUrl(public_id, format);

    let compressedBuffer;
    try {
      compressedBuffer = await fetchBuffer(compressedUrl);
    } catch (err) {
      console.error(`  ❌  [${public_id}] Stiahnutie zlyhalo: ${err.message}`);
      errors++;
      continue;
    }

    const newBytes     = compressedBuffer.length;
    const savedBytes   = originalBytes - newBytes;
    const savedPercent = originalBytes > 0 ? ((savedBytes / originalBytes) * 100).toFixed(1) : '0.0';

    if (savedBytes <= 0) {
      console.log(`  ⏭   [${public_id}] Bez úspory (${(originalBytes / 1024).toFixed(1)} kB → ${(newBytes / 1024).toFixed(1)} kB)`);
      skipped++;
      continue;
    }

    console.log(`  ✅  [${public_id}] ${(originalBytes / 1024).toFixed(1)} kB → ${(newBytes / 1024).toFixed(1)} kB  (−${savedPercent}%)`);

    if (!DRY_RUN) {
      try {
        await uploadBuffer(compressedBuffer, public_id);
      } catch (err) {
        console.error(`  ❌  [${public_id}] Upload zlyhalo: ${err.message}`);
        errors++;
        continue;
      }
    }

    totalSavedBytes += savedBytes;
    processed++;
  }

  console.log('\n─────────────────────────────────────────');
  console.log(`  Spracovaných : ${processed}`);
  console.log(`  Preskočených : ${skipped}`);
  console.log(`  Chýb        : ${errors}`);
  console.log(`  Celková úspora: ${(totalSavedBytes / 1024 / 1024).toFixed(2)} MB${DRY_RUN ? ' (DRY RUN – nič nebolo uložené)' : ''}`);
  console.log('─────────────────────────────────────────\n');
}

run().catch((err) => {
  console.error('Fatálna chyba:', err);
  process.exit(1);
});
