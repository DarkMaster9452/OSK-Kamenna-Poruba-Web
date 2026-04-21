const express = require('express');
const { z } = require('zod');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const {
  listBlogPosts,
  createBlogPost,
  updateBlogPost,
  findBlogPostById,
  findBlogPostBySlug,
  deleteBlogPost,
  incrementBlogPostViewCount,
  createAuditLog
} = require('../data/repository');

const router = express.Router();

// IP deduplication: Map<postId, Map<ip, timestamp>>
const viewCache = new Map();
const VIEW_TTL_MS = 24 * 60 * 60 * 1000;

function hasRecentView(postId, ip) {
  const byPost = viewCache.get(postId);
  if (!byPost) return false;
  const last = byPost.get(ip);
  if (!last) return false;
  if (Date.now() - last < VIEW_TTL_MS) return true;
  byPost.delete(ip);
  return false;
}

function recordView(postId, ip) {
  if (!viewCache.has(postId)) viewCache.set(postId, new Map());
  viewCache.get(postId).set(ip, Date.now());
}

const createBlogPostSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(3).max(20000),
  published: z.boolean().optional().default(true),
  featured: z.boolean().optional().default(false),
  imageUrl: z.string().url().max(2000).nullable().optional(),
  tags: z.array(z.string()).optional()
});

function mapRow(row) {
  return {
    id: row.id,
    slug: row.slug || null,
    title: row.title,
    content: row.content,
    imageUrl: row.imageUrl || null,
    tags: row.tags || [],
    published: row.published,
    featured: row.featured ?? false,
    viewCount: row.viewCount ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy.username
  };
}

async function writeAuditSafe(payload) {
  try {
    await createAuditLog(payload);
  } catch (error) {
    console.error('Audit log write failed:', error);
  }
}

router.get('/', async (req, res) => {
  try {
    const rows = await listBlogPosts();
    const items = rows
      .filter((row) => row.published)
      .map(mapRow);

    return res.json({ items });
  } catch (error) {
    console.error('Blog list failed:', error);
    return res.status(500).json({ message: error.message || 'Nepodarilo sa načítať blog príspevky.' });
  }
});

router.get('/manage', requireAuth, requireRole('blogger', 'coach', 'admin'), async (req, res) => {
  try {
    const rows = await listBlogPosts();
    const visibleRows = req.user.role === 'admin'
      ? rows
      : rows.filter((row) => row.createdById === req.user.id);

    const items = visibleRows.map(mapRow);
    return res.json({ items });
  } catch (error) {
    console.error('Blog manage list failed:', error);
    return res.status(500).json({ message: error.message || 'Nepodarilo sa načítať blog príspevky.' });
  }
});

router.get('/slug/:slug', async (req, res) => {
  try {
    const row = await findBlogPostBySlug(req.params.slug);
    if (!row || !row.published) {
      return res.status(404).json({ message: 'Blog príspevok neexistuje.' });
    }
    return res.json({ item: mapRow(row) });
  } catch (error) {
    console.error('Blog get by slug failed:', error);
    return res.status(500).json({ message: error.message || 'Nepodarilo sa načítať blog príspevok.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const row = await findBlogPostById(req.params.id);
    if (!row || !row.published) {
      return res.status(404).json({ message: 'Blog príspevok neexistuje.' });
    }
    return res.json({ item: mapRow(row) });
  } catch (error) {
    console.error('Blog get by id failed:', error);
    return res.status(500).json({ message: error.message || 'Nepodarilo sa načítať blog príspevok.' });
  }
});

router.post('/:id/view', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    if (hasRecentView(req.params.id, ip)) {
      return res.status(204).send();
    }
    await incrementBlogPostViewCount(req.params.id);
    recordView(req.params.id, ip);
    return res.status(204).send();
  } catch (error) {
    console.error('Blog view count increment failed:', error);
    return res.status(500).json({ message: 'Nepodarilo sa aktualizovať počet prečítaní.' });
  }
});

router.post('/', requireAuth, requireRole('blogger', 'coach', 'admin'), validateBody(createBlogPostSchema), async (req, res) => {
  try {
    const row = await createBlogPost(req.body, req.user.id);

    await writeAuditSafe({
      actorUserId: req.user.id,
      action: 'blog_post_created',
      entityType: 'blog_post',
      entityId: row.id,
      details: { title: row.title, published: row.published }
    });

    return res.status(201).json({ item: mapRow(row) });
  } catch (error) {
    console.error('Blog create failed:', error);
    return res.status(500).json({ message: error.message || 'Nepodarilo sa vytvoriť blog príspevok.' });
  }
});

router.put('/:id', requireAuth, requireRole('blogger', 'coach', 'admin'), validateBody(createBlogPostSchema), async (req, res) => {
  try {
    const row = await findBlogPostById(req.params.id);
    if (!row) {
      return res.status(404).json({ message: 'Blog príspevok neexistuje.' });
    }

    if (!['admin','blogger','coach'].includes(req.user.role) && row.createdById !== req.user.id) {
      return res.status(403).json({ message: 'Nemáte oprávnenie upraviť cudzí blog príspevok.' });
    }

    const updatedRow = await updateBlogPost(req.params.id, req.body);

    await writeAuditSafe({
      actorUserId: req.user.id,
      action: 'blog_post_updated',
      entityType: 'blog_post',
      entityId: updatedRow.id,
      details: { title: updatedRow.title, published: updatedRow.published, featured: updatedRow.featured }
    });

    return res.json({ item: mapRow(updatedRow) });
  } catch (error) {
    console.error('Blog update failed:', error);
    return res.status(500).json({ message: error.message || 'Nepodarilo sa upraviť blog príspevok.' });
  }
});

