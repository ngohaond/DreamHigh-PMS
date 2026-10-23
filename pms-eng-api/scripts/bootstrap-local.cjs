const ADMIN_EMAIL_DEFAULT = 'admin@dreamhigh.local';

/** Initialize a dedicated local database without resetting existing accounts. */
async function bootstrapLocal(prisma, { email = ADMIN_EMAIL_DEFAULT, password, hashPassword }) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL must be a valid email');
  }
  if (typeof password !== 'string' || password.length < 16) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must contain at least 16 characters');
  }
  if (typeof hashPassword !== 'function') {
    throw new Error('A password hashing function is required');
  }

  return prisma.$transaction(async (tx) => {
    const roles = {};
    for (const [code, name] of [
      ['ADMIN', 'System Administrator'],
      ['MANAGER', 'Center Manager'],
      ['STAFF', 'Academic Staff'],
      ['TEACHER', 'Teacher'],
    ]) {
      roles[code] = await tx.role.upsert({ where: { code }, update: {}, create: { code, name } });
    }

    const branch = await tx.branch.upsert({
      where: { code: 'DREAMHIGH_LOCAL' },
      update: {},
      create: { code: 'DREAMHIGH_LOCAL', name: 'DreamHigh Local', status: 'ACTIVE' },
    });

    const existing = await tx.systemUser.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { username: 'admin' },
          { isSuperAdmin: true },
        ],
      },
      orderBy: { id: 'asc' },
    });
    if (existing) return { created: false, userId: existing.id, branchId: branch.id };

    const admin = await tx.systemUser.create({
      data: {
        username: 'admin',
        email: normalizedEmail,
        fullName: 'Local Administrator',
        passwordHash: await hashPassword(password),
        isSuperAdmin: true,
        status: 'ACTIVE',
        userRoles: { create: { roleId: roles.ADMIN.id } },
        userBranches: { create: { branchId: branch.id } },
      },
    });
    return { created: true, userId: admin.id, branchId: branch.id };
  });
}

module.exports = { bootstrapLocal };

if (require.main === module) {
  const { PrismaClient } = require('@prisma/client');
  const bcrypt = require('bcryptjs');
  const prisma = new PrismaClient();
  bootstrapLocal(prisma, {
    email: process.env.BOOTSTRAP_ADMIN_EMAIL || ADMIN_EMAIL_DEFAULT,
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
    hashPassword: (password) => bcrypt.hash(password, 12),
  })
    .then(({ created }) => {
      console.log(created
        ? 'Local administrator and baseline data initialized.'
        : 'Local administrator already exists; account and password unchanged.');
    })
    .catch(() => {
      // Avoid logging Prisma inputs or credentials on initialization failures.
      console.error('Local bootstrap failed. Verify migrations and bootstrap configuration.');
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
