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
  listParentChildrenByParentId,
  replaceTrainingGroups,
  updateTrainingAttendanceGroup
} = require('../data/repository');
const prisma = require('../data/db');
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

const usernameFieldSchema = z.preprocess(
  (value) => {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === 'string') {
      return value.trim();
    }

    return String(value).trim();
  },
  z.string().min(3).max(100).optional()
);

const attendanceSchema = z.object({
  playerUsername: usernameFieldSchema,
  username: usernameFieldSchema,
  personName: usernameFieldSchema,
  status: z.enum(['yes', 'no', 'unknown'])
});

const GROUP_META_PREFIX = '__OSK_GROUP_META__';

function extractGroupMeta(rawNote) {
  const note = String(rawNote || '');
  if (!note.startsWith(GROUP_META_PREFIX)) {
    return {
      startTime: null,
      endTime: null,
      maxPlayers: null,
      coachNote: note || null
    };
  }

  const firstLineEnd = note.indexOf('\n');
  const header = firstLineEnd >= 0 ? note.slice(0, firstLineEnd) : note;
  const tail = firstLineEnd >= 0 ? note.slice(firstLineEnd + 1).trim() : '';

  try {
    const parsed = JSON.parse(header.slice(GROUP_META_PREFIX.length));
    const maxPlayers = Number(parsed?.maxPlayers);
    return {
      startTime: typeof parsed?.startTime === 'string' ? parsed.startTime : null,
      endTime: typeof parsed?.endTime === 'string' ? parsed.endTime : null,
      maxPlayers: Number.isInteger(maxPlayers) && maxPlayers > 0 ? maxPlayers : null,
      coachNote: tail || null
    };
  } catch (_) {
    return {
      startTime: null,
      endTime: null,
      maxPlayers: null,
      coachNote: note || null
    };
  }
}

function isValidQuarterHourTime(value) {
  return isQuarterHourTime(value);
}

function buildGroupStoredNote(groupInput) {
  const startTime = typeof groupInput?.startTime === 'string' ? groupInput.startTime.trim() : null;
  const endTime = typeof groupInput?.endTime === 'string' ? groupInput.endTime.trim() : null;
  const maxPlayersRaw = Number(groupInput?.maxPlayers);
  const maxPlayers = Number.isInteger(maxPlayersRaw) && maxPlayersRaw > 0 ? maxPlayersRaw : null;
  const coachNote = typeof groupInput?.note === 'string' ? groupInput.note.trim() : '';

  const meta = {
    startTime: startTime || null,
    endTime: endTime || null,
    maxPlayers
  };

  const header = `${GROUP_META_PREFIX}${JSON.stringify(meta)}`;
  return coachNote ? `${header}\n${coachNote}` : header;
}

