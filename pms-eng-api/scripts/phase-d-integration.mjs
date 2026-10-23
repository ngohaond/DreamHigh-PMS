import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;
const apiBaseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:3001';
const parsedDatabaseUrl = databaseUrl ? new URL(databaseUrl) : null;
const schema = parsedDatabaseUrl?.searchParams.get('schema') ?? null;
const githubCiDatabase = process.env.CI === 'true' && parsedDatabaseUrl?.pathname === '/ci' && schema === 'public';

if (!schema?.startsWith('phase_d_validation_') && !githubCiDatabase) {
  throw new Error('Refusing integration run: use phase_d_validation_* locally, or public in the ephemeral GitHub ci database');
}
if (!jwtSecret) throw new Error('JWT_SECRET is required for the isolated integration API');

const prisma = new PrismaClient();
const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

function check(name, assertion) {
  assertion();
  console.log(`PASS ${name}`);
}

async function api(path, { user, method = 'GET', body, headers = {}, expected = 200 } = {}) {
  const response = await fetch(new URL(path, apiBaseUrl), {
    method,
    headers: {
      ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const contentType = response.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, expected, `${method} ${path}: expected ${expected}, received ${response.status}`);
  return { response, data };
}

async function makeUser({ branch, role, code }) {
  const user = await prisma.systemUser.create({
    data: {
      username: `${code}_${suffix}`,
      fullName: `Phase D ${code}`,
      email: `${code.toLowerCase()}_${suffix}@example.test`,
      userBranches: { create: { branchId: branch.id } },
      userRoles: { create: { role: { connect: { code: role } } } },
    },
  });
  return { id: user.id, token: jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: '10m' }) };
}

async function createInvoice(user, feePlanId, studentId, classId, dueDate, discount) {
  const { data } = await api('/api/finance/invoices', {
    user,
    method: 'POST',
    body: { feePlanId, studentId, classId, dueDate, ...discount },
    expected: 201,
  });
  return data.data;
}

async function createClassStudent({ branch, course, teacher, student, classCode }) {
  const trainingClass = await prisma.trainingClass.create({
    data: {
      courseId: course.id,
      branchId: branch.id,
      teacherId: teacher.id,
      classCode,
      maxStudents: 20,
      startDate: new Date(`${today}T00:00:00.000Z`),
      status: 'ACTIVE',
    },
  });
  await prisma.classStudent.create({ data: { classId: trainingClass.id, studentId: student.id } });
  return trainingClass;
}

