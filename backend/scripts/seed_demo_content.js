const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const announcementsData = [
  {
    title: 'Zmena času tréningu',
    message: 'Štvrtkový tréning sa presúva na 18:30 z dôvodu obsadenia ihriska.',
    target: 'all',
    playerCategory: null,
    important: true
  },
  {
    title: 'Info pre žiakov',
    message: 'Prosíme hráčov kategórie Žiaci, aby prišli o 15 min skôr na rozcvičku.',
    target: 'players',
    playerCategory: 'ziaci',
    important: false
  },
  {
    title: 'Stretnutie s rodičmi',
    message: 'V utorok po tréningu bude krátke stretnutie rodičov s trénermi.',
    target: 'parents',
    playerCategory: null,
    important: false
  }
];

const pollsData = [
  {
    question: 'Ktorý čas tréningu vám viac vyhovuje?',
    options: ['17:00', '18:00', '19:00'],
    target: 'players',
    playerCategory: 'ziaci'
  },
  {
    question: 'Má klub organizovať spoločné sústredenie počas leta?',
    options: ['Áno', 'Nie'],
    target: 'all',
    playerCategory: null
  }
];

const trainingsData = [
  {
    date: '2026-02-24',
    time: '17:00',
    type: 'technical',
    duration: 90,
    category: 'ziaci'
  },
  {
    date: '2026-02-25',
    time: '18:00',
    type: 'tactical',
    duration: 90,
    category: 'dorastenci'
  },
  {
    date: '2026-02-27',
    time: '18:30',
    type: 'physical',
    duration: 75,
    category: 'adults_young'
  }
];

async function getCoachUser() {
  const coach = await prisma.user.findFirst({
    where: { role: 'coach', isActive: true },
    orderBy: { createdAt: 'asc' }
  });

  if (!coach) {
    throw new Error('Nebol nájdený žiadny aktívny tréner v tabuľke User.');
  }

  return coach;
}

async function seedAnnouncements(coachId) {
  let created = 0;

  for (const item of announcementsData) {
    const exists = await prisma.announcement.findFirst({
      where: {
        title: item.title,
        message: item.message,
        target: item.target,
        createdById: coachId
      }
    });

    if (!exists) {
      await prisma.announcement.create({
        data: {
          ...item,
          createdById: coachId
        }
      });
      created += 1;
    }
  }

  return created;
}

async function seedPolls(coachId) {
  let created = 0;

  for (const item of pollsData) {
    const exists = await prisma.poll.findFirst({
      where: {
        question: item.question,
        target: item.target,
        createdById: coachId
      }
    });

    if (!exists) {
      await prisma.poll.create({
        data: {
          ...item,
          active: true,
          createdById: coachId
        }
      });
      created += 1;
    }
  }

  return created;
}

async function seedTrainings(coachId) {
  let created = 0;

  for (const item of trainingsData) {
    const exists = await prisma.training.findFirst({
      where: {
        date: item.date,
        time: item.time,
        type: item.type,
        category: item.category,
        createdById: coachId
      }
    });

    if (!exists) {
      const training = await prisma.training.create({
        data: {
          ...item,
          isActive: true,
          createdById: coachId
        }
      });

      if (item.category === 'ziaci') {
        const samplePlayers = ['adam_hrasko', 'michal_kovac', 'simon_ziak'];
        for (const [index, playerUsername] of samplePlayers.entries()) {
          await prisma.trainingAttendance.upsert({
            where: {
              trainingId_playerUsername: {
                trainingId: training.id,
                playerUsername
              }
            },
            update: {
              status: index === 0 ? 'yes' : index === 1 ? 'no' : 'unknown',
              updatedById: coachId
            },
            create: {
              trainingId: training.id,
              playerUsername,
              status: index === 0 ? 'yes' : index === 1 ? 'no' : 'unknown',
              updatedById: coachId
            }
          });
        }
      }

      created += 1;
    }
  }

  return created;
}

async function main() {
  const coach = await getCoachUser();

  const [announcementsCreated, pollsCreated, trainingsCreated] = await Promise.all([
    seedAnnouncements(coach.id),
    seedPolls(coach.id),
    seedTrainings(coach.id)
  ]);

  console.log(`Coach used: ${coach.username}`);
  console.log(`Announcements created: ${announcementsCreated}`);
  console.log(`Polls created: ${pollsCreated}`);
  console.log(`Trainings created: ${trainingsCreated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
