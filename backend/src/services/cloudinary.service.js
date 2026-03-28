const cloudinary = require('cloudinary').v2;
const env = require('../config/env');
const { readCache, writeCache } = require('./cache');

let configured = false;

function ensureConfigured() {
  if (configured) return;
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    return;
  }
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true
  });
  configured = true;
}

function isConfigured() {
  ensureConfigured();
  return configured;
}


function makeUnconfiguredResponse(resource) {
  return {
    source: `cloudinary.${resource}.unconfigured`,
    fetchedAt: new Date().toISOString(),
    cache: 'BYPASS',
    message: 'Cloudinary nie je nakonfigurovany. Nastav CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.'
  };
}

async function fetchImagesInFolder(folderPath) {
  const images = [];
  let nextCursor = null;

  do {
    const params = {
      type: 'upload',
      prefix: folderPath + '/',
      max_results: 500,
      resource_type: 'image'
    };
    if (nextCursor) params.next_cursor = nextCursor;

    const result = await cloudinary.api.resources(params);
    const resources = Array.isArray(result.resources) ? result.resources : [];

    for (const r of resources) {
      images.push({
        url: r.secure_url,
        publicId: r.public_id,
        format: r.format || ''
      });
    }

    nextCursor = result.next_cursor || null;
  } while (nextCursor);

  return images;
}

async function listAllRootFolders() {
  const folders = [];
  let nextCursor = null;

  do {
    const params = {};
    if (nextCursor) params.next_cursor = nextCursor;
    const result = await cloudinary.api.root_folders(params);
    const batch = Array.isArray(result.folders) ? result.folders : [];
    folders.push(...batch);
    nextCursor = result.next_cursor || null;
  } while (nextCursor);

  return folders;
}

async function listAllSubFolders(folderPath) {
  const folders = [];
  let nextCursor = null;

  do {
    const params = {};
    if (nextCursor) params.next_cursor = nextCursor;
    const result = await cloudinary.api.sub_folders(folderPath, params);
    const batch = Array.isArray(result.folders) ? result.folders : [];
    folders.push(...batch);
    nextCursor = result.next_cursor || null;
  } while (nextCursor);

  return folders;
}

async function collectAllFolderBlocks() {
  console.log(`[Cloudinary] Starting folder scan...`);

  // Determine root folder — env var avoids root_folders() Admin API call
  const rootFolder = env.cloudinaryRootFolder;
  let subs = [];

  if (rootFolder) {
    // 1 Admin API call: sub_folders of known root
    subs = await listAllSubFolders(rootFolder);
  } else {
    // 2 Admin API calls: root_folders + sub_folders
    const roots = await listAllRootFolders();
    for (const root of roots) {
      const rootSubs = await listAllSubFolders(root.path);
      subs.push(...rootSubs);
    }
  }

  if (subs.length === 0) {
    console.warn(`[Cloudinary] No subfolders found.`);
    return [];
  }

  console.log(`[Cloudinary] Found ${subs.length} subfolders. Fetching images in parallel via Admin API...`);

  // Parallel api.resources() calls — one per subfolder
  // Parallel avoids Vercel timeout; 24h cache means ≤19 Admin API calls/day total
  async function fetchSubfolderImages(sub) {
    const images = [];
    let nextCursor = null;
    do {
      const params = {
        type: 'upload',
        prefix: sub.path + '/',
        max_results: 500,
        resource_type: 'image'
      };
      if (nextCursor) params.next_cursor = nextCursor;
      const result = await cloudinary.api.resources(params);
      for (const r of (result.resources || [])) {
        images.push({ url: r.secure_url, publicId: r.public_id, format: r.format || '' });
      }
      nextCursor = result.next_cursor || null;
    } while (nextCursor);
    return { folder: sub.name, path: sub.path, images };
  }

  const results = await Promise.all(subs.map(fetchSubfolderImages));
  const blocks = results.filter((r) => r.images.length > 0);

  console.log(`[Cloudinary] Scan complete. Found ${blocks.length} blocks.`);
  return blocks;
}

