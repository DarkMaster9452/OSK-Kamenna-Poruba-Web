const express = require('express');
const { z } = require('zod');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const {
  listPlayerGroups,
  createPlayerGroup,
  findPlayerGroupById,
  deletePlayerGroup,
  createAuditLog
} = require('../data/repository');

const router = express.Router();

const createGroupSchema = z.object({
  name: z.string().min(2).max(100),
  playerUsernames: z.array(z.string().min(1)).min(1).max(200)
});

async function writeAuditSafe(payload) {
  try {
    await createAuditLog(payload);
  } catch (error) {
    console.error('Audit log write failed:', error);
  }
}

router.get('/', requireAuth, requireRole('coach', 'admin'), async (req, res) => {
  const rows = await listPlayerGroups();
  const items = rows.map((row) => ({
    id: row.id,
    name: row.name,
    playerUsernames: row.members.map((m) => m.playerUsername),
    createdAt: row.createdAt,
    createdBy: row.createdBy.username
  }));
  return res.json({ items });
});

router.post('/', requireAuth, requireRole('coach', 'admin'), validateBody(createGroupSchema), async (req, res) => {
  const row = await createPlayerGroup(req.body.name, req.body.playerUsernames, req.user.id);

  await writeAuditSafe({
    actorUserId: req.user.id,
    action: 'player_group_created',
    entityType: 'player_group',
    entityId: row.id,
    details: { name: row.name, count: req.body.playerUsernames.length }
  });

  return res.status(201).json({
    item: {
      id: row.id,
      name: row.name,
      playerUsernames: row.members.map((m) => m.playerUsername),
      createdAt: row.createdAt,
      createdBy: row.createdBy.username
    }
  });
});

async function handleDeleteGroup(req, res) {
  const group = await findPlayerGroupById(req.params.id);
  if (!group) {
    return res.status(404).json({ message: 'Skupina neexistuje.' });
  }

  await writeAuditSafe({
    actorUserId: req.user.id,
    action: 'player_group_deleted',
    entityType: 'player_group',
    entityId: req.params.id,
    details: { name: group.name }
  });

  await deletePlayerGroup(req.params.id);
  return res.status(204).send();
}

router.delete('/:id', requireAuth, requireRole('coach', 'admin'), handleDeleteGroup);
router.post('/:id/delete', requireAuth, requireRole('coach', 'admin'), handleDeleteGroup);

module.exports = router;
