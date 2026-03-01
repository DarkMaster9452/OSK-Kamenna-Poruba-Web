const express = require('express');
const { z } = require('zod');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { createAnnouncement, listAnnouncements, deleteAnnouncement, createAuditLog } = require('../data/repository');

const router = express.Router();

const createAnnouncementSchema = z.object({
  title: z.string().min(3).max(120),
  message: z.string().min(3).max(4000),
  target: z.enum(['all', 'players', 'parents', 'coaches', 'admins']),
  playerCategory: z.enum(['pripravka_u9', 'pripravka_u11', 'ziaci', 'dorastenci', 'adults_young', 'adults_pro']).nullable().optional(),
  important: z.boolean().default(false)
});

async function writeAuditSafe(payload) {
  try {
    await createAuditLog(payload);
  } catch (error) {
    console.error('Audit log write failed:', error);
  }
}

router.get('/', requireAuth, async (req, res) => {
  const rows = await listAnnouncements();
  const visibleRows = rows.filter((row) => {
    if (row.target === 'admins') return req.user.role === 'admin';
    if (req.user.role === 'coach' || req.user.role === 'admin') return true;
    if (row.target === 'all') return true;
    if (row.target === 'players') {
      if (req.user.role !== 'player') return false;
      return !row.playerCategory || row.playerCategory === req.user.playerCategory;
    }
    if (row.target === 'parents') return req.user.role === 'parent';
    if (row.target === 'coaches') return req.user.role === 'coach' || req.user.role === 'admin';
    return false;
  });
  const items = visibleRows.map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message,
    target: row.target,
    playerCategory: row.playerCategory,
    important: row.important,
    createdAt: row.createdAt,
    createdBy: row.createdBy.username
  }));
  return res.json({ items });
});

router.post('/', requireAuth, requireRole('coach', 'admin'), validateBody(createAnnouncementSchema), async (req, res) => {
  if (req.body.target !== 'players' && req.body.playerCategory) {
    return res.status(400).json({ message: 'Kategóriu hráčov je možné zvoliť len pre cieľ Hráči.' });
  }

  const input = {
    ...req.body,
    playerCategory: req.body.target === 'players' ? (req.body.playerCategory || null) : null
  };
  const row = await createAnnouncement(input, req.user.id);
  const item = {
    id: row.id,
    title: row.title,
    message: row.message,
    target: row.target,
    playerCategory: row.playerCategory,
    important: row.important,
    createdAt: row.createdAt,
    createdBy: row.createdBy.username
  };

  await writeAuditSafe({
    actorUserId: req.user.id,
    action: 'announcement_created',
    entityType: 'announcement',
    entityId: row.id,
    details: {
      title: row.title,
      target: row.target,
      playerCategory: row.playerCategory
    }
  });

  return res.status(201).json({ item });
});

router.delete('/:id', requireAuth, requireRole('coach', 'admin'), async (req, res) => {
  await writeAuditSafe({
    actorUserId: req.user.id,
    action: 'announcement_deleted',
    entityType: 'announcement',
    entityId: req.params.id,
    details: null
  });
  await deleteAnnouncement(req.params.id);
  return res.status(204).send();
});

module.exports = router;