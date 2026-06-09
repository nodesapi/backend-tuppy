const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if(!tenant) return console.log('No tenant found');
  
  const lead = await prisma.lead.create({
    data: {
      tenantId: tenant.id,
      blockId: 'rsvp-form',
      source: 'RSVP',
      name: 'Ahmad Siregar',
      notes: 'Selamat menempuh hidup baru, semoga samawa ya!',
      status: 'NEW'
    }
  });
  
  console.log('Seeded RSVP:', lead);
}

main().finally(() => prisma.$disconnect());
