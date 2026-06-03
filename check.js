const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const tenant = await prisma.tenant.findFirst();
  console.log('isPremium:', tenant?.isPremium);
  
  const subs = await prisma.subscription.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  console.log('latest sub:', subs[0]);
  
  await prisma.$disconnect();
}

check();
