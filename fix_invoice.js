const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const invoiceUrl = 'INV-20260603-EH2WZD';
  
  const subscription = await prisma.subscription.findFirst({
    where: { invoiceUrl }
  });

  if (subscription) {
    let paymentInstruction = subscription.paymentInstruction || {};
    
    // Parse if it's a string, just in case
    if (typeof paymentInstruction === 'string') {
        paymentInstruction = JSON.parse(paymentInstruction);
    }

    paymentInstruction.pay_amount = 150655;

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        paymentInstruction
      }
    });
    console.log(`Successfully updated Subscription ID ${subscription.id} to have pay_amount = 150655`);
  } else {
    console.log('Subscription not found!');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
