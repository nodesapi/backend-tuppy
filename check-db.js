require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  try {
    const email = 'admin@tuppy.ly';
    const pass = '@GMCloud2020A';
    console.log(`Checking user: ${email}`);

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log('User not found!');
      return;
    }

    console.log(`User found! ID: ${user.id}, Role: ${user.role}`);

    const isValid = await bcrypt.compare(pass, user.password);
    console.log(`Password match? ${isValid}`);

    if (!isValid) {
      console.log('Updating password to ensure it matches...');
      const hashedPassword = await bcrypt.hash(pass, 10);
      await prisma.user.update({
        where: { email },
        data: { password: hashedPassword }
      });
      console.log('Password updated.');
    }

    const demoEmail = 'demo@tuppy.ly';
    console.log(`Checking user: ${demoEmail}`);
    let demoUser = await prisma.user.findUnique({ where: { email: demoEmail } });
    if (!demoUser) {
      console.log('Demo user not found!');
    } else {
      console.log(`Demo user found! ID: ${demoUser.id}, Role: ${demoUser.role}`);
      const isDemoValid = await bcrypt.compare(pass, demoUser.password);
      console.log(`Demo Password match? ${isDemoValid}`);

      if (!isDemoValid) {
        console.log('Updating Demo password to ensure it matches...');
        const hashedPassword = await bcrypt.hash(pass, 10);
        await prisma.user.update({
          where: { email: demoEmail },
          data: { password: hashedPassword }
        });
        console.log('Demo password updated.');
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
