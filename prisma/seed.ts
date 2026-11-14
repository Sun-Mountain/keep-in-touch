import { PrismaClient } from '../src/prisma/generated/client/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter});


async function main() {
  await prisma.user.upsert({
    where: { email: 'npzonnenberg@gmail.com' },
    update: {},
    create: {
      email: 'npzonnenberg@gmail.com',
      name: ['Nicole Zonnenberg'],
      emailVerified: true,
    },
  });
};

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })