const { test } = require('node:test');
const assert = require('node:assert/strict');
const { bootstrapLocal } = require('./bootstrap-local.cjs');

function database(existingUser = null) {
  const writes = [];
  const roles = new Map();
  const users = existingUser ? [existingUser] : [];
  const tx = {
    role: { upsert: async ({ where, create }) => {
      if (!roles.has(where.code)) roles.set(where.code, { id: roles.size + 1, ...create });
      return roles.get(where.code);
    } },
    branch: { upsert: async () => ({ id: 10, code: 'DREAMHIGH_LOCAL' }) },
    systemUser: {
      findFirst: async ({ where, orderBy }) => {
        const matches = users.filter((user) => where.OR.some((filter) =>
          Object.entries(filter).every(([field, value]) => user[field] === value)));
        if (orderBy?.id === 'asc') matches.sort((a, b) => a.id - b.id);
        return matches[0] || null;
      },
      create: async ({ data }) => {
        if (users.some((user) => user.username === data.username || user.email === data.email)) {
          throw new Error('Duplicate username or email');
        }
        writes.push(data);
        const user = { id: 20, ...data };
        users.push(user);
        return user;
      },
    },
  };
  return { $transaction: (fn) => fn(tx), writes, roles, users };
}

test('initializes an active admin with hashed password, ADMIN role and local branch', async () => {
  const prisma = database();
  const result = await bootstrapLocal(prisma, {
    email: ' ADMIN@dreamhigh.local ', password: 'synthetic-test-password',
    hashPassword: async () => 'synthetic-hash',
  });
  assert.equal(result.created, true);
  assert.deepEqual([...prisma.roles.keys()], ['ADMIN', 'MANAGER', 'STAFF', 'TEACHER']);
  assert.equal(prisma.writes[0].email, 'admin@dreamhigh.local');
  assert.equal(prisma.writes[0].passwordHash, 'synthetic-hash');
  assert.equal(prisma.writes[0].isSuperAdmin, true);
  assert.equal(prisma.writes[0].status, 'ACTIVE');
  assert.equal(prisma.writes[0].userRoles.create.roleId, prisma.roles.get('ADMIN').id);
  assert.equal(prisma.writes[0].userBranches.create.branchId, 10);
});

test('rerun does not replace an existing account or hash a replacement password', async () => {
  const prisma = database({ id: 42, email: 'admin@dreamhigh.local', passwordHash: 'existing-hash', status: 'INACTIVE' });
  let hashes = 0;
  const result = await bootstrapLocal(prisma, {
    password: 'synthetic-test-password', hashPassword: async () => { hashes += 1; return 'replacement'; },
  });
  assert.equal(result.created, false);
  assert.equal(result.userId, 42);
  assert.equal(prisma.writes.length, 0);
  assert.equal(hashes, 0);
});

test('rerun preserves an administrator whose email changed without a username collision', async () => {
  const existing = {
    id: 42, email: 'changed@dreamhigh.local', username: 'admin',
    passwordHash: 'existing-hash', isSuperAdmin: true, status: 'ACTIVE',
  };
  const prisma = database(existing);
  const result = await bootstrapLocal(prisma, {
    password: 'synthetic-test-password', hashPassword: async () => assert.fail('Must not rehash'),
  });
  assert.equal(result.created, false);
  assert.equal(result.userId, existing.id);
  assert.equal(prisma.writes.length, 0);
  assert.deepEqual(prisma.users, [existing]);
});

test('rerun preserves a super administrator whose email and username both changed', async () => {
  const existing = {
    id: 42, email: 'changed@dreamhigh.local', username: 'renamed-owner',
    passwordHash: 'existing-hash', isSuperAdmin: true, status: 'INACTIVE',
  };
  const prisma = database(existing);
  const result = await bootstrapLocal(prisma, {
    password: 'synthetic-test-password', hashPassword: async () => assert.fail('Must not rehash'),
  });
  assert.equal(result.created, false);
  assert.equal(result.userId, existing.id);
  assert.equal(prisma.writes.length, 0);
  assert.deepEqual(prisma.users, [existing]);
});

test('rejects missing or short bootstrap passwords before touching the database', async () => {
  let transactions = 0;
  const prisma = { $transaction: () => { transactions += 1; } };
  for (const password of [undefined, '', 'short']) {
    await assert.rejects(bootstrapLocal(prisma, { password, hashPassword: async () => '' }), /at least 16/);
  }
  assert.equal(transactions, 0);
});

test('rejects malformed email before touching the database', async () => {
  const prisma = { $transaction: () => assert.fail('Database must not be touched') };
  await assert.rejects(bootstrapLocal(prisma, {
    email: 'not-an-email', password: 'synthetic-test-password', hashPassword: async () => '',
  }), /valid email/);
});
