const prisma = require('./db');

const PARENT_CHILDREN_SNAPSHOT_ACTION = 'parent_children_snapshot';
const PARENT_CHILDREN_UPDATED_ACTION = 'parent_children_updated';

function isMissingUserEmailColumnError(error) {
  if (!error || error.code !== 'P2022') {
    return false;
  }

  const column = String(error.meta?.column || '').toLowerCase();
  return column.includes('email');
}

function isUnknownUserEmailFieldError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('unknown field') && message.includes('email') && message.includes('user');
}

function isMissingUserShirtNumberColumnError(error) {
  if (!error || error.code !== 'P2022') {
    return false;
  }

  const column = String(error.meta?.column || '').toLowerCase();
  return column.includes('shirtnumber');
}

function isUnknownUserShirtNumberFieldError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('unknown field') && message.includes('shirtnumber') && message.includes('user');
}

function shouldFallbackWithoutEmail(error) {
  return isMissingUserEmailColumnError(error) || isUnknownUserEmailFieldError(error);
}

function shouldFallbackWithoutShirtNumber(error) {
  return isMissingUserShirtNumberColumnError(error) || isUnknownUserShirtNumberFieldError(error);
}

function isMissingTrainingGroupIdColumnError(error) {
  if (!error || error.code !== 'P2022') {
    return false;
  }

  const column = String(error.meta?.column || '').toLowerCase();
  return column.includes('traininggroupid');
}

function isUnknownTrainingGroupIdFieldError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('unknown field') && message.includes('traininggroupid') && message.includes('trainingattendance');
}

function shouldFallbackWithoutTrainingGroupId(error) {
  return isMissingTrainingGroupIdColumnError(error) || isUnknownTrainingGroupIdFieldError(error);
}

function isMissingTrainingGroupTableError(error) {
  if (!error || error.code !== 'P2021') {
    return false;
  }

  const table = String(error.meta?.table || '').toLowerCase();
  return table.includes('traininggroup');
}

function shouldFallbackWithoutTrainingGroups(error) {
  return shouldFallbackWithoutTrainingGroupId(error) || isMissingTrainingGroupTableError(error);
}

function shouldFallbackWithoutBlogPostImageUrl(error) {
  const msg = String(error?.message || '').toLowerCase();
  return (
    error?.code === 'P2022' ||
    error?.code === 'P2009' ||
    msg.includes('imageurl') ||
    msg.includes('tags') ||
    msg.includes('unknown field') ||
    msg.includes('does not exist')
  );
}

function withNullEmail(items) {
  return items.map((item) => ({
    ...item,
    email: null
  }));
}

function withNullShirtNumber(items) {
  return items.map((item) => ({
    ...item,
    shirtNumber: null
  }));
}

function normalizeIdList(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean)));
}

function extractChildIdsFromAuditDetails(details, expectedParentId) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return [];
  }

  const rawParentId = String(details.parentId || '').trim();
  if (rawParentId && expectedParentId && rawParentId !== expectedParentId) {
    return [];
  }

  return normalizeIdList(details.childIds);
}

async function getParentChildSnapshotMap(parentIds) {
  const cleanParentIds = normalizeIdList(parentIds);
  if (!cleanParentIds.length) {
    return new Map();
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      entityType: 'user',
      entityId: {
        in: cleanParentIds
      },
      action: {
        in: [PARENT_CHILDREN_SNAPSHOT_ACTION, PARENT_CHILDREN_UPDATED_ACTION]
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    select: {
      entityId: true,
      details: true
    }
  });

  const map = new Map();
  logs.forEach((log) => {
    const parentId = String(log.entityId || '').trim();
    if (!parentId || map.has(parentId)) {
      return;
    }

    map.set(parentId, extractChildIdsFromAuditDetails(log.details, parentId));
  });

  return map;
}

async function listActivePlayerChildrenByIds(childIds, client = prisma) {
  const uniqueChildIds = normalizeIdList(childIds);
  if (!uniqueChildIds.length) {
    return [];
  }

  const rows = await client.user.findMany({
    where: {
      id: {
        in: uniqueChildIds
      },
      role: 'player',
      isActive: true
    },
    select: {
      id: true,
      username: true,
      playerCategory: true,
      isActive: true
    }
  });

  const byId = new Map(rows.map((row) => [row.id, row]));
  return uniqueChildIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .sort((a, b) => a.username.localeCompare(b.username));
}

