const express = require('express');
const { z } = require('zod');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const {
  listPolls,
  createPoll,
  findPollById,
  closePoll,
  deletePoll,
  upsertPollVote,
  createAuditLog
} = require('../data/repository');

const router = express.Router();

const createPollSchema = z.object({
  question: z.string().min(5).max(500),
  options: z.array(z.string().min(1).max(200)).min(2).max(10),
  target: z.enum(['all', 'players', 'parents', 'coaches', 'admins']),
  playerCategory: z.enum(['pripravka_u9', 'pripravka_u11', 'ziaci', 'dorastenci', 'adults_young', 'adults_pro']).nullable().optional(),
  closesAt: z.string().datetime().optional()
});

const voteSchema = z.object({
  optionIndex: z.number().int().min(0)
});

async function writeAuditSafe(payload) {
  try {
    await createAuditLog(payload);
  } catch (error) {
    console.error('Audit log write failed:', error);
  }
}

function hasQuarterHourMinutes(date) {
  return date.getUTCMinutes() % 15 === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
}

function parseAndValidateClosesAt(rawValue) {
  if (!rawValue) {
    return null;
  }

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error('Neplatný čas ukončenia ankety.');
    error.status = 400;
    throw error;
  }

  if (!hasQuarterHourMinutes(parsed)) {
    const error = new Error('Čas ukončenia ankety musí byť po 15 minútach (00, 15, 30, 45).');
    error.status = 400;
    throw error;
  }

  if (parsed.getTime() <= Date.now()) {
    const error = new Error('Čas ukončenia ankety musí byť v budúcnosti.');
    error.status = 400;
    throw error;
  }

  return parsed;
}

async function ensurePollClosedIfExpired(poll) {
  if (!poll || !poll.active || !poll.closesAt) {
    return poll;
  }

  const closesAt = new Date(poll.closesAt);
  if (Number.isNaN(closesAt.getTime())) {
    return poll;
  }

  if (Date.now() < closesAt.getTime()) {
    return poll;
  }

  const closed = await closePoll(poll.id);
  return {
    ...poll,
    active: closed.active,
    closedAt: closed.closedAt
  };
}

router.get('/', requireAuth, async (req, res) => {
  const rows = await listPolls();
  const rowsWithState = await Promise.all(rows.map((row) => ensurePollClosedIfExpired(row)));
  const visibleRows = rowsWithState.filter((row) => {
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

  const items = visibleRows.map((row) => {
    const results = new Array(row.options.length).fill(0);
    let selectedOption = null;

    row.votes.forEach((vote) => {
      if (results[vote.optionIdx] !== undefined) {
        results[vote.optionIdx] += 1;
      }
      if (vote.userId === req.user.id) {
        selectedOption = vote.optionIdx;
      }
    });

    return {
      id: row.id,
      question: row.question,
      options: row.options,
      target: row.target,
      playerCategory: row.playerCategory,
      active: row.active,
      closesAt: row.closesAt,
      closedAt: row.closedAt,
      createdAt: row.createdAt,
      createdBy: row.createdBy.username,
      results,
      totalVotes: row.votes.length,
      selectedOption
    };
  });

  return res.json({ items });
});

router.post('/', requireAuth, requireRole('coach', 'admin'), validateBody(createPollSchema), async (req, res) => {
  if (req.body.target !== 'players' && req.body.playerCategory) {
    return res.status(400).json({ message: 'Kategóriu hráčov je možné zvoliť len pre cieľ Hráči.' });
  }

  let closesAt;
  try {
    closesAt = parseAndValidateClosesAt(req.body.closesAt);
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message || 'Neplatný čas ukončenia ankety.' });
  }

  const input = {
    ...req.body,
    playerCategory: req.body.target === 'players' ? (req.body.playerCategory || null) : null,
    closesAt: closesAt ? closesAt.toISOString() : null
  };

  const row = await createPoll(input, req.user.id);
  const item = {
    id: row.id,
    question: row.question,
    options: row.options,
    target: row.target,
    playerCategory: row.playerCategory,
    active: row.active,
    closesAt: row.closesAt,
    closedAt: row.closedAt,
    createdAt: row.createdAt,
    createdBy: row.createdBy.username,
    results: new Array(row.options.length).fill(0),
    totalVotes: 0,
    selectedOption: null
  };

  await writeAuditSafe({
    actorUserId: req.user.id,
    action: 'poll_created',
    entityType: 'poll',
    entityId: row.id,
    details: {
      question: row.question,
      target: row.target,
      playerCategory: row.playerCategory,
      closesAt: row.closesAt
    }
  });

  return res.status(201).json({ item });
});

async function handlePollVote(req, res) {
  if (req.user.role === 'coach' || req.user.role === 'admin') {
    return res.status(403).json({ message: 'Tréner/Admin nemôže hlasovať v ankete.' });
  }

  const pollRaw = await findPollById(req.params.id);
  const poll = await ensurePollClosedIfExpired(pollRaw);
  if (!poll) {
    return res.status(404).json({ message: 'Anketa neexistuje.' });
  }

  if (!poll.active) {
    return res.status(400).json({ message: 'Anketa je uzavretá.' });
  }

  if (req.body.optionIndex < 0 || req.body.optionIndex >= poll.options.length) {
    return res.status(400).json({ message: 'Neplatná možnosť hlasovania.' });
  }

  await upsertPollVote(poll.id, req.user.id, req.body.optionIndex);

  await writeAuditSafe({
    actorUserId: req.user.id,
    action: 'poll_voted',
    entityType: 'poll',
    entityId: poll.id,
    details: {
      optionIndex: req.body.optionIndex
    }
  });

  return res.status(204).send();
}

router.post('/:id/vote', requireAuth, validateBody(voteSchema), handlePollVote);
router.post('/:id/votes', requireAuth, validateBody(voteSchema), handlePollVote);

router.patch('/:id/close', requireAuth, requireRole('coach', 'admin'), async (req, res) => {
  const poll = await findPollById(req.params.id);
  if (!poll) {
    return res.status(404).json({ message: 'Anketa neexistuje.' });
  }

  if (!poll.active) {
    return res.status(400).json({ message: 'Anketa je už uzavretá.' });
  }

  const row = await closePoll(req.params.id);

  await writeAuditSafe({
    actorUserId: req.user.id,
    action: 'poll_closed',
    entityType: 'poll',
    entityId: row.id,
    details: null
  });

  return res.json({
    item: {
      id: row.id,
      active: row.active
    }
  });
});

router.delete('/:id', requireAuth, requireRole('coach', 'admin'), async (req, res) => {
  await writeAuditSafe({
    actorUserId: req.user.id,
    action: 'poll_deleted',
    entityType: 'poll',
    entityId: req.params.id,
    details: null
  });
  await deletePoll(req.params.id);
  return res.status(204).send();
});

module.exports = router;