async function getTimelineData({ forceRefresh = false } = {}) {
  if (!isConfigured()) {
    return { ...makeUnconfiguredResponse('timeline'), folders: [] };
  }

  if (!forceRefresh) {
    const cached = await readCache('cloudinary_timeline');
    if (cached) {
      return { ...cached, cache: 'HIT' };
    }
  }

  try {
    console.log(`[Cloudinary] Refreshing timeline data from API...`);
    const folders = await collectAllFolderBlocks();
    console.log(`[Cloudinary] Found ${folders.length} total image blocks/folders`);

    const normalized = {
      source: 'cloudinary.timeline',
      fetchedAt: new Date().toISOString(),
      folders
    };

    if (folders.length > 0) {
      const ttl = Math.max(0, env.cloudinaryCacheSeconds || 1800) * 1000;
      await writeCache('cloudinary_timeline', normalized, ttl);
      console.log(`[Cloudinary] Timeline data written to cache (TTL: ${ttl / 1000}s)`);
    } else {
      console.warn(`[Cloudinary] No folders found. Not caching empty result to allow retry.`);
    }

    return { ...normalized, cache: 'MISS' };
  } catch (error) {
    const errorMsg = error?.error?.message || error?.message || 'Neznama chyba';
    console.error(`[Cloudinary] Failed to fetch timeline data: ${errorMsg}`);
    const staleObj = await readCache('cloudinary_timeline');
    if (staleObj) {
      return { ...staleObj, cache: 'STALE', warning: errorMsg };
    }
    const err = new Error('Nepodarilo sa nacitat data z Cloudinary: ' + errorMsg);
    err.status = 502;
    throw err;
  }
}

async function getRootAssets({ forceRefresh = false } = {}) {
  if (!isConfigured()) {
    return { ...makeUnconfiguredResponse('assets'), assets: [] };
  }

  if (!forceRefresh) {
    const cached = await readCache('cloudinary_assets');
    if (cached) {
      return { ...cached, cache: 'HIT' };
    }
  }

  try {
    // Use Search API to find images regardless of folder depth
    const result = await cloudinary.search
      .expression('resource_type:image')
      .max_results(500)
      .execute();

    const resources = Array.isArray(result.resources) ? result.resources : [];

    // All assets returned - map will handle basename matching
    const assets = resources
      .map((r) => ({
        url: r.secure_url,
        publicId: r.public_id,
        format: r.format || '',
        filename: r.public_id + (r.format ? '.' + r.format : '')
      }));

    const normalized = {
      source: 'cloudinary.assets',
      fetchedAt: new Date().toISOString(),
      cloudName: env.cloudinaryCloudName,
      assets
    };

    const ttl = Math.max(0, env.cloudinaryCacheSeconds || 1800) * 1000;
    await writeCache('cloudinary_assets', normalized, ttl);

    return { ...normalized, cache: 'MISS' };
  } catch (error) {
    const errorMsg = error?.error?.message || error?.message || 'Neznama chyba';
    const staleObj = await readCache('cloudinary_assets');
    if (staleObj) {
      return { ...staleObj, cache: 'STALE', warning: errorMsg };
    }
    const err = new Error('Nepodarilo sa nacitat assety z Cloudinary: ' + errorMsg);
    err.status = 502;
    throw err;
  }
}

async function debugCloudinaryFolders() {
  if (!isConfigured()) {
    return { configured: false, message: 'Cloudinary nie je nakonfigurovany.' };
  }

  const debug = { configured: true, cloudName: env.cloudinaryCloudName, steps: [] };

  try {
    const rootResult = await cloudinary.api.root_folders();
    const rootFolders = Array.isArray(rootResult.folders) ? rootResult.folders : [];
    debug.steps.push({
      step: 'root_folders',
      count: rootFolders.length,
      folders: rootFolders.map((f) => ({ name: f.name, path: f.path }))
    });

    for (const folder of rootFolders) {
      try {
        const subResult = await cloudinary.api.sub_folders(folder.path);
        const subs = Array.isArray(subResult.folders) ? subResult.folders : [];
        debug.steps.push({
          step: 'sub_folders',
          parent: folder.path,
          count: subs.length,
          folders: subs.map((f) => ({ name: f.name, path: f.path }))
        });
      } catch (subErr) {
        debug.steps.push({
          step: 'sub_folders',
          parent: folder.path,
          error: subErr?.error?.message || subErr?.message || JSON.stringify(subErr)
        });
      }
    }
  } catch (rootErr) {
    debug.steps.push({
      step: 'root_folders',
      error: rootErr?.error?.message || rootErr?.message || JSON.stringify(rootErr)
    });
  }

  return debug;
}

async function uploadImageToStream(fileBuffer, folder = 'blog') {
  ensureConfigured();
  if (!configured) {
    throw new Error('Cloudinary nie je nakonfigurovaný.');
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `${env.cloudinaryRootFolder}/${folder}`,
        resource_type: 'image'
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
}

module.exports = {
  getTimelineData,
  getRootAssets,
  isConfigured,
  debugCloudinaryFolders,
  uploadImageToStream
};