async function attachParentChildrenFromAudit(rows, parentIds) {
  const snapshotMap = await getParentChildSnapshotMap(parentIds);
  const allChildIds = normalizeIdList(Array.from(snapshotMap.values()).flat());
  const children = await listActivePlayerChildrenByIds(allChildIds);
  const childById = new Map(children.map((child) => [child.id, child]));

  return rows.map((row) => {
    if (row.role !== 'parent') {
      return row;
    }

    const snapshotIds = snapshotMap.get(row.id) || [];
    const linkedChildren = snapshotIds
      .map((childId) => childById.get(childId))
      .filter(Boolean);

    return {
      ...row,
      children: linkedChildren
    };
  });
}

async function attachParentChildren(users) {
  const rows = users.map((user) => ({
    ...user,
    children: []
  }));

  const parentIds = rows
    .filter((user) => user.role === 'parent')
    .map((user) => user.id);

  if (!parentIds.length) {
    return rows;
  }

  if (!prisma.parentChild) {
    return attachParentChildrenFromAudit(rows, parentIds);
  }

  try {
    const links = await prisma.parentChild.findMany({
      where: {
        parentId: {
          in: parentIds
        }
      },
      include: {
        child: {
          select: {
            id: true,
            username: true,
            playerCategory: true,
            isActive: true
          }
        }
      }
    });

    const grouped = new Map();
    links.forEach((link) => {
      if (!link.child) {
        return;
      }

      if (!grouped.has(link.parentId)) {
        grouped.set(link.parentId, []);
      }

      grouped.get(link.parentId).push({
        id: link.child.id,
        username: link.child.username,
        playerCategory: link.child.playerCategory,
        isActive: link.child.isActive
      });
    });

    return rows.map((row) => {
      if (row.role !== 'parent') {
        return row;
      }

      const children = grouped.get(row.id) || [];
      children.sort((a, b) => a.username.localeCompare(b.username));
      return {
        ...row,
        children
      };
    });
  } catch (error) {
    if (error && (error.code === 'P2021' || error.code === 'P2022')) {
      return attachParentChildrenFromAudit(rows, parentIds);
    }

    throw error;
  }
}

async function findUserByUsername(username) {
  const exactUsername = String(username || '');
  if (!exactUsername) {
    return null;
  }

  // Optimize: limit the DB search to only active accounts so the DB ignores deactivated rows
  return prisma.user.findFirst({
    where: {
      username: exactUsername
    },
    select: {
      id: true,
      username: true,
      passwordHash: true,
      role: true,
      playerCategory: true,
      isActive: true
    }
  });
}

async function findUserById(id) {
  try {
    return await prisma.user.findUnique({
      where: { id }
    });
  } catch (error) {
    if (!shouldFallbackWithoutEmail(error) && !shouldFallbackWithoutShirtNumber(error)) {
      throw error;
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        role: true,
        playerCategory: true,
        passwordHash: true,
        lastPasswordChangeAt: true,
        isActive: true,
        createdAt: true
      }
    });

    if (!user) {
      return null;
    }

    return {
      ...user,
      email: null,
      shirtNumber: null
    };
  }
}

async function listUsersForManagement() {
  try {
    const rows = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        playerCategory: true,
        shirtNumber: true,
        isActive: true,
        createdAt: true,
        lastPasswordChangeAt: true
      }
    });

    return attachParentChildren(rows);
  } catch (error) {
    if (!shouldFallbackWithoutEmail(error) && !shouldFallbackWithoutShirtNumber(error)) {
      throw error;
    }

    const rows = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        username: true,
        role: true,
        playerCategory: true,
        isActive: true,
        createdAt: true,
        lastPasswordChangeAt: true
      }
    });

    return attachParentChildren(withNullShirtNumber(withNullEmail(rows)));
  }
}

async function countUsersByRole(role, excludeUserId = null) {
  return prisma.user.count({
    where: {
      role,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {})
    }
  });
}

