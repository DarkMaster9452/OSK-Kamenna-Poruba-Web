const express = require('express');
const { z } = require('zod');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const {
  createTraining,
  updateTraining,
  listTrainings,
  findTrainingById,
  closeTraining,
  deleteTraining,
  upsertTrainingAttendance,
  createAuditLog,
  listActivePlayerEmailsByTrainingCategory,
  replaceTrainingGroups,
  updateTrainingAttendanceGroup
} = require('../data/repository');
const { sendTrainingCreatedEmails, sendTrainingUpdatedEmails } = require('../services/email.service');

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

const updateTrainingSchema = createTrainingSchema;

const attendanceSchema = z.object({
  playerUsername: z.string().min(3).max(100),
  status: z.enum(['yes', 'no', 'unknown'])
});

const upsertTrainingGroupsSchema = z.object({
  groups: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    location: z.string().trim().max(100).optional(),
    note: z.string().trim().max(500).optional()
  })).max(20)
});

const updateAttendanceGroupSchema = z.object({
  trainingGroupId: z.string().trim().min(1).max(200).nullable().optional()
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

function formatTrainingType(trainingType) {
  const labels = {
    technical: 'Technický',
    tactical: 'Taktický',
    physical: 'Fyzický',
    friendly: 'Priateľský'
  };

  return labels[trainingType] || trainingType;
}

function formatTrainingCategory(trainingCategory) {
  const labels = {
    pripravky: 'Prípravky',
    ziaci: 'Žiaci',
    dorastenci: 'Dorastenci',
    adults_young: 'Dospelí - Mladí',
    adults_pro: 'Dospelí - Skúsení'
  };

  return labels[trainingCategory] || trainingCategory;
}

function normalizeNote(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

function buildTrainingChanges(before, after) {
  const changes = [];

  if (before.date !== after.date) {
    changes.push(`Dátum: ${before.date} → ${after.date}`);
  }

  if (before.time !== after.time) {
    changes.push(`Čas: ${before.time} → ${after.time}`);
  }

  if (before.type !== after.type) {
    changes.push(`Typ: ${formatTrainingType(before.type)} → ${formatTrainingType(after.type)}`);
  }

  if (Number(before.duration) !== Number(after.duration)) {
    changes.push(`Trvanie: ${before.duration} min → ${after.duration} min`);
  }

  if (before.category !== after.category) {
    changes.push(`Kategória: ${formatTrainingCategory(before.category)} → ${formatTrainingCategory(after.category)}`);
  }

  const beforeNote = normalizeNote(before.note);
  const afterNote = normalizeNote(after.note);
  if (beforeNote !== afterNote) {
    changes.push(`Poznámka: ${beforeNote || 'bez poznámky'} → ${afterNote || 'bez poznámky'}`);
  }

  return changes;
}

async function writeAuditSafe(payload) {
  try {
    await createAuditLog(payload);
  } catch (error) {
    console.error('Audit log write failed:', error);
  }
}

router.get('/', requireAuth, async (req, res) => {
  try {
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
      groups: Array.isArray(row.groups) ? row.groups : [],
      createdAt: row.createdAt,
      createdBy: row.createdBy.username
    }));
    return res.json({ items });
  } catch (error) {
    console.error('Failed to list trainings:', error);
    return res.status(500).json({ message: 'Nepodarilo sa načítať tréningy.' });
  }
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

  const emailNotification = {
    status: 'not_attempted',
    reason: null,
    sent: 0,
    recipients: 0
  };

  try {
    const recipients = await listActivePlayerEmailsByTrainingCategory(row.category);
    emailNotification.recipients = recipients.length;

    const emailResult = await sendTrainingCreatedEmails({
      training: row,
      recipients,
      createdByUsername: row.createdBy.username
    });

    emailNotification.sent = Number(emailResult.sent || 0);
    emailNotification.reason = emailResult.skipped || null;
    emailNotification.status = emailResult.skipped ? 'skipped' : 'sent';

    if (emailResult.skipped) {
      console.info(`Training email notifications skipped: ${emailResult.skipped}`);
    } else {
      console.info(`Training email notifications sent: ${emailResult.sent}`);
    }
  } catch (error) {
    emailNotification.status = 'failed';
    emailNotification.reason = 'exception';
    console.error('Training email notification failed:', error);
  }

  return res.status(201).json({ item, emailNotification });
});

