require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const readline = require('readline');
const prisma = new PrismaClient();

async function main() {
  const argPassword = process.argv[2];

  let password;
  if (argPassword) {
    password = argPassword;
  } else {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    password = await new Promise((resolve) => {
      rl.question('Zadaj nové heslo pre všetkých hráčov: ', (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    });
  }

  if (!password || password.length < 6) {
    console.error('Heslo musí mať aspoň 6 znakov.');
    process.exit(1);
  }

  console.log('Hashujem heslo...');
  const hash = await bcrypt.hash(password, 10);

  const result = await prisma.user.updateMany({
    where: { role: 'player' },
    data: { passwordHash: hash, lastPasswordChangeAt: null },
  });
  console.log(`Hotovo — aktualizovaných ${result.count} hráčských účtov.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