async function createManagedUser(input) {
  try {
    return await prisma.user.create({
      data: input,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        playerCategory: true,
        shirtNumber: true,
        isActive: true,
        createdAt: true,
        lastPasswordChangeAt: true
      }
    });
  } catch (error) {
    const missingEmail = shouldFallbackWithoutEmail(error);
    const missingShirtNumber = shouldFallbackWithoutShirtNumber(error);
    if (!missingEmail && !missingShirtNumber) {
      throw error;
    }

    const fallbackInput = { ...input };
    if (missingEmail) {
      delete fallbackInput.email;
    }
    if (missingShirtNumber) {
      delete fallbackInput.shirtNumber;
    }

    let row;
    try {
      row = await prisma.user.create({
        data: fallbackInput,
        select: {
          id: true,
          username: true,
          role: true,
          playerCategory: true,
          isActive: true,
          createdAt: true,
          lastPasswordChangeAt: true
        }
      });
    } catch (fallbackError) {
      const fallbackMessage = String(fallbackError?.message || '').toLowerCase();
      if (missingEmail && fallbackMessage.includes('email') && fallbackMessage.includes('argument')) {
        const schemaError = new Error('Databáza nie je zosynchronizovaná so serverom (chýba stĺpec email). Spustite migráciu Prisma na produkčnej DB.');
        schemaError.status = 500;
        throw schemaError;
      }
      throw fallbackError;
    }

    return {
      ...row,
      email: missingEmail ? null : input.email,
      shirtNumber: null
    };
  }
}

async function setUserActiveStatus(id, isActive) {
  try {
    return await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        playerCategory: true,
        shirtNumber: true,
        isActive: true,
        createdAt: true,
        lastPasswordChangeAt: true
      }
    });
  } catch (error) {
    if (!shouldFallbackWithoutEmail(error) && !shouldFallbackWithoutShirtNumber(error)) {
      throw error;
    }

    const row = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        username: true,
        role: true,
        playerCategory: true,
        isActive: true,
        createdAt: true,
        lastPasswordChangeAt: true
      }
    });

    return {
      ...row,
      email: null,
      shirtNumber: null
    };
  }
}

async function resetUserPasswordByAdmin(id, passwordHash) {
  try {
    return await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        lastPasswordChangeAt: null
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        playerCategory: true,
        shirtNumber: true,
        isActive: true,
        createdAt: true,
        lastPasswordChangeAt: true
      }
    });
  } catch (error) {
    if (!shouldFallbackWithoutEmail(error) && !shouldFallbackWithoutShirtNumber(error)) {
      throw error;
    }

    const row = await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        lastPasswordChangeAt: null
      },
      select: {
        id: true,
        username: true,
        role: true,
        playerCategory: true,
        isActive: true,
        createdAt: true,
        lastPasswordChangeAt: true
      }
    });

    return {
      ...row,
      email: null,
      shirtNumber: null
    };
  }
}

async function updateUserRoleAndCategory(id, username, email, role, playerCategory, shirtNumber) {
  try {
    return await prisma.user.update({
      where: { id },
      data: {
        username,
        email,
        role,
        playerCategory,
        shirtNumber
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        playerCategory: true,
        shirtNumber: true,
        isActive: true,
        createdAt: true,
        lastPasswordChangeAt: true
      }
    });
  } catch (error) {
    const missingEmail = shouldFallbackWithoutEmail(error);
    const missingShirtNumber = shouldFallbackWithoutShirtNumber(error);
    if (!missingEmail && !missingShirtNumber) {
      throw error;
    }

    const fallbackData = {
      username,
      email,
      role,
      playerCategory,
      shirtNumber
    };
    if (missingEmail) {
      delete fallbackData.email;
    }
    if (missingShirtNumber) {
      delete fallbackData.shirtNumber;
    }

    const row = await prisma.user.update({
      where: { id },
      data: fallbackData,
      select: {
        id: true,
        username: true,
        role: true,
        playerCategory: true,
        isActive: true,
        createdAt: true,
        lastPasswordChangeAt: true
      }
    });

    return {
      ...row,
      email: missingEmail ? null : email,
      shirtNumber: null
    };
  }
}

async function updateUserPassword(id, passwordHash) {
  return prisma.user.update({
    where: { id },
    data: {
      passwordHash,
      lastPasswordChangeAt: new Date()
    }
  });
}

