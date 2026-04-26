// Stiahne skomprimovanu verziu kazdeho obrazka z Cloudinary a nahraje spat
// ako novy original (overwrite). Jedna sa o jednorazovu operaciu.
//
// Spustenie (z korena projektu):
//   node scripts/manual/compress_cloudinary.js
//
// Volitelne parametre cez env:
//   MAX_WIDTH=2000   – max sirka v px (default 2000, zachova pomer stran)
//   QUALITY=82       – kvalita JPEG/WebP 1-100 (default 82)
//   DRY_RUN=1        – iba vypise zoznam, nic nenahraje

require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') });

const cloudinary = require('cloudinary').v2;

const MAX_WIDTH = parseInt(process.env.MAX_WIDTH || '2000', 10);
const QUALITY   = parseInt(process.env.QUALITY   || '82',   10);
const DRY_RUN   = process.env.DRY_RUN === '1';

const BLACKLIST = new Set(['blog', 'sponzori']);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

function isAllowed(publicId) {
  return publicId.split('/').every(seg => !BLACKLIST.has(seg.toLowerCase()));
}

async function fetchAllImages() {
  const resources = [];
  let nextCursor = null;
  do {
    let q = cloudinary.search
      .expression('resource_type:image')
      .max_results(500);
    if (nextCursor) q = q.next_cursor(nextCursor);
    const result = await q.execute();
    resources.push(...(result.resources || []));
    nextCursor = result.next_cursor || null;
  } while (nextCursor);
  return resources;
}

function buildCompressedUrl(secureUrl) {
  return secureUrl.replace(
    '/image/upload/',
    `/image/upload/w_${MAX_WIDTH},c_limit,q_${QUALITY},f_auto/`
  );
}

async function downloadBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function reupload(resource, buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id:     resource.public_id,
        overwrite:     true,
        invalidate:    true,
        resource_type: 'image'
      },
      (err, result) => err ? reject(err) : resolve(result)
    );
    stream.end(buffer);
  });
}

function kb(bytes) {
  return Math.round(bytes / 1024) + ' KB';
}

async function main() {
  const images = await fetchAllImages();
  const allowed = images.filter(r => isAllowed(r.public_id));

  console.log(`Najdenych: ${images.length} obrazkov, spracujem: ${allowed.length}`);
  if (DRY_RUN) {
    allowed.forEach(r => console.log(' -', r.public_id, kb(r.bytes)));
    return;
  }

  let ok = 0, skip = 0, fail = 0;

  for (const resource of allowed) {
    const before = resource.bytes;
    try {
      const compressedUrl = buildCompressedUrl(resource.secure_url);
      const buffer        = await downloadBuffer(compressedUrl);
      const result        = await reupload(resource, buffer);
      const saved         = before - result.bytes;

      if (saved > 0) {
        console.log(`✓ ${resource.public_id}  ${kb(before)} → ${kb(result.bytes)}  (-${kb(saved)})`);
        ok++;
      } else {
        console.log(`= ${resource.public_id}  uz optimalizovany (${kb(before)}), preskakujem`);
        skip++;
      }
    } catch (err) {
      console.error(`✗ ${resource.public_id}: ${err.message}`);
      fail++;
    }
  }

  console.log(`\nHotovo: ${ok} skomprimovanych, ${skip} preskochenych, ${fail} chyb`);
}

main().catch(err => {
  console.error('Chyba:', err.message);
  process.exit(1);
});
