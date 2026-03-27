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

async function fetchImagesByAssetFolder(folderPath) {
  const images = [];
  let nextCursor = null;

  do {
    const params = { max_results: 500, resource_type: 'image' };
    if (nextCursor) params.next_cursor = nextCursor;

    const result = await cloudinary.api.resources_by_asset_folder(folderPath, params);
    const resources = Array.isArray(result.resources) ? result.resources : [];
    for (const r of resources) {
      images.push({ url: r.secure_url, publicId: r.public_id, format: r.format || '' });
    }
    nextCursor = result.next_cursor || null;
  } while (nextCursor);

  return images;
}

async function collectAllFolderBlocks() {
  const rootFolderOverride = env.cloudinaryRootFolder;

  if (rootFolderOverride) {
    // 1 Admin call to get subfolder list
    const subs = await listAllSubFolders(rootFolderOverride);
    if (subs.length === 0) return [];

    // 1 Search API call for ALL subfolders at once — much faster, separate quota
    const expression = subs.map((s) => `asset_folder="${s.path}"`).join(' OR ');
    const grouped = {};
    let nextCursor = null;

    do {
      let search = cloudinary.search
        .expression(`(${expression}) AND resource_type:image`)
        .sort_by('public_id', 'asc')
        .with_field('asset_folder')
        .max_results(500);
      if (nextCursor) search = search.next_cursor(nextCursor);

      const result = await search.execute();
      const resources = Array.isArray(result.resources) ? result.resources : [];

      for (const r of resources) {
        const folder = r.asset_folder || '';
        const subName = folder.startsWith(rootFolderOverride + '/')
          ? folder.slice(rootFolderOverride.length + 1)
          : folder;
        if (!subName) continue;
        if (!grouped[subName]) grouped[subName] = [];
        grouped[subName].push({ url: r.secure_url, publicId: r.public_id, format: r.format || '' });
      }

      nextCursor = result.next_cursor || null;
    } while (nextCursor);

    return Object.entries(grouped)
      .filter(([, images]) => images.length > 0)
      .map(([folder, images]) => ({ folder, path: rootFolderOverride + '/' + folder, images }));
  }

  // Slow path (fallback): root_folders + sub_folders + search per folder
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
      const subResults = await Promise.all(
        subFolders.map(async (sub) => {
          const images = await fetchImagesInFolder(sub.path);
          return { folder: sub.name, path: sub.path, images };
        })
      );
      for (const result of subResults) {
        if (result.images.length > 0) blocks.push(result);
      }
    } else {
      const images = await fetchImagesInFolder(folder.path);
      if (images.length > 0) blocks.push({ folder: folder.name, path: folder.path, images });
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

function serializeError(err) {
  if (!err) return 'null';
  if (typeof err === 'string') return err;
  const obj = {};
  // Copy all own properties
  for (const key of Object.getOwnPropertyNames(err)) {
    try { obj[key] = err[key]; } catch (_) { obj[key] = '[unreadable]'; }
  }
  // Also check common nested properties
  if (err.error) {
    obj._nested_error = typeof err.error === 'object' ? { ...err.error } : err.error;
  }
  if (err.http_code) obj._http_code = err.http_code;
  try { return JSON.stringify(obj); } catch (_) { return String(err); }
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

    // Pick the first subfolder to test image fetching
    let testFolder = null;
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
        if (subs.length > 0 && !testFolder) testFolder = subs[0];
      } catch (subErr) {
        debug.steps.push({
          step: 'sub_folders',
          parent: folder.path,
          error: serializeError(subErr)
        });
      }
    }

    // Test: Search API with asset_folder on first subfolder
    if (testFolder) {
      try {
        const searchResult = await cloudinary.search
          .expression(`asset_folder="${testFolder.path}" AND resource_type:image`)
          .max_results(5)
          .execute();
        debug.steps.push({
          step: 'search_api_test',
          folder: testFolder.path,
          expression: `asset_folder="${testFolder.path}" AND resource_type:image`,
          totalCount: searchResult.total_count,
          returnedCount: Array.isArray(searchResult.resources) ? searchResult.resources.length : 0,
          sampleIds: (searchResult.resources || []).slice(0, 3).map((r) => r.public_id)
        });
      } catch (searchErr) {
        debug.steps.push({
          step: 'search_api_test',
          folder: testFolder.path,
          error: serializeError(searchErr)
        });
      }

      // Test: also try folder= syntax
      try {
        const searchResult2 = await cloudinary.search
          .expression(`folder="${testFolder.path}" AND resource_type:image`)
          .max_results(5)
          .execute();
        debug.steps.push({
          step: 'search_folder_test',
          folder: testFolder.path,
          expression: `folder="${testFolder.path}" AND resource_type:image`,
          totalCount: searchResult2.total_count,
          returnedCount: Array.isArray(searchResult2.resources) ? searchResult2.resources.length : 0,
          sampleIds: (searchResult2.resources || []).slice(0, 3).map((r) => r.public_id)
        });
      } catch (searchErr2) {
        debug.steps.push({
          step: 'search_folder_test',
          folder: testFolder.path,
          error: serializeError(searchErr2)
        });
      }

      // Test: old resources API with prefix
      try {
        const resResult = await cloudinary.api.resources({
          type: 'upload',
          prefix: testFolder.path + '/',
          max_results: 5,
          resource_type: 'image'
        });
        debug.steps.push({
          step: 'resources_prefix_test',
          prefix: testFolder.path + '/',
          returnedCount: Array.isArray(resResult.resources) ? resResult.resources.length : 0,
          sampleIds: (resResult.resources || []).slice(0, 3).map((r) => r.public_id)
        });
      } catch (resErr) {
        debug.steps.push({
          step: 'resources_prefix_test',
          prefix: testFolder.path + '/',
          error: serializeError(resErr)
        });
      }
    }
  } catch (rootErr) {
    debug.steps.push({
      step: 'root_folders',
      error: serializeError(rootErr)
    });
  }

  // Always test sub_folders on CLOUDINARY_ROOT_FOLDER if set
  // Test: search one image from first subfolder using Search API
  const firstSub = (() => {
    for (const s of debug.steps) {
      if (s.step === 'sub_folders' && Array.isArray(s.folders) && s.folders.length > 0) {
        return s.folders[0];
      }
    }
    return null;
  })();

  if (firstSub) {
    try {
      const searchResult = await cloudinary.search
        .expression(`asset_folder="${firstSub.path}" AND resource_type:image`)
        .with_field('asset_folder')
        .max_results(3)
        .execute();
      debug.steps.push({
        step: 'search_images_test',
        folder: firstSub.path,
        totalCount: searchResult.total_count,
        returnedCount: Array.isArray(searchResult.resources) ? searchResult.resources.length : 0,
        sampleUrls: (searchResult.resources || []).slice(0, 2).map((r) => r.secure_url)
      });
    } catch (searchErr) {
      debug.steps.push({
        step: 'search_images_test',
        folder: firstSub.path,
        error: serializeError(searchErr)
      });
    }
  }

  return debug;
}

module.exports = { getTimelineData, getRootAssets, isConfigured, debugCloudinaryFolders };
