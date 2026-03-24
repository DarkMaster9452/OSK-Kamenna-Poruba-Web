const cloudinary = require('cloudinary').v2;
const env = require('../config/env');

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

const timelineCache = { expiresAt: 0, data: null };
const assetsCache = { expiresAt: 0, data: null };

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
    let search = cloudinary.search
      .expression(`asset_folder="${folderPath}" AND resource_type:image`)
      .sort_by('public_id', 'asc')
      .max_results(500);

    if (nextCursor) search = search.next_cursor(nextCursor);

    const result = await search.execute();
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
    const params = { max_results: 500 };
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
    const params = { max_results: 500 };
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
      // Fetch all subfolders in parallel for speed
      const subResults = await Promise.all(
        subFolders.map(async (sub) => {
          const images = await fetchImagesInFolder(sub.path);
          return { folder: sub.name, path: sub.path, images };
        })
      );

      for (const result of subResults) {
        if (result.images.length > 0) {
          blocks.push(result);
        }
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

  const now = Date.now();
  if (!forceRefresh && timelineCache.data && timelineCache.expiresAt > now) {
    return { ...timelineCache.data, cache: 'HIT' };
  }

  try {
    const folders = await collectAllFolderBlocks();

    const normalized = {
      source: 'cloudinary.timeline',
      fetchedAt: new Date().toISOString(),
      folders
    };

    const ttl = Math.max(0, env.cloudinaryCacheSeconds || 1800) * 1000;
    timelineCache.data = normalized;
    timelineCache.expiresAt = now + ttl;

    return { ...normalized, cache: 'MISS' };
  } catch (error) {
    if (timelineCache.data) {
      return { ...timelineCache.data, cache: 'STALE', warning: error?.message };
    }
    const err = new Error('Nepodarilo sa nacitat data z Cloudinary: ' + (error?.message || 'Neznama chyba'));
    err.status = 502;
    throw err;
  }
}

async function getRootAssets({ forceRefresh = false } = {}) {
  if (!isConfigured()) {
    return { ...makeUnconfiguredResponse('assets'), assets: [] };
  }

  const now = Date.now();
  if (!forceRefresh && assetsCache.data && assetsCache.expiresAt > now) {
    return { ...assetsCache.data, cache: 'HIT' };
  }

  try {
    // Fetch images from root asset folder of the main Cloudinary folder
    const rootFolders = await listAllRootFolders();
    const mainFolder = rootFolders.length > 0 ? rootFolders[0].path : '';

    let resources = [];
    if (mainFolder) {
      // Fetch images directly in the main folder (not in subfolders)
      let nextCursor = null;
      do {
        let search = cloudinary.search
          .expression(`asset_folder="${mainFolder}" AND resource_type:image`)
          .sort_by('public_id', 'asc')
          .max_results(500);
        if (nextCursor) search = search.next_cursor(nextCursor);
        const result = await search.execute();
        const batch = Array.isArray(result.resources) ? result.resources : [];
        resources.push(...batch);
        nextCursor = result.next_cursor || null;
      } while (nextCursor);
    }

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
    assetsCache.data = normalized;
    assetsCache.expiresAt = now + ttl;

    return { ...normalized, cache: 'MISS' };
  } catch (error) {
    if (assetsCache.data) {
      return { ...assetsCache.data, cache: 'STALE', warning: error?.message };
    }
    const err = new Error('Nepodarilo sa nacitat assety z Cloudinary: ' + (error?.message || 'Neznama chyba'));
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
    const rootResult = await cloudinary.api.root_folders({ max_results: 500 });
    const rootFolders = Array.isArray(rootResult.folders) ? rootResult.folders : [];
    debug.steps.push({
      step: 'root_folders',
      count: rootFolders.length,
      folders: rootFolders.map((f) => ({ name: f.name, path: f.path }))
    });

    for (const folder of rootFolders) {
      try {
        const subResult = await cloudinary.api.sub_folders(folder.path, { max_results: 500 });
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
          error: subErr?.message || String(subErr)
        });
      }
    }
  } catch (rootErr) {
    debug.steps.push({
      step: 'root_folders',
      error: rootErr?.message || String(rootErr)
    });
  }

  return debug;
}

module.exports = { getTimelineData, getRootAssets, isConfigured, debugCloudinaryFolders };
