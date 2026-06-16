import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function ensureAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD?.trim();
  if (!adminEmail || !adminPassword) {
    console.log('ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD not set — admin skipped');
    return;
  }
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: adminPasswordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
      emailVerified: true,
    },
    create: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      firstName: 'System',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      emailVerified: true,
    },
  });
  console.log('Admin user ready:', admin.email);
}

async function main() {
  await ensureAdmin();

  if (process.env.RUN_SEED !== 'true') {
    console.log('RUN_SEED not set — demo seed skipped');
    return;
  }

  if (process.env.SEED_DEMO === 'true') {
    const demoPassword = process.env.DEMO_MERCHANT_PASSWORD?.trim();
    if (!demoPassword) {
      console.log('SEED_DEMO=true but DEMO_MERCHANT_PASSWORD missing — demo merchant skipped');
    } else {
      const merchantPasswordHash = await bcrypt.hash(demoPassword, 12);
      const merchant = await prisma.merchant.upsert({
        where: { slug: 'demo-store' },
        update: {},
        create: {
          name: 'Demo Fashion Store',
          slug: 'demo-store',
          email: 'demo@store.com',
          phone: '+8801712345678',
          storeNameBangla: 'ডেমো ফ্যাশন স্টোর',
          status: 'ACTIVE',
          subscriptionPlan: 'GROWTH',
          subscriptionEnds: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      });

      await prisma.user.upsert({
        where: { email: 'demo@store.com' },
        update: {},
        create: {
          email: 'demo@store.com',
          passwordHash: merchantPasswordHash,
          firstName: 'Demo',
          lastName: 'Merchant',
          phone: '+8801712345678',
          role: 'MERCHANT_OWNER',
          merchantId: merchant.id,
          isActive: true,
          emailVerified: true,
        },
      });

      await prisma.subscription.upsert({
        where: { id: 'demo-subscription' },
        update: {},
        create: {
          id: 'demo-subscription',
          merchantId: merchant.id,
          plan: 'GROWTH',
          price: 4999,
          callLimit: 1000,
          smsLimit: 500,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      });
      console.log('Demo merchant seeded:', merchant.name);
    }
  }

  await prisma.systemSetting.upsert({
    where: { key: 'platform' },
    update: {},
    create: {
      key: 'platform',
      value: {
        name: 'Maskara',
        version: '1.0.0',
        maintenanceMode: false,
        defaultLanguage: 'bn-BD',
      },
    },
  });

  console.log('Seed completed');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
