#!/usr/bin/env node
/** Ensures super admin exists — runs on every backend container start */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

async function main() {
  const email = (process.env.ADMIN_EMAIL || 'admin@maskara.bd').trim();
  const password = (process.env.ADMIN_INITIAL_PASSWORD || 'Admin@123').trim();
  if (!email || !password) {
    console.log('ensure-admin: skipped (no ADMIN_EMAIL/PASSWORD)');
    return;
  }
  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        role: 'SUPER_ADMIN',
        isActive: true,
        emailVerified: true,
      },
      create: {
        email,
        passwordHash,
        firstName: 'System',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        isActive: true,
        emailVerified: true,
      },
    });
    console.log('ensure-admin: ready', admin.email);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('ensure-admin failed:', e.message);
  process.exit(0);
});