async function listActivePlayers() {
  try {
    return await prisma.user.findMany({
      where: {
        role: 'player',
        isActive: true
      },
      orderBy: [
        { playerCategory: 'asc' },
        { username: 'asc' }
      ],
      select: {
        id: true,
        username: true,
        playerCategory: true,
        shirtNumber: true
      }
    });
  } catch (error) {
    if (!shouldFallbackWithoutShirtNumber(error)) {
      throw error;
    }

    const rows = await prisma.user.findMany({
      where: {
        role: 'player',
        isActive: true
      },
      orderBy: [
        { playerCategory: 'asc' },
        { username: 'asc' }
      ],
      select: {
        id: true,
        username: true,
        playerCategory: true
      }
    });

    return withNullShirtNumber(rows);
  }
}

async function listParentChildrenByParentId(parentId) {
  if (!parentId) {
    return [];
  }

  if (!prisma.parentChild) {
    const snapshotMap = await getParentChildSnapshotMap([parentId]);
    const childIds = snapshotMap.get(parentId) || [];
    return listActivePlayerChildrenByIds(childIds);
  }

  try {
    const links = await prisma.parentChild.findMany({
      where: {
        parentId
      },
      include: {
        child: {
          select: {
            id: true,
            username: true,
            playerCategory: true,
            isActive: true
          }
        }
      }
    });

    return links
      .map((link) => link.child)
      .filter(Boolean)
      .sort((a, b) => a.username.localeCompare(b.username));
  } catch (error) {
    if (error && (error.code === 'P2021' || error.code === 'P2022')) {
      const snapshotMap = await getParentChildSnapshotMap([parentId]);
      const childIds = snapshotMap.get(parentId) || [];
      return listActivePlayerChildrenByIds(childIds);
    }

    throw error;
  }
}

async function setParentChildren(parentId, childIds) {
  const uniqueChildIds = normalizeIdList(childIds);

  async function validateParentAndChildren(client) {
    const parent = await client.user.findUnique({
      where: { id: parentId },
      select: {
        id: true,
        username: true,
        role: true
      }
    });

    if (!parent) {
      const notFound = new Error('Používateľ neexistuje.');
      notFound.status = 404;
      throw notFound;
    }

    if (parent.role !== 'parent') {
      const invalidRole = new Error('Deti je možné priradiť iba používateľovi s rolou rodič.');
      invalidRole.status = 400;
      throw invalidRole;
    }

    const children = await listActivePlayerChildrenByIds(uniqueChildIds, client);
    if (children.length !== uniqueChildIds.length) {
      const invalidChildren = new Error('Niektoré vybrané deti neexistujú alebo nie sú aktívni hráči.');
      invalidChildren.status = 400;
      throw invalidChildren;
    }

    return { parent, children };
  }

  async function persistSnapshot(client, parent, children) {
    await client.auditLog.create({
      data: {
        action: PARENT_CHILDREN_SNAPSHOT_ACTION,
        entityType: 'user',
        entityId: parent.id,
        details: {
          parentId: parent.id,
          childIds: children.map((child) => child.id)
        }
      }
    });
  }

  if (!prisma.parentChild) {
    const validated = await validateParentAndChildren(prisma);
    await persistSnapshot(prisma, validated.parent, validated.children);
    return validated;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const validated = await validateParentAndChildren(tx);

      await tx.parentChild.deleteMany({
        where: {
          parentId
        }
      });

      if (validated.children.length) {
        await tx.parentChild.createMany({
          data: validated.children.map((child) => ({
            parentId,
            childId: child.id
          })),
          skipDuplicates: true
        });
      }

      await persistSnapshot(tx, validated.parent, validated.children);
      return validated;
    });
  } catch (error) {
    if (!error || (error.code !== 'P2021' && error.code !== 'P2022')) {
      throw error;
    }

    const validated = await validateParentAndChildren(prisma);
    await persistSnapshot(prisma, validated.parent, validated.children);
    return validated;
  }
}

function playerCategoriesForTrainingCategory(trainingCategory) {
  const map = {
    dospeli: ['adults_young', 'adults_pro'],
    dorastenci: ['dorastenci'],
    ziaci_u15: ['ziaci'],
    ziaci_u13: ['ziaci'],
    pripravka_u11: ['pripravka_u11'],
    pripravka_u9: ['pripravka_u9']
  };

  return map[trainingCategory] || [];
}

