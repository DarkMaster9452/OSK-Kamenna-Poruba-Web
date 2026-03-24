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
  const rootFolders = await listAllRootFolders();
  const blocks = [];

  for (const folder of rootFolders) {
    let subFolders = [];
    try {
      subFolders = await listAllSubFolders(folder.path);
    } catch (_) {
      subFolders = [];
    }

    if (subFolders.length > 0) {
      // Has subfolders: each subfolder is a timeline block
      for (const sub of subFolders) {
        const images = await fetchImagesInFolder(sub.path);
        if (images.length > 0) {
          blocks.push({ folder: sub.name, path: sub.path, images });
        }
      }

      // Root folder direct images (if any)
      const rootImages = await fetchImagesInFolder(folder.path);
      // Filter to only direct children of root folder (not already covered by subfolders)
      const directRootImages = rootImages.filter((img) => {
        const rel = img.publicId.slice(folder.path.length + 1);
        return !rel.includes('/');
      });
      if (directRootImages.length > 0) {
        blocks.push({ folder: folder.name, path: folder.path, images: directRootImages });
      }
    } else {
      // No subfolders: folder itself is a timeline block
      const images = await fetchImagesInFolder(folder.path);
      if (images.length > 0) {
        blocks.push({ folder: folder.name, path: folder.path, images });
      }
    }
  }

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
    const folders = await collectAllFolderBlocks();

    const normalized = {
      source: 'cloudinary.timeline',
      fetchedAt: new Date().toISOString(),
      folders
    };

    const ttl = Math.max(0, env.cloudinaryCacheSeconds || 1800) * 1000;
    await writeCache('cloudinary_timeline', normalized, ttl);

    return { ...normalized, cache: 'MISS' };
  } catch (error) {
    const errorMsg = error?.error?.message || error?.message || 'Neznama chyba';
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
    const result = await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'image',
      max_results: 500
    });

    const resources = Array.isArray(result.resources) ? result.resources : [];

    // Root-level assets: no '/' in public_id
    const assets = resources
      .filter((r) => !r.public_id.includes('/'))
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

module.exports = { getTimelineData, getRootAssets, isConfigured, debugCloudinaryFolders };