async function run() {
  await prisma.$connect();

  const staffRole = await prisma.role.upsert({ where: { code: 'STAFF' }, update: {}, create: { code: 'STAFF', name: 'Staff' } });
  const managerRole = await prisma.role.upsert({ where: { code: 'MANAGER' }, update: {}, create: { code: 'MANAGER', name: 'Manager' } });
  const branchA = await prisma.branch.create({ data: { code: `QAA${suffix}`, name: 'Phase D QA A' } });
  const branchB = await prisma.branch.create({ data: { code: `QAB${suffix}`, name: 'Phase D QA B' } });
  const staffA = await makeUser({ branch: branchA, role: staffRole.code, code: 'staff_a' });
  const managerA = await makeUser({ branch: branchA, role: managerRole.code, code: 'manager_a' });
  const staffB = await makeUser({ branch: branchB, role: staffRole.code, code: 'staff_b' });
  const managerB = await makeUser({ branch: branchB, role: managerRole.code, code: 'manager_b' });

  const program = await prisma.program.create({ data: { code: `QA${suffix}`, name: 'Phase D QA Program' } });
  const levelA = await prisma.level.create({
    data: { programId: program.id, code: 'QA-L1', name: 'QA Level 1', sortOrder: 1, minPlacementScore: 0, maxPlacementScore: 149 },
  });
  const levelB = await prisma.level.create({
    data: { programId: program.id, code: 'QA-L2', name: 'QA Level 2', sortOrder: 2, minPlacementScore: 150, maxPlacementScore: 300 },
  });
  const course = await prisma.course.create({
    data: { levelId: levelA.id, code: `QAC${suffix}`, name: 'Phase D QA Course', totalSessions: 10 },
  });

  const parentA = await prisma.parent.create({ data: { fullName: 'Phase D Parent A', phone: `090${suffix.slice(-7)}` } });
  const parentB = await prisma.parent.create({ data: { fullName: 'Phase D Parent B', phone: `091${suffix.slice(-7)}` } });
  const studentA = await prisma.student.create({
    data: { studentCode: `QASA${suffix}`, fullName: 'Phase D Student A', dob: new Date('2015-01-01T00:00:00.000Z'), parentId: parentA.id },
  });
  const studentB = await prisma.student.create({
    data: { studentCode: `QASB${suffix}`, fullName: 'Phase D Student B', dob: new Date('2015-01-02T00:00:00.000Z'), parentId: parentB.id },
  });
  const classA = await createClassStudent({ branch: branchA, course, teacher: managerA, student: studentA, classCode: `QACA${suffix}` });
  const classB = await createClassStudent({ branch: branchB, course, teacher: managerB, student: studentB, classCode: `QACB${suffix}` });

  const placement149 = await api(`/api/students/${studentA.id}/placement-tests`, {
    user: staffA,
    method: 'POST',
    body: { branchId: branchA.id, programId: program.id, listeningScore: 50, readingScore: 50, writingScore: 49, testDate: today },
    expected: 201,
  });
  const placement150 = await api(`/api/students/${studentA.id}/placement-tests`, {
    user: staffA,
    method: 'POST',
    body: { branchId: branchA.id, programId: program.id, listeningScore: 50, readingScore: 50, writingScore: 50, testDate: today },
    expected: 201,
  });
  check('placement barem boundaries 149 and 150 map from configured Levels', () => {
    assert.equal(Number(placement149.data.data.totalScore), 149);
    assert.equal(placement149.data.data.recommendedLevelId, levelA.id);
    assert.equal(placement150.data.data.recommendedLevelId, levelB.id);
  });
  const placementHistory = await api(`/api/students/${studentA.id}/placement-tests`, { user: staffA });
  check('placement persists and is readable after a separate request', () => assert.equal(placementHistory.data.data.length, 2));
  await api(`/api/categories/levels/${levelA.id}`, {
    user: managerA,
    method: 'PATCH',
    body: { minPlacementScore: 0, maxPlacementScore: 148 },
  });
  await api(`/api/categories/levels/${levelB.id}`, {
    user: managerA,
    method: 'PATCH',
    body: { minPlacementScore: 149, maxPlacementScore: 300 },
  });
  const remappedPlacement = await api(`/api/students/${studentA.id}/placement-tests`, {
    user: staffA,
    method: 'POST',
    body: { branchId: branchA.id, programId: program.id, listeningScore: 50, readingScore: 50, writingScore: 49, testDate: today },
    expected: 201,
  });
  check('updating configured Level bounds changes the recommendation', () => {
    assert.equal(remappedPlacement.data.data.recommendedLevelId, levelB.id);
  });

  const planResponse = await api('/api/finance/fee-plans', {
    user: managerA,
    method: 'POST',
    body: { branchId: branchA.id, courseId: course.id, name: 'Phase D QA tuition', amount: 100001 },
    expected: 201,
  });
  const feePlanA = planResponse.data.data;
  await api('/api/finance/fee-plans', {
    user: managerA,
    method: 'POST',
    body: { branchId: branchA.id, courseId: course.id, name: 'Invalid negative fee', amount: -1 },
    expected: 400,
  });
  console.log('PASS negative fee-plan amount is rejected');
  const extraPlan = await api('/api/finance/fee-plans', {
    user: managerB,
    method: 'POST',
    body: { branchId: branchB.id, courseId: course.id, name: 'Phase D QA deactivation', amount: 25000 },
    expected: 201,
  });
  const snapshottedInvoice = await createInvoice(managerB, extraPlan.data.data.id, studentB.id, classB.id, tomorrow, {});
  await api(`/api/finance/fee-plans/${extraPlan.data.data.id}`, {
    user: managerB,
    method: 'PATCH',
    body: { amount: 30000 },
  });
  const deactivatedPlan = await api(`/api/finance/fee-plans/${extraPlan.data.data.id}/deactivate`, {
    user: managerB,
    method: 'POST',
    expected: 201,
  });
  const preservedInvoice = await api(`/api/finance/invoices/${snapshottedInvoice.id}`, { user: staffB });
  check('fee plan create/update/deactivate persists', () => {
    assert.equal(deactivatedPlan.data.data.amount, 30000);
    assert.equal(deactivatedPlan.data.data.isActive, false);
    assert.equal(preservedInvoice.data.data.totalAmount, 25000);
    assert.equal(preservedInvoice.data.data.finalAmount, 25000);
  });

  const percentInvoice = await createInvoice(managerA, feePlanA.id, studentA.id, classA.id, tomorrow, {
    discountType: 'PERCENTAGE', discountValue: 12.34,
  });
  check('percentage discount creates immutable invoice snapshot with rounded VND', () => {
    assert.equal(percentInvoice.totalAmount, 100001);
    assert.equal(percentInvoice.discountAmount, 12340);
    assert.equal(percentInvoice.finalAmount, 87661);
  });
  const fixedInvoice = await createInvoice(managerA, feePlanA.id, studentA.id, classA.id, tomorrow, {
    discountType: 'FIXED_AMOUNT', discountValue: 10000,
  });
  check('fixed discount is applied to invoice snapshot', () => assert.equal(fixedInvoice.finalAmount, 90001));
  await api('/api/finance/invoices', {
    user: managerA,
    method: 'POST',
    body: { feePlanId: feePlanA.id, studentId: studentA.id, classId: classA.id, dueDate: tomorrow, discountType: 'FIXED_AMOUNT', discountValue: 100002 },
    expected: 400,
  });
  console.log('PASS discount above base is rejected');

  const concurrentPaymentBody = {
    amount: 30000,
    paymentMethod: 'BANK_TRANSFER',
    paidAt: new Date().toISOString(),
    transactionRef: `QA-${suffix}-PARTIAL`,
  };
  const parallelPayments = await Promise.all([0, 1].map(() => api(`/api/finance/invoices/${percentInvoice.id}/payments`, {
    user: staffA,
    method: 'POST',
    headers: { 'Idempotency-Key': `qa-${suffix}-partial` },
    body: concurrentPaymentBody,
    expected: 201,
  })));
  assert.equal(parallelPayments.filter(({ data }) => data.data.replayed === false).length, 1);
  assert.equal(parallelPayments.filter(({ data }) => data.data.replayed === true).length, 1);
  assert.equal(await prisma.payment.count({ where: { invoiceId: percentInvoice.id } }), 1);
  console.log('PASS concurrent identical payment retries create one payment and replay safely');
  await api(`/api/finance/invoices/${percentInvoice.id}/payments`, {
    user: staffA,
    method: 'POST',
    headers: { 'Idempotency-Key': `qa-${suffix}-final` },
    body: { amount: 57661, paymentMethod: 'CASH', paidAt: new Date().toISOString() },
    expected: 201,
  });
  const paidInvoice = await api(`/api/finance/invoices/${percentInvoice.id}`, { user: staffA });
  check('partial then final payment updates status and outstanding', () => {
    assert.equal(paidInvoice.data.data.paymentStatus, 'COMPLETED');
    assert.equal(paidInvoice.data.data.outstanding, 0);
  });
  await api(`/api/finance/invoices/${percentInvoice.id}/payments`, {
    user: staffA,
    method: 'POST',
    headers: { 'Idempotency-Key': `qa-${suffix}-final` },
    body: { amount: 1, paymentMethod: 'CASH', paidAt: new Date().toISOString() },
    expected: 409,
  });
  console.log('PASS idempotency key reuse with different payload is rejected');
  await api(`/api/finance/invoices/${fixedInvoice.id}/payments`, {
    user: staffA,
    method: 'POST',
    headers: { 'Idempotency-Key': `qa-${suffix}-overpayment` },
    body: { amount: 90002, paymentMethod: 'CASH', paidAt: new Date().toISOString() },
    expected: 400,
  });
  console.log('PASS payment above remaining outstanding is rejected');
  await api(`/api/finance/invoices/${fixedInvoice.id}/payments`, {
    user: staffA,
    method: 'POST',
    headers: { 'Idempotency-Key': `qa-${suffix}-duplicate-ref` },
    body: { amount: 1000, paymentMethod: 'CASH', paidAt: new Date().toISOString(), transactionRef: `QA-${suffix}-PARTIAL` },
    expected: 409,
  });
  console.log('PASS duplicate external transaction reference is rejected');

  const rollbackInvoice = await createInvoice(managerA, feePlanA.id, studentA.id, classA.id, tomorrow, {});
  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION phase_d_test_fail_payment_audit() RETURNS trigger AS $$ BEGIN IF NEW.resource = 'PAYMENT' THEN RAISE EXCEPTION 'phase_d_test_rollback'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER phase_d_test_fail_payment_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION phase_d_test_fail_payment_audit()`);
  try {
    await api(`/api/finance/invoices/${rollbackInvoice.id}/payments`, {
      user: staffA,
      method: 'POST',
      headers: { 'Idempotency-Key': `qa-${suffix}-rollback` },
      body: { amount: 1000, paymentMethod: 'CASH', paidAt: new Date().toISOString() },
      expected: 500,
    });
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS phase_d_test_fail_payment_audit ON audit_logs');
    await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS phase_d_test_fail_payment_audit()');
  }
  const rollbackState = await prisma.invoice.findUnique({ where: { id: rollbackInvoice.id }, include: { payments: true } });
  check('audit failure rolls back payment and invoice status', () => {
    assert.equal(rollbackState.payments.length, 0);
    assert.equal(rollbackState.paymentStatus, 'PENDING');
  });

  const overdueInvoice = await createInvoice(managerA, feePlanA.id, studentA.id, classA.id, yesterday, {});
  const feePlanBResponse = await api('/api/finance/fee-plans', {
    user: managerB,
    method: 'POST',
    body: { branchId: branchB.id, courseId: course.id, name: 'Phase D QA tuition B', amount: 50000 },
    expected: 201,
  });
  const invoiceB = await createInvoice(managerB, feePlanBResponse.data.data.id, studentB.id, classB.id, yesterday, {});
  const paymentBResponse = await api(`/api/finance/invoices/${invoiceB.id}/payments`, {
    user: staffB,
    method: 'POST',
    headers: { 'Idempotency-Key': `qa-${suffix}-branch-b` },
    body: { amount: 5000, paymentMethod: 'CASH', paidAt: new Date().toISOString() },
    expected: 201,
  });
  const paymentBId = paymentBResponse.data.data.payment.id;

  const arrearsA = await api(`/api/reports/arrears?branchId=${branchA.id}&pageSize=100`, { user: staffA });
  check('arrears totals include only positive outstanding and overdue balances', () => {
    assert.equal(arrearsA.data.data.totals.totalDebt, 290003);
    assert.equal(arrearsA.data.data.totals.studentCount, 1);
    assert.equal(arrearsA.data.data.totals.overdueTotal, 100001);
    assert.equal(arrearsA.data.data.items.length, 3);
  });
  await api(`/api/reports/arrears?branchId=${branchB.id}`, { user: staffA, expected: 403 });
  await api(`/api/finance/invoices/${invoiceB.id}`, { user: staffA, expected: 404 });
  await api(`/api/finance/payments/${paymentBId}`, { user: staffA, expected: 404 });
  await api(`/api/finance/payments/${paymentBId}/receipt.pdf`, { user: staffA, expected: 403 });
  check('branch B invoices, payments, receipts, and report filters are isolated from branch A', () => {});

  const firstPaymentId = parallelPayments[0].data.data.payment.id;
  const receipt = await api(`/api/finance/payments/${firstPaymentId}/receipt.pdf`, { user: staffA });
  check('receipt endpoint returns a PDF for an authorized payment', () => {
    assert.equal(receipt.response.headers.get('content-type'), 'application/pdf');
    assert.equal(receipt.data.subarray(0, 5).toString(), '%PDF-');
  });

  check('overdue invoice is reported as OVERDUE', () => {
    const row = arrearsA.data.data.items.find((item) => item.invoiceId === overdueInvoice.id);
    assert.equal(row?.status, 'OVERDUE');
  });

  console.log('Phase D isolated API integration: PASS');
}

try {
  await run();
} finally {
  await prisma.$disconnect();
}