function trainingCategoriesForPlayerCategory(playerCategory) {
  const map = {
    pripravka_u9: ['pripravka_u9'],
    pripravka_u11: ['pripravka_u11'],
    ziaci: ['ziaci_u15', 'ziaci_u13'],
    dorastenci: ['dorastenci'],
    adults_young: ['dospeli'],
    adults_pro: ['dospeli']
  };

  return map[playerCategory] || [];
}

function getTrainingEndDateTime(training) {
  if (!training?.date || !training?.time) {
    return null;
  }

  const start = new Date(`${training.date}T${training.time}`);
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const durationMinutes = Number(training.duration);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return null;
  }

  return new Date(start.getTime() + durationMinutes * 60 * 1000);
}

async function closeExpiredTrainings() {
  const activeTrainings = await prisma.training.findMany({
    where: {
      isActive: true
    },
    select: {
      id: true,
      date: true,
      time: true,
      duration: true
    }
  });

  const now = new Date();
  const expiredIds = activeTrainings
    .filter((training) => {
      const end = getTrainingEndDateTime(training);
      return end && end <= now;
    })
    .map((training) => training.id);

  if (!expiredIds.length) {
    return;
  }

  await prisma.training.updateMany({
    where: {
      id: {
        in: expiredIds
      },
      isActive: true
    },
    data: {
      isActive: false
    }
  });
}

async function listActivePlayerEmailsByTrainingCategory(trainingCategory) {
  const playerCategories = playerCategoriesForTrainingCategory(trainingCategory);
  if (!playerCategories.length) {
    return [];
  }

  return prisma.user.findMany({
    where: {
      role: 'player',
      email: {
        not: ''
      },
      playerCategory: {
        in: playerCategories
      }
    },
    orderBy: {
      username: 'asc'
    },
    select: {
      username: true,
      email: true,
      playerCategory: true
    }
  });
}

async function listTrainings(viewerUser) {
  await closeExpiredTrainings();

  const where = {};

  if (viewerUser?.role === 'player') {
    const allowedCategories = trainingCategoriesForPlayerCategory(viewerUser.playerCategory);
    if (!allowedCategories.length) {
      return [];
    }

    where.category = {
      in: allowedCategories
    };
  }

  if (viewerUser?.role === 'parent') {
    const children = await listParentChildrenByParentId(viewerUser.id);
    const allowedCategories = Array.from(new Set(
      children
        .map((child) => trainingCategoriesForPlayerCategory(child.playerCategory))
        .flat()
        .filter(Boolean)
    ));

    if (!allowedCategories.length) {
      return [];
    }

    where.category = {
      in: allowedCategories
    };
  }

  try {
    return await prisma.training.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        attendances: {
          select: {
            playerUsername: true,
            status: true,
            updatedAt: true,
            trainingGroupId: true
          }
        },
        groups: {
          select: {
            id: true,
            name: true,
            location: true,
            note: true
          }
        }
      }
    });
  } catch (error) {
    if (shouldFallbackWithoutTrainingGroups(error)) {
      return prisma.training.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          attendances: {
            select: {
              playerUsername: true,
              status: true,
              updatedAt: true
            }
          }
        }
      });
    }

    // Production fallback for partially migrated databases: return base trainings
    // instead of failing the whole page when relation tables are unavailable.
    console.error('listTrainings fallback to base query:', error);
    return prisma.training.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        date: true,
        time: true,
        type: true,
        duration: true,
        category: true,
        note: true,
        isActive: true,
        createdAt: true,
        createdById: true
      }
    });
  }
}

async function findTrainingById(id) {
  return prisma.training.findUnique({
    where: { id }
  });
}

async function createTraining(input, createdById) {
  const createdTraining = await prisma.$transaction(async (tx) => {
    const training = await tx.training.create({
      data: {
        ...input,
        createdById
      }
    });

    const playerCategories = playerCategoriesForTrainingCategory(input.category);
    if (playerCategories.length) {
      const players = await tx.user.findMany({
        where: {
          role: 'player',
          isActive: true,
          playerCategory: {
            in: playerCategories
          }
        },
        select: {
          username: true
        }
      });

      if (players.length) {
        await tx.trainingAttendance.createMany({
          data: players.map((player) => ({
            trainingId: training.id,
            playerUsername: player.username,
            status: 'unknown',
            updatedById: createdById
          })),
          skipDuplicates: true
        });
      }
    }

    return training;
  });

  return prisma.training.findUnique({
    where: { id: createdTraining.id },
    include: {
      createdBy: {
        select: { username: true }
      }
    }
  });
}