router.delete('/:id', requireAuth, requireRole('blogger', 'coach', 'admin'), async (req, res) => {
  try {
    const row = await findBlogPostById(req.params.id);
    if (!row) {
      return res.status(404).json({ message: 'Blog príspevok neexistuje.' });
    }

    if (!['admin','blogger','coach'].includes(req.user.role) && row.createdById !== req.user.id) {
      return res.status(403).json({ message: 'Nemáte oprávnenie odstrániť cudzí blog príspevok.' });
    }

    await deleteBlogPost(req.params.id);

    await writeAuditSafe({
      actorUserId: req.user.id,
      action: 'blog_post_deleted',
      entityType: 'blog_post',
      entityId: row.id,
      details: { title: row.title }
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Blog delete failed:', error);
    return res.status(500).json({ message: error.message || 'Nepodarilo sa odstrániť blog príspevok.' });
  }
});

module.exports = router;

router.get('/manage', requireAuth, requireRole('blogger', 'coach', 'admin'), async (req, res) => {
  try {
    const rows = await listBlogPosts();
    const visibleRows = ['admin', 'blogger', 'coach'].includes(req.user.role)
      ? rows
      : rows.filter((row) => row.createdById === req.user.id);

    const items = visibleRows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      imageUrl: row.imageUrl || null,
      tags: row.tags || [],
      published: row.published,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy.username
    }));

    return res.json({ items });
  } catch (error) {
    console.error('Blog manage list failed:', error);
    return res.status(500).json({ message: error.message || 'Nepodarilo sa načítať blog príspevky.' });
  }
});

router.post('/', requireAuth, requireRole('blogger', 'coach', 'admin'), validateBody(createBlogPostSchema), async (req, res) => {
  try {
    const row = await createBlogPost(req.body, req.user.id);
    const item = {
      id: row.id,
      title: row.title,
      content: row.content,
      imageUrl: row.imageUrl || null,
      tags: row.tags || [],
      published: row.published,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy.username
    };

    await writeAuditSafe({
      actorUserId: req.user.id,
      action: 'blog_post_created',
      entityType: 'blog_post',
      entityId: row.id,
      details: {
        title: row.title,
        published: row.published
      }
    });

    return res.status(201).json({ item });
  } catch (error) {
    console.error('Blog create failed:', error);
    return res.status(500).json({ message: error.message || 'Nepodarilo sa vytvoriť blog príspevok.' });
  }
});

router.put('/:id', requireAuth, requireRole('blogger', 'coach', 'admin'), validateBody(createBlogPostSchema), async (req, res) => {
  try {
    const row = await findBlogPostById(req.params.id);
    if (!row) {
      return res.status(404).json({ message: 'Blog príspevok neexistuje.' });
    }

    if (!['admin','blogger','coach'].includes(req.user.role) && row.createdById !== req.user.id) {
      return res.status(403).json({ message: 'Nemáte oprávnenie upraviť cudzí blog príspevok.' });
    }

    const updatedRow = await updateBlogPost(req.params.id, req.body);
    const item = {
      id: updatedRow.id,
      title: updatedRow.title,
      content: updatedRow.content,
      imageUrl: updatedRow.imageUrl || null,
      tags: updatedRow.tags || [],
      published: updatedRow.published,
      createdAt: updatedRow.createdAt,
      updatedAt: updatedRow.updatedAt,
      createdBy: updatedRow.createdBy.username
    };

    await writeAuditSafe({
      actorUserId: req.user.id,
      action: 'blog_post_updated',
      entityType: 'blog_post',
      entityId: updatedRow.id,
      details: {
        title: updatedRow.title,
        published: updatedRow.published
      }
    });

    return res.json({ item });
  } catch (error) {
    console.error('Blog update failed:', error);
    return res.status(500).json({ message: error.message || 'Nepodarilo sa upraviť blog príspevok.' });
  }
});

router.delete('/:id', requireAuth, requireRole('blogger', 'coach', 'admin'), async (req, res) => {
  try {
    const row = await findBlogPostById(req.params.id);
    if (!row) {
      return res.status(404).json({ message: 'Blog príspevok neexistuje.' });
    }

    if (!['admin','blogger','coach'].includes(req.user.role) && row.createdById !== req.user.id) {
      return res.status(403).json({ message: 'Nemáte oprávnenie odstrániť cudzí blog príspevok.' });
    }

    await deleteBlogPost(req.params.id);

    await writeAuditSafe({
      actorUserId: req.user.id,
      action: 'blog_post_deleted',
      entityType: 'blog_post',
      entityId: row.id,
      details: {
        title: row.title
      }
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Blog delete failed:', error);
    return res.status(500).json({ message: error.message || 'Nepodarilo sa odstrániť blog príspevok.' });
  }
});

module.exports = router;
