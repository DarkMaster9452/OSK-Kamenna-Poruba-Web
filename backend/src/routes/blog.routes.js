const express = require('express');
const { z } = require('zod');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const {
  listBlogPosts,
  createBlogPost,
  findBlogPostById,
  deleteBlogPost,
  createAuditLog
} = require('../data/repository');

const router = express.Router();

const createBlogPostSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(3).max(20000),
  published: z.boolean().optional().default(true),
  imageUrl: z.string().url().max(2000).nullable().optional(),
  tags: z.array(z.string()).optional()
});

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
      .map((row) => ({
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

router.delete('/:id', requireAuth, requireRole('blogger', 'coach', 'admin'), async (req, res) => {
  try {
    const row = await findBlogPostById(req.params.id);
    if (!row) {
      return res.status(404).json({ message: 'Blog príspevok neexistuje.' });
    }

    if (req.user.role !== 'admin' && row.createdById !== req.user.id) {
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