const upsertTrainingGroupsSchema = z.object({
  groups: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    location: z.string().trim().max(100).optional(),
    note: z.string().trim().max(500).optional(),
    startTime: z.string().trim().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().trim().regex(/^\d{2}:\d{2}$/).optional(),
    maxPlayers: z.coerce.number().int().min(1).max(200).optional()
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

function readRequestedAttendanceUsername(body) {
  const username = body?.playerUsername || body?.username || body?.personName || '';
  return String(username).trim();
}

async function resolveAttendanceTargetUsername(user, requestedUsername) {
  if (!user || !user.role) {
    const notAuthorizedError = new Error('Neautorizované');
    notAuthorizedError.status = 401;
    throw notAuthorizedError;
  }

  if (user.role === 'player') {
    return user.username;
  }

  if (user.role === 'parent') {
    const allowedChildren = await listParentChildrenByParentId(user.id);
    const allowedUsernames = new Set(allowedChildren.map((child) => String(child.username || '').trim()));
    if (!requestedUsername || !allowedUsernames.has(requestedUsername)) {
      const forbiddenError = new Error('Môžete upraviť dochádzku iba svojim deťom.');
      forbiddenError.status = 403;
      throw forbiddenError;
    }

    return requestedUsername;
  }

  if (user.role === 'coach' || user.role === 'admin') {
    if (!requestedUsername) {
      const validationError = new Error('Chýba používateľ hráča pre uloženie dochádzky.');
      validationError.status = 400;
      throw validationError;
    }

    return requestedUsername;
  }

  const forbiddenError = new Error('Nemáte oprávnenie upravovať dochádzku.');
  forbiddenError.status = 403;
  throw forbiddenError;
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
      attendance: Array.isArray(row.attendances) ? row.attendances : [],
      groups: Array.isArray(row.groups) ? row.groups.map((group) => {
        const meta = extractGroupMeta(group.note);
        return {
          id: group.id,
          name: group.name,
          location: group.location,
          note: meta.coachNote,
          startTime: meta.startTime,
          endTime: meta.endTime,
          maxPlayers: meta.maxPlayers
        };
      }) : [],
      createdAt: row.createdAt,
      createdBy: row.createdById || 'unknown'
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
  try {
    const training = await findTrainingById(req.params.id);
    if (!training) {
      return res.status(404).json({ message: 'Tréning neexistuje.' });
    }

    if (!training.isActive) {
      return res.status(400).json({ message: 'Tréning je uzavretý.' });
    }

    const requestedUsername = readRequestedAttendanceUsername(req.body);
    const playerUsername = await resolveAttendanceTargetUsername(req.user, requestedUsername);

    const row = await upsertTrainingAttendance(
      training.id,
      playerUsername,
      req.body.status,
      req.user.id
    );

    writeAuditSafe({
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
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) {
      console.error('Failed to save training attendance:', error);
    }

    return res.status(status).json({
      message: error?.message || 'Nepodarilo sa uložiť dochádzku.'
    });
  }
});

router.post('/:id/groups', requireAuth, requireRole('coach', 'admin'), validateBody(upsertTrainingGroupsSchema), async (req, res) => {
  const training = await findTrainingById(req.params.id);
  if (!training) {
    return res.status(404).json({ message: 'Tréning neexistuje.' });
  }

  const incomingGroups = Array.isArray(req.body.groups) ? req.body.groups : [];
  const invalidTimeRange = incomingGroups.some((group) => {
    const hasStart = typeof group.startTime === 'string' && group.startTime.trim().length > 0;
    const hasEnd = typeof group.endTime === 'string' && group.endTime.trim().length > 0;

    if (!hasStart && !hasEnd) {
      return false;
    }

    if (!hasStart || !hasEnd) {
      return true;
    }

    if (!isValidQuarterHourTime(group.startTime) || !isValidQuarterHourTime(group.endTime)) {
      return true;
    }

    return group.startTime >= group.endTime;
  });

  if (invalidTimeRange) {
    return res.status(400).json({ message: 'Každý podtréning musí mať platný čas od-do (po 15 minútach).' });
  }

  const duplicateNames = new Set();
  for (const group of incomingGroups) {
    const normalizedName = String(group.name || '').trim().toLowerCase();
    if (!normalizedName) {
      continue;
    }
    if (duplicateNames.has(normalizedName)) {
      return res.status(400).json({ message: 'Podtréningy musia mať unikátne názvy.' });
    }
    duplicateNames.add(normalizedName);
  }

  const groupsPayload = incomingGroups.map((group) => ({
    name: group.name,
    location: group.location || null,
    note: buildGroupStoredNote(group)
  }));

  const groups = await replaceTrainingGroups(training.id, groupsPayload);
  return res.json({
    items: groups.map((group) => {
      const meta = extractGroupMeta(group.note);
      return {
        id: group.id,
        name: group.name,
        location: group.location,
        note: meta.coachNote,
        startTime: meta.startTime,
        endTime: meta.endTime,
        maxPlayers: meta.maxPlayers
      };
    })
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

    const meta = extractGroupMeta(group.note);
    if (meta.maxPlayers) {
      const currentAttendance = await prisma.trainingAttendance.findUnique({
        where: {
          trainingId_playerUsername: {
            trainingId: training.id,
            playerUsername: req.params.playerUsername
          }
        },
        select: {
          trainingGroupId: true
        }
      });

      const isAlreadyAssigned = currentAttendance && currentAttendance.trainingGroupId === trainingGroupId;
      if (!isAlreadyAssigned) {
        const assignedCount = await prisma.trainingAttendance.count({
          where: {
            trainingId: training.id,
            trainingGroupId
          }
        });

        if (assignedCount >= meta.maxPlayers) {
          return res.status(400).json({ message: `Podtréning ${group.name} je plný (max ${meta.maxPlayers} hráčov).` });
        }
      }
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