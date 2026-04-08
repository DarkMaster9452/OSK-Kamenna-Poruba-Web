const cloudinary = require('cloudinary').v2;
const env = require('../config/env');
const { readCache, writeCache, invalidateCache } = require('./cache');

let configured = false;
const inflightCloudinaryRefreshes = {
  timeline: null,
  assets: null
};

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

const WEB_SAFE_IMAGE_FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif', 'ico']);

function buildDeliveryUrl(resource) {
  const url = resource?.secure_url || '';
  const format = String(resource?.format || '').toLowerCase();

  if (!url || WEB_SAFE_IMAGE_FORMATS.has(format)) {
    return url;
  }

  return url.replace('/image/upload/', '/image/upload/f_auto/');
}

const NON_IMAGE_FORMATS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar']);

function isDisplayableImage(resource) {
  return !NON_IMAGE_FORMATS.has((resource.format || '').toLowerCase());
}


function makeUnconfiguredResponse(resource) {
  return {
    source: `cloudinary.${resource}.unconfigured`,
    fetchedAt: new Date().toISOString(),
    cache: 'BYPASS',
    message: 'Cloudinary nie je nakonfigurovany. Nastav CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.'
  };
}

async function runCloudinaryRefreshOnce(kind, factory) {
  if (inflightCloudinaryRefreshes[kind]) {
    return inflightCloudinaryRefreshes[kind];
  }

  let promise;
  promise = (async () => {
    try {
      return await factory();
    } finally {
      if (inflightCloudinaryRefreshes[kind] === promise) {
        inflightCloudinaryRefreshes[kind] = null;
      }
    }
  })();

  inflightCloudinaryRefreshes[kind] = promise;
  return promise;
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

const GALLERY_FOLDER_BLACKLIST = new Set(['blog', 'sponzori']);
const DEFAULT_CLOUDINARY_ROOT_FOLDER = '';

function getFolderSegments(folderPath) {
  return String(folderPath || '')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function isGalleryFolderAllowed(folderPath) {
  return getFolderSegments(folderPath).every((segment) => !GALLERY_FOLDER_BLACKLIST.has(segment.toLowerCase()));
}

function resolveCloudinaryRootFolder() {
  return normalizeFolderPath(env.cloudinaryRootFolder || DEFAULT_CLOUDINARY_ROOT_FOLDER);
}

function getCloudinaryDeploySignature() {
  return String(
    process.env.VERCEL_DEPLOYMENT_ID
    || process.env.VERCEL_URL
    || process.env.VERCEL_GIT_COMMIT_SHA
    || ''
  );
}

function getCloudinaryAccountSignature() {
  return JSON.stringify({
    cloudName: String(env.cloudinaryCloudName || ''),
    rootFolder: String(resolveCloudinaryRootFolder() || '')
  });
}

function getCloudinaryCacheSignature() {
  return JSON.stringify({
    cloudName: String(env.cloudinaryCloudName || ''),
    rootFolder: String(resolveCloudinaryRootFolder() || ''),
    deploy: getCloudinaryDeploySignature()
  });
}

function parseCloudinaryCacheSignature(payload) {
  if (!payload) {
    return null;
  }

  if (payload.accountSignature || payload.deploySignature) {
    return {
      accountSignature: String(payload.accountSignature || ''),
      deploySignature: String(payload.deploySignature || '')
    };
  }

  try {
    const parsed = JSON.parse(String(payload.cacheSignature || ''));
    return {
      accountSignature: JSON.stringify({
        cloudName: String(parsed.cloudName || ''),
        rootFolder: String(parsed.rootFolder || '')
      }),
      deploySignature: String(parsed.deploy || '')
    };
  } catch (_) {
    return null;
  }
}

function isMatchingCloudinaryAccountCache(payload) {
  const parsed = parseCloudinaryCacheSignature(payload);
  return !!parsed && parsed.accountSignature === getCloudinaryAccountSignature();
}

function isMatchingCloudinaryDeployCache(payload) {
  const parsed = parseCloudinaryCacheSignature(payload);
  return !!parsed && parsed.deploySignature === getCloudinaryDeploySignature();
}

async function readCompatibleCloudinaryCache(key, { acceptPreviousDeploy = false, allowExpired = false } = {}) {
  const cached = await readCache(key, { allowExpired });
  if (!cached) {
    return null;
  }

  if (!isMatchingCloudinaryAccountCache(cached)) {
    await invalidateCache(key);
    console.warn(`[Cloudinary] Ignoring stale cache for ${key} because Cloudinary account configuration changed.`);
    return null;
  }

  if (acceptPreviousDeploy || isMatchingCloudinaryDeployCache(cached)) {
    return cached;
  }

  return null;
}

function isCloudinaryRateLimitError(message) {
  return /rate limit exceeded/i.test(String(message || ''));
}

async function buildRateLimitedCloudinaryResponse(key, resource, fieldName, emptyValue, errorMsg) {
  const payload = {
    source: `cloudinary.${resource}.rate_limited`,
    fetchedAt: new Date().toISOString(),
    cacheSignature: getCloudinaryCacheSignature(),
    accountSignature: getCloudinaryAccountSignature(),
    deploySignature: getCloudinaryDeploySignature(),
    warning: errorMsg,
    temporaryUnavailable: true,
    [fieldName]: emptyValue
  };

  await writeCache(key, payload, 5 * 60 * 1000);
  return { ...payload, cache: 'COOLDOWN' };
}

function normalizeFolderPath(folderPath) {
  return getFolderSegments(folderPath).join('/');
}

function getResourceFolderPath(resource) {
  const assetFolder = normalizeFolderPath(resource?.asset_folder || resource?.folder || '');
  if (assetFolder) {
    return assetFolder;
  }

  const publicId = String(resource?.public_id || '');
  const segments = publicId.split('/').filter(Boolean);
  if (segments.length <= 1) {
    return '';
  }

  segments.pop();
  return normalizeFolderPath(segments.join('/'));
}

function isInsideRootFolder(folderPath, rootFolder) {
  const normalizedFolder = normalizeFolderPath(folderPath);
  const normalizedRoot = normalizeFolderPath(rootFolder);
  if (!normalizedRoot) {
    return true;
  }

  return normalizedFolder === normalizedRoot || normalizedFolder.startsWith(normalizedRoot + '/');
}

function compareGalleryImages(left, right) {
  const leftTime = Date.parse(left?.createdAt || '') || 0;
  const rightTime = Date.parse(right?.createdAt || '') || 0;

  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return String(left?.publicId || '').localeCompare(String(right?.publicId || ''), 'sk', {
    numeric: true,
    sensitivity: 'base'
  });
}

async function fetchAllImageResources() {
  const resources = [];
  let nextCursor = null;

  do {
    let query = cloudinary.search
      .expression('resource_type:image')
      .max_results(500);

    if (nextCursor) {
      query = query.next_cursor(nextCursor);
    }

    const result = await query.execute();
    resources.push(...(Array.isArray(result.resources) ? result.resources : []));
    nextCursor = result.next_cursor || null;
  } while (nextCursor);

  return resources;
}

async function fetchImagesForAssetFolder(folderPath) {
  const images = [];
  let nextCursor = null;

  do {
    const params = { max_results: 500, resource_type: 'image' };
    if (nextCursor) params.next_cursor = nextCursor;

    const result = await cloudinary.api.resources_by_asset_folder(folderPath, params);
    for (const resource of (result.resources || [])) {
      if (isDisplayableImage(resource)) {
        images.push({
        url: buildDeliveryUrl(resource),
          createdAt: resource.created_at || '',
          publicId: resource.public_id,
          format: resource.format || ''
        });
      }
    }

    nextCursor = result.next_cursor || null;
  } while (nextCursor);

  images.sort(compareGalleryImages);
  return images;
}

async function collectFolderTree(folderPath, blocks) {
  if (!folderPath || !isGalleryFolderAllowed(folderPath)) {
    return;
  }

  const images = await fetchImagesForAssetFolder(folderPath);
  if (images.length > 0) {
    const segments = getFolderSegments(folderPath);
    blocks.push({
      folder: segments[segments.length - 1] || folderPath,
      path: folderPath,
      images
    });
  }

  const subFolders = await listAllSubFolders(folderPath);
  for (const subFolder of subFolders) {
    await collectFolderTree(subFolder.path, blocks);
  }
}

async function collectAllFolderBlocks() {
  const rootFolder = resolveCloudinaryRootFolder();
  console.log(`[Cloudinary] rootFolder="${rootFolder}" (truthy=${!!rootFolder})`);

  const resources = await fetchAllImageResources();
  const grouped = new Map();

  for (const resource of resources) {
    if (!isDisplayableImage(resource)) {
      continue;
    }

    const folderPath = getResourceFolderPath(resource);
    if (!folderPath) {
      continue;
    }

    if (!isInsideRootFolder(folderPath, rootFolder) || !isGalleryFolderAllowed(folderPath)) {
      continue;
    }

    if (!grouped.has(folderPath)) {
      const segments = getFolderSegments(folderPath);
      grouped.set(folderPath, {
        folder: segments[segments.length - 1] || folderPath,
        path: folderPath,
        images: []
      });
    }

    grouped.get(folderPath).images.push({
      url: buildDeliveryUrl(resource),
      createdAt: resource.created_at || '',
      publicId: resource.public_id,
      format: resource.format || ''
    });
  }

  const blocks = Array.from(grouped.values())
    .map((block) => ({
      ...block,
      images: block.images.slice().sort(compareGalleryImages)
    }))
    .filter((block) => block.images.length > 0)
    .sort((left, right) => left.path.localeCompare(right.path, 'sk'));

  console.log(`[Cloudinary] Scan complete via search API. Found ${blocks.length} blocks.`);
  return blocks;
}

async function getTimelineData({ forceRefresh = false } = {}) {
  if (!isConfigured()) {
    return { ...makeUnconfiguredResponse('timeline'), folders: [] };
  }

  if (!forceRefresh) {
    const cached = await readCompatibleCloudinaryCache('cloudinary_timeline');
    if (cached) {
      return { ...cached, cache: 'HIT' };
    }
  }

  try {
    return await runCloudinaryRefreshOnce('timeline', async () => {
      const folders = await collectAllFolderBlocks();

      const normalized = {
        source: 'cloudinary.timeline',
        fetchedAt: new Date().toISOString(),
        cacheSignature: getCloudinaryCacheSignature(),
        accountSignature: getCloudinaryAccountSignature(),
        deploySignature: getCloudinaryDeploySignature(),
        folders
      };

      if (folders.length > 0) {
        const ttl = Math.max(0, env.cloudinaryCacheSeconds || 1800) * 1000;
        await writeCache('cloudinary_timeline', normalized, ttl);
      } else {
        console.warn(`[Cloudinary] No folders found — not caching empty result.`);
      }

      return { ...normalized, cache: 'MISS' };
    });
  } catch (error) {
    const errorMsg = error?.error?.message || error?.message || 'Neznama chyba';
    console.error(`[Cloudinary] Failed to fetch timeline data: ${errorMsg}`);
    const staleObj = await readCompatibleCloudinaryCache('cloudinary_timeline', { acceptPreviousDeploy: true, allowExpired: true });
    if (staleObj) {
      return { ...staleObj, cache: 'STALE', warning: errorMsg };
    }
    if (isCloudinaryRateLimitError(errorMsg)) {
      return buildRateLimitedCloudinaryResponse('cloudinary_timeline', 'timeline', 'folders', [], errorMsg);
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

  const rootFolder = resolveCloudinaryRootFolder();

  if (!forceRefresh) {
    const cached = await readCompatibleCloudinaryCache('cloudinary_assets');
    if (cached) {
      return { ...cached, cache: 'HIT' };
    }
  }

  try {
    return await runCloudinaryRefreshOnce('assets', async () => {
      const resources = await fetchAllImageResources();

      const assets = resources
        .filter((resource) => {
          if (!isDisplayableImage(resource)) {
            return false;
          }

          const folderPath = getResourceFolderPath(resource);
          return !!folderPath && isInsideRootFolder(folderPath, rootFolder) && isGalleryFolderAllowed(folderPath);
        })
        .map((r) => ({
          url: buildDeliveryUrl(r),
          publicId: r.public_id,
          format: r.format || '',
          filename: r.public_id + (r.format ? '.' + r.format : '')
        }));

      const normalized = {
        source: 'cloudinary.assets',
        fetchedAt: new Date().toISOString(),
        cacheSignature: getCloudinaryCacheSignature(),
        accountSignature: getCloudinaryAccountSignature(),
        deploySignature: getCloudinaryDeploySignature(),
        cloudName: env.cloudinaryCloudName,
        assets
      };

      const ttl = Math.max(0, env.cloudinaryCacheSeconds || 1800) * 1000;
      await writeCache('cloudinary_assets', normalized, ttl);

      return { ...normalized, cache: 'MISS' };
    });
  } catch (error) {
    const errorMsg = error?.error?.message || error?.message || 'Neznama chyba';
    const staleObj = await readCompatibleCloudinaryCache('cloudinary_assets', { acceptPreviousDeploy: true, allowExpired: true });
    if (staleObj) {
      return { ...staleObj, cache: 'STALE', warning: errorMsg };
    }
    if (isCloudinaryRateLimitError(errorMsg)) {
      return buildRateLimitedCloudinaryResponse('cloudinary_assets', 'assets', 'assets', [], errorMsg);
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

  const rootFolder = resolveCloudinaryRootFolder();
  const uploadFolder = normalizeFolderPath([rootFolder, folder].filter(Boolean).join('/'));

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: uploadFolder,
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