async function closeTraining(id) {
  return prisma.training.update({
    where: { id },
    data: {
      isActive: false
    }
  });
}

async function updateTraining(id, input) {
  return prisma.training.update({
    where: { id },
    data: {
      date: input.date,
      time: input.time,
      type: input.type,
      duration: input.duration,
      category: input.category,
      note: input.note || null
    },
    include: {
      createdBy: {
        select: { username: true }
      }
    }
  });
}

async function deleteTraining(id) {
  return prisma.$transaction(async (tx) => {
    await tx.trainingAttendance.deleteMany({
      where: {
        trainingId: id
      }
    });

    return tx.training.delete({
      where: { id }
    });
  });
}

async function upsertTrainingAttendance(trainingId, playerUsername, status, updatedById) {
  try {
    return await prisma.trainingAttendance.upsert({
      where: {
        trainingId_playerUsername: {
          trainingId,
          playerUsername
        }
      },
      update: {
        status,
        updatedById
      },
      create: {
        trainingId,
        playerUsername,
        status,
        updatedById
      },
      select: {
        id: true,
        trainingId: true,
        playerUsername: true,
        status: true,
        updatedAt: true
      }
    });
  } catch (error) {
    if (!shouldFallbackWithoutTrainingGroupId(error)) {
      throw error;
    }

    const uniqueWhere = {
      trainingId_playerUsername: {
        trainingId,
        playerUsername
      }
    };

    const existing = await prisma.trainingAttendance.findUnique({
      where: uniqueWhere,
      select: {
        id: true
      }
    });

    if (existing) {
      return prisma.trainingAttendance.update({
        where: uniqueWhere,
        data: {
          status,
          updatedById
        },
        select: {
          id: true,
          trainingId: true,
          playerUsername: true,
          status: true,
          updatedAt: true
        }
      });
    }

    return prisma.trainingAttendance.create({
      data: {
        trainingId,
        playerUsername,
        status,
        updatedById
      },
      select: {
        id: true,
        trainingId: true,
        playerUsername: true,
        status: true,
        updatedAt: true
      }
    });
  }
}

async function replaceTrainingGroups(trainingId, groupsInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.trainingGroup.deleteMany({
        where: {
          trainingId
        }
      });

      if (!Array.isArray(groupsInput) || !groupsInput.length) {
        return [];
      }

      const created = await Promise.all(
        groupsInput.map((group) =>
          tx.trainingGroup.create({
            data: {
              trainingId,
              name: group.name,
              location: group.location || null,
              note: group.note || null
            }
          })
        )
      );

      return created;
    });
  } catch (error) {
    if (!shouldFallbackWithoutTrainingGroups(error)) {
      throw error;
    }

    const unavailable = new Error('Podtréningy zatiaľ nie sú dostupné. Databáza čaká na migráciu.');
    unavailable.status = 400;
    throw unavailable;
  }
}

async function updateTrainingAttendanceGroup(trainingId, playerUsername, trainingGroupId, updatedById) {
  try {
    const uniqueWhere = {
      trainingId_playerUsername: {
        trainingId,
        playerUsername
      }
    };

    const existing = await prisma.trainingAttendance.findUnique({
      where: uniqueWhere,
      select: {
        id: true,
        status: true
      }
    });

    if (existing) {
      return await prisma.trainingAttendance.update({
        where: uniqueWhere,
        data: {
          trainingGroupId: trainingGroupId || null,
          updatedById
        }
      });
    }

    return await prisma.trainingAttendance.create({
      data: {
        trainingId,
        playerUsername,
        status: 'unknown',
        trainingGroupId: trainingGroupId || null,
        updatedById
      }
    });
  } catch (error) {
    if (!shouldFallbackWithoutTrainingGroups(error)) {
      throw error;
    }

    const unavailable = new Error('Podtréningy zatiaľ nie sú dostupné. Databáza čaká na migráciu.');
    unavailable.status = 400;
    throw unavailable;
  }
}

