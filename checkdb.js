const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
prisma.user.count().then(c => console.log('User count:', c)).catch(console.error).finally(() => prisma.$disconnect());