async function handleUpdateTraining(req, res) {
  const existing = await findTrainingById(req.params.id);
  if (!existing) {
    return res.status(404).json({ message: 'Tréning neexistuje.' });
  }

  if (!isQuarterHourTime(req.body.time)) {
    return res.status(400).json({ message: 'Čas tréningu musí byť po 15 minútach (00, 15, 30, 45).' });
  }

  const input = {
    ...req.body,
    note: normalizeNote(req.body.note)
  };

  const changes = buildTrainingChanges(existing, input);
  if (!changes.length) {
    return res.status(400).json({ message: 'Neboli zistené žiadne zmeny na uloženie.' });
  }

  const row = await updateTraining(existing.id, input);

  await writeAuditSafe({
    actorUserId: req.user.id,
    action: 'training_updated',
    entityType: 'training',
    entityId: row.id,
    details: {
      changes,
      previous: {
        date: existing.date,
        time: existing.time,
        type: existing.type,
        duration: existing.duration,
        category: existing.category,
        note: normalizeNote(existing.note)
      },
      current: {
        date: row.date,
        time: row.time,
        type: row.type,
        duration: row.duration,
        category: row.category,
        note: normalizeNote(row.note)
      }
    }
  });

  const emailNotification = {
    status: 'not_attempted',
    reason: null,
    sent: 0,
    recipients: 0
  };

  try {
    const recipients = await listActivePlayerEmailsByTrainingCategory(row.category);
    emailNotification.recipients = recipients.length;

    const emailResult = await sendTrainingUpdatedEmails({
      training: row,
      recipients,
      updatedByUsername: req.user.username,
      changes
    });

    emailNotification.sent = Number(emailResult.sent || 0);
    emailNotification.reason = emailResult.skipped || null;
    emailNotification.status = emailResult.skipped ? 'skipped' : 'sent';

    if (emailResult.skipped) {
      console.info(`Training update email notifications skipped: ${emailResult.skipped}`);
    } else {
      console.info(`Training update email notifications sent: ${emailResult.sent}`);
    }
  } catch (error) {
    emailNotification.status = 'failed';
    emailNotification.reason = 'exception';
    console.error('Training update email notification failed:', error);
  }

  return res.json({
    item: {
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
    },
    changes,
    emailNotification
  });
}

router.patch('/:id', requireAuth, requireRole('coach', 'admin'), validateBody(updateTrainingSchema), handleUpdateTraining);
router.post('/:id/update', requireAuth, requireRole('coach', 'admin'), validateBody(updateTrainingSchema), handleUpdateTraining);

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

router.post('/:id/groups', requireAuth, requireRole('coach', 'admin'), validateBody(upsertTrainingGroupsSchema), async (req, res) => {
  const training = await findTrainingById(req.params.id);
  if (!training) {
    return res.status(404).json({ message: 'Tréning neexistuje.' });
  }

  const groups = await replaceTrainingGroups(training.id, req.body.groups || []);
  return res.json({
    items: groups.map((group) => ({
      id: group.id,
      name: group.name,
      location: group.location,
      note: group.note
    }))
  });
});

router.patch('/:id/attendance/:playerUsername/group', requireAuth, requireRole('coach', 'admin'), validateBody(updateAttendanceGroupSchema), async (req, res) => {
  const training = await findTrainingById(req.params.id);
  if (!training) {
    return res.status(404).json({ message: 'Tréning neexistuje.' });
  }

  const trainingGroupId = req.body.trainingGroupId || null;

  if (trainingGroupId) {
    const group = await prisma.trainingGroup.findFirst({
      where: {
        id: trainingGroupId,
        trainingId: training.id
      }
    });

    if (!group) {
      return res.status(400).json({ message: 'Podtréning neexistuje pre daný tréning.' });
    }
  }

  const row = await updateTrainingAttendanceGroup(
    training.id,
    req.params.playerUsername,
    trainingGroupId,
    req.user.id
  );

  return res.json({
    item: {
      id: row.id,
      trainingId: row.trainingId,
      playerUsername: row.playerUsername,
      status: row.status,
      trainingGroupId: row.trainingGroupId,
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