async function listAnnouncements() {
  return prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: {
        select: { username: true }
      }
    }
  });
}

async function createAnnouncement(input, createdById) {
  return prisma.announcement.create({
    data: {
      ...input,
      createdById
    },
    include: {
      createdBy: {
        select: { username: true }
      }
    }
  });
}

async function deleteAnnouncement(id) {
  return prisma.announcement.delete({
    where: { id }
  });
}

async function listPublicAnnouncements() {
  try {
    return await prisma.announcement.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        createdBy: {
          select: { username: true }
        }
      }
    });
  } catch (error) {
    if (String(error.message).includes('isPublic') || String(error.message).includes('Unknown arg')) {
      return [];
    }
    throw error;
  }
}

async function listBlogPosts() {
  if (!prisma.blogPost) {
    throw new Error('Prisma Client neobsahuje model blogPost. Spustite prisma generate a redeploy backendu.');
  }

  const select = {
    id: true,
    title: true,
    content: true,
    imageUrl: true,
    tags: true,
    published: true,
    createdAt: true,
    updatedAt: true,
    createdBy: {
      select: { username: true }
    }
  };

  try {
    return await prisma.blogPost.findMany({
      orderBy: { createdAt: 'desc' },
      select
    });
  } catch (error) {
    if (!shouldFallbackWithoutBlogPostImageUrl(error)) {
      throw error;
    }

    // Fallback: missing imageUrl or tags column
    const fallbackSelect = { ...select };
    delete fallbackSelect.imageUrl;
    delete fallbackSelect.tags;

    const rows = await prisma.blogPost.findMany({
      orderBy: { createdAt: 'desc' },
      select: fallbackSelect
    });

    return rows.map(r => ({ ...r, imageUrl: null, tags: [] }));
  }
}

async function createBlogPost(input, createdById) {
  if (!prisma.blogPost) {
    throw new Error('Prisma Client neobsahuje model blogPost. Spustite prisma generate a redeploy backendu.');
  }

  try {
    return await prisma.blogPost.create({
      data: {
        title: input.title,
        content: input.content,
        imageUrl: input.imageUrl || null,
        tags: input.tags || [],
        published: input.published ?? true,
        createdById
      },
      include: {
        createdBy: {
          select: { username: true }
        }
      }
    }).catch(async (error) => {
      // Robust fallback if database column is missing
      if (error.message && (error.message.includes('tags') || error.message.includes('imageUrl'))) {
        const minimalData = {
          title: input.title,
          content: input.content,
          published: input.published ?? true,
          createdById
        };
        // Only include imageUrl if error wasn't about it
        if (!error.message.includes('imageUrl')) {
           minimalData.imageUrl = input.imageUrl || null;
        }
        // Only include tags if error wasn't about it
        if (!error.message.includes('tags')) {
           minimalData.tags = input.tags || [];
        }

        return prisma.blogPost.create({
          data: minimalData,
          include: {
            createdBy: {
              select: { username: true }
            }
          }
        });
      }
      throw error;
    });
  } catch (error) {
    if (!shouldFallbackWithoutBlogPostImageUrl(error)) {
      throw error;
    }

    // Fallback: missing imageUrl or tags column
    const row = await prisma.blogPost.create({
      data: {
        title: input.title,
        content: input.content,
        published: input.published ?? true,
        createdById
      },
      include: {
        createdBy: {
          select: { username: true }
        }
      }
    });

    return { ...row, imageUrl: null, tags: [] };
  }
}

async function findBlogPostById(id) {
  if (!prisma.blogPost) {
    throw new Error('Prisma Client neobsahuje model blogPost. Spustite prisma generate a redeploy backendu.');
  }

  const include = {
    createdBy: {
      select: { username: true }
    }
  };

  try {
    return await prisma.blogPost.findUnique({
      where: { id },
      include
    });
  } catch (error) {
    if (!shouldFallbackWithoutBlogPostImageUrl(error)) {
      throw error;
    }

    // Fallback: missing imageUrl column
    const row = await prisma.blogPost.findUnique({
      where: { id },
      include
    });

    return { ...row, imageUrl: null };
  }
}

