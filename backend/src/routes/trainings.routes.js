const express = require('express');
const { z } = require('zod');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const {
  createTraining,
  listTrainings,
  findTrainingById,
  closeTraining,
  deleteTraining,
  upsertTrainingAttendance,
  createAuditLog,
  listActivePlayerEmailsByTrainingCategory
} = require('../data/repository');
const { sendTrainingCreatedEmails } = require('../services/email.service');

const router = express.Router();

const TRAINING_TYPES = ['technical', 'tactical', 'physical', 'friendly'];
const TRAINING_CATEGORIES = ['pripravky', 'ziaci', 'dorastenci', 'adults_young', 'adults_pro'];

const createTrainingSchema = z.object({
  date: z.string().trim().min(5).max(20),
  time: z.string().trim().min(3).max(10),
  type: z.string().trim().pipe(z.enum(TRAINING_TYPES)),
  duration: z.coerce.number().int().min(1),
  category: z.string().trim().pipe(z.enum(TRAINING_CATEGORIES)),
  note: z.preprocess(
    (value) => {
      if (value === null || value === undefined) {
        return null;
      }

      if (typeof value === 'string') {
        return value.trim();
      }

      return String(value).trim();
    },
    z.string().max(1000).nullable()
  ).optional()
});

const attendanceSchema = z.object({
  playerUsername: z.string().min(3).max(100),
  status: z.enum(['yes', 'no', 'unknown'])
});

const deleteTrainingByIdSchema = z.object({
  trainingId: z.string().min(1)
});

function isQuarterHourTime(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return false;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return false;
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return false;
  }

  return minutes % 15 === 0;
}

async function writeAuditSafe(payload) {
  try {
    await createAuditLog(payload);
  } catch (error) {
    console.error('Audit log write failed:', error);
  }
}

router.get('/', requireAuth, async (req, res) => {
  const rows = await listTrainings(req.user);
  const items = rows.map((row) => ({
    id: row.id,
    date: row.date,
    time: row.time,
    type: row.type,
    duration: row.duration,
    category: row.category,
    note: row.note,
    isActive: row.isActive,
    attendance: row.attendances,
    createdAt: row.createdAt,
    createdBy: row.createdBy.username
  }));
  return res.json({ items });
});

router.post('/', requireAuth, requireRole('coach', 'admin'), validateBody(createTrainingSchema), async (req, res) => {
  if (!isQuarterHourTime(req.body.time)) {
    return res.status(400).json({ message: 'Čas tréningu musí byť po 15 minútach (00, 15, 30, 45).' });
  }

  const normalizedNote = typeof req.body.note === 'string' ? req.body.note.trim() : null;
  const row = await createTraining({
    ...req.body,
    note: normalizedNote || null
  }, req.user.id);
  const item = {
    id: row.id,
    date: row.date,
    time: row.time,
    type: row.type,
    duration: row.duration,
    category: row.category,
    note: row.note,
    isActive: row.isActive,
    createdAt: row.createdAt,
    createdBy: row.createdBy.username
  };

  await writeAuditSafe({
    actorUserId: req.user.id,
    action: 'training_created',
    entityType: 'training',
    entityId: row.id,
    details: {
      date: row.date,
      time: row.time,
      category: row.category,
      type: row.type,
      hasNote: Boolean(row.note)
    }
  });

  try {
    const recipients = await listActivePlayerEmailsByTrainingCategory(row.category);
    const emailResult = await sendTrainingCreatedEmails({
      training: row,
      recipients,
      createdByUsername: row.createdBy.username
    });

    if (emailResult.skipped) {
      console.info(`Training email notifications skipped: ${emailResult.skipped}`);
    } else {
      console.info(`Training email notifications sent: ${emailResult.sent}`);
    }
  } catch (error) {
    console.error('Training email notification failed:', error);
  }

  return res.status(201).json({ item });
});

router.post('/:id/attendance', requireAuth, validateBody(attendanceSchema), async (req, res) => {
  const training = await findTrainingById(req.params.id);
  if (!training) {
    return res.status(404).json({ message: 'Tréning neexistuje.' });
  }

  if (!training.isActive) {
    return res.status(400).json({ message: 'Tréning je uzavretý.' });
  }

  const row = await upsertTrainingAttendance(
    training.id,
    req.body.playerUsername,
    req.body.status,
    req.user.id
  );

  await writeAuditSafe({
    actorUserId: req.user.id,
    action: 'training_attendance_updated',
    entityType: 'attendance',
    entityId: row.id,
    details: {
      trainingId: training.id,
      playerUsername: row.playerUsername,
      status: row.status
    }
  });

  return res.json({
    item: {
      id: row.id,
      trainingId: row.trainingId,
      playerUsername: row.playerUsername,
      status: row.status,
      updatedAt: row.updatedAt
    }
  });
});

router.patch('/:id/close', requireAuth, requireRole('coach', 'admin'), async (req, res) => {
  const training = await findTrainingById(req.params.id);
  if (!training) {
    return res.status(404).json({ message: 'Tréning neexistuje.' });
  }

  if (!training.isActive) {
    return res.status(400).json({ message: 'Tréning je už uzavretý.' });
  }

  const row = await closeTraining(training.id);

  await writeAuditSafe({
    actorUserId: req.user.id,
    action: 'training_closed',
    entityType: 'training',
    entityId: row.id,
    details: {
      date: row.date,
      time: row.time
    }
  });

  return res.json({
    item: {
      id: row.id,
      isActive: row.isActive
    }
  });
});

async function handleDeleteTraining(req, res) {
  const training = await findTrainingById(req.params.id);
  if (!training) {
    return res.status(404).json({ message: 'Tréning neexistuje.' });
  }

  await deleteTraining(training.id);

  await writeAuditSafe({
    actorUserId: req.user.id,
    action: 'training_deleted',
    entityType: 'training',
    entityId: training.id,
    details: {
      date: training.date,
      time: training.time
    }
  });

  return res.status(204).send();
}

router.post('/delete-by-id', requireAuth, requireRole('coach', 'admin'), validateBody(deleteTrainingByIdSchema), async (req, res) => {
  const trainingId = String(req.body.trainingId || '').trim();
  const training = await findTrainingById(trainingId);
  if (!training) {
    return res.status(404).json({ message: 'Tréning neexistuje.' });
  }

  await deleteTraining(training.id);

  await writeAuditSafe({
    actorUserId: req.user.id,
    action: 'training_deleted',
    entityType: 'training',
    entityId: training.id,
    details: {
      date: training.date,
      time: training.time
    }
  });

  return res.json({
    item: {
      id: training.id,
      deleted: true
    }
  });
});

router.delete('/:id', requireAuth, requireRole('coach', 'admin'), handleDeleteTraining);
router.post('/:id/delete', requireAuth, requireRole('coach', 'admin'), handleDeleteTraining);

module.exports = router;