async function deleteBlogPost(id) {
  if (!prisma.blogPost) {
    throw new Error('Prisma Client neobsahuje model blogPost. Spustite prisma generate a redeploy backendu.');
  }

  return prisma.blogPost.delete({
    where: { id }
  });
}

async function listPolls() {
  return prisma.poll.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: {
        select: { username: true }
      },
      votes: {
        select: {
          optionIdx: true,
          userId: true,
          user: {
            select: { username: true }
          }
        }
      }
    }
  });
}

async function createPoll(input, createdById) {
  return prisma.poll.create({
    data: {
      question: input.question,
      options: input.options,
      target: input.target,
      playerCategory: input.playerCategory,
      closesAt: input.closesAt || null,
      createdById
    },
    include: {
      createdBy: {
        select: { username: true }
      },
      votes: {
        select: {
          optionIdx: true,
          userId: true,
          user: {
            select: { username: true }
          }
        }
      }
    }
  });
}

async function findPollById(id) {
  return prisma.poll.findUnique({
    where: { id }
  });
}

async function deletePoll(id) {
  return prisma.poll.delete({
    where: { id }
  });
}

async function closePoll(id) {
  return prisma.poll.update({
    where: { id },
    data: {
      active: false,
      closedAt: new Date()
    }
  });
}

async function upsertPollVote(pollId, userId, optionIdx) {
  return prisma.pollVote.upsert({
    where: {
      pollId_userId: {
        pollId,
        userId
      }
    },
    update: {
      optionIdx
    },
    create: {
      pollId,
      userId,
      optionIdx
    }
  });
}

async function createAuditLog(input) {
  const allowedActions = new Set([
    'login_success',
    'admin_login_failed_attempt',
    'announcement_created',
    'announcement_deleted',
    'poll_created',
    'poll_deleted',
    'training_created',
    'training_deleted',
    'player_group_created',
    'player_group_deleted'
  ]);

  const action = String(input && input.action ? input.action : '').trim();
  if (!allowedActions.has(action)) {
    return null;
  }

  return prisma.auditLog.create({
    data: input
  });
}

// ======== Player Groups ========

async function listPlayerGroups() {
  try {
    return await prisma.playerGroup.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { username: true } },
        members: { select: { playerUsername: true } }
      }
    });
  } catch (error) {
    if (String(error.message).includes('playerGroup') || String(error.code) === 'P2021') {
      return [];
    }
    throw error;
  }
}

async function createPlayerGroup(name, playerUsernames, createdById) {
  return prisma.playerGroup.create({
    data: {
      name,
      createdById,
      members: {
        create: playerUsernames.map((username) => ({ playerUsername: username }))
      }
    },
    include: {
      createdBy: { select: { username: true } },
      members: { select: { playerUsername: true } }
    }
  });
}

async function findPlayerGroupById(id) {
  return prisma.playerGroup.findUnique({
    where: { id },
    include: {
      createdBy: { select: { username: true } },
      members: { select: { playerUsername: true } }
    }
  });
}

async function deletePlayerGroup(id) {
  return prisma.playerGroup.delete({
    where: { id }
  });
}

module.exports = {
  findUserByUsername,
  findUserById,
  listUsersForManagement,
  countUsersByRole,
  createManagedUser,
  setUserActiveStatus,
  resetUserPasswordByAdmin,
  updateUserRoleAndCategory,
  updateUserPassword,
  listActivePlayers,
  listParentChildrenByParentId,
  setParentChildren,
  listActivePlayerEmailsByTrainingCategory,
  closeExpiredTrainings,
  listTrainings,
  findTrainingById,
  createTraining,
  updateTraining,
  closeTraining,
  deleteTraining,
  upsertTrainingAttendance,
  replaceTrainingGroups,
  updateTrainingAttendanceGroup,
  listAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  listPublicAnnouncements,
  listBlogPosts,
  createBlogPost,
  findBlogPostById,
  deleteBlogPost,
  listPolls,
  createPoll,
  findPollById,
  closePoll,
  deletePoll,
  upsertPollVote,
  createAuditLog,
  listPlayerGroups,
  createPlayerGroup,
  findPlayerGroupById,
  deletePlayerGroup
};