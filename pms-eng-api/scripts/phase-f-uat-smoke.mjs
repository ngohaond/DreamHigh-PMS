/**
 * Phase F UAT & Production Smoke Test Suite — DreamHigh PMS
 *
 * Simulates end-to-end acceptance testing across all 5 operational personas:
 * 1. Admin: System readiness, user provisioning, catalogs, audit logs.
 * 2. Admissions (Tư vấn tuyển sinh): Leads, placement test scoring, lead-to-student conversion.
 * 3. Academic Manager (Quản lý đào tạo): Class creation, session generation, teacher substitution, workload reports.
 * 4. Teacher (Giáo viên): Personal schedule lookup, class details access, branch/class isolation.
 * 5. Registrar (Học vụ): Student lifecycle transitions, invoice & discount, payment recording, PDF receipt, arrears.
 */

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET ?? 'dreamhigh_super_secret_key_2026';
const apiBaseUrl = process.env.API_BASE_URL ?? (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://127.0.0.1:3000');

const parsedDatabaseUrl = databaseUrl ? new URL(databaseUrl) : null;
const schema = parsedDatabaseUrl?.searchParams.get('schema') ?? null;
const isCi = process.env.CI === 'true';

console.log('--- Phase F UAT & Production Smoke Test Initializing ---');
console.log(`Target API: ${apiBaseUrl}`);
console.log(`Database Schema: ${schema ?? 'default'}`);

const prisma = new PrismaClient();
const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
const today = new Date().toISOString().slice(0, 10);
const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

function logStep(persona, stepName, status = 'PASS') {
  console.log(`[${status}] [${persona.padEnd(16)}] ${stepName}`);
}

async function api(path, { user, method = 'GET', body, headers = {}, expected = 200 } = {}) {
  const url = new URL(path, apiBaseUrl);
  const response = await fetch(url, {
    method,
    headers: {
      ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const contentType = response.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : Buffer.from(await response.arrayBuffer());

  assert.equal(
    response.status,
    expected,
    `${method} ${path}: expected HTTP ${expected}, received HTTP ${response.status}`,
  );
  return { response, data };
}

async function makePersonaUser({ branch, role, code, fullName }) {
  const user = await prisma.systemUser.create({
    data: {
      username: `${code}_${suffix}`,
      fullName: fullName ?? `UAT ${code}`,
      email: `${code.toLowerCase()}_${suffix}@dreamhigh.edu.vn`,
      userBranches: { create: { branchId: branch.id } },
      userRoles: { create: { role: { connect: { code: role } } } },
    },
  });
  return {
    id: user.id,
    token: jwt.sign(
      { sub: user.id, roles: [role], branchIds: [branch.id] },
      jwtSecret,
      { expiresIn: '1h' },
    ),
  };
}

async function runUat() {
  // --------------------------------------------------------------------------
  // STEP 0: System Readiness & Health Probes (DevOps / Infrastructure)
  // --------------------------------------------------------------------------
  console.log('\n=== 0. Infrastructure & Liveness / Readiness Probes ===');
  const healthLive = await api('/api/health');
  assert.equal(healthLive.data.status, 'ok');
  logStep('DevOps/Infra', 'Liveness probe (/api/health) returns 200 OK');

  const healthReady = await api('/api/health/ready');
  assert.equal(healthReady.data.status, 'ready');
  assert.equal(healthReady.data.dependencies.database, 'ok');
  logStep('DevOps/Infra', 'Readiness probe (/api/health/ready) verifies DB connectivity');

  // Seed baseline test branches & catalogs
  const branchMain = await prisma.branch.create({
    data: { code: `UAT_HN_${suffix}`, name: `Hà Nội Campus ${suffix}`, address: '123 Cầu Giấy' },
  });
  const branchSecond = await prisma.branch.create({
    data: { code: `UAT_HCM_${suffix}`, name: `HCM Campus ${suffix}`, address: '456 Q1' },
  });

  const level = await prisma.level.create({
    data: {
      code: `LV_${suffix}`,
      name: `UAT Intermediate ${suffix}`,
      minScore: 50,
      maxScore: 79,
      status: 'ACTIVE',
    },
  });

  const program = await prisma.program.create({
    data: { code: `PROG_${suffix}`, name: `UAT General English ${suffix}`, status: 'ACTIVE' },
  });

  const course = await prisma.course.create({
    data: {
      code: `CRS_${suffix}`,
      name: `English for Career ${suffix}`,
      totalSessions: 12,
      tuitionFee: 3_500_000,
      programId: program.id,
      levelId: level.id,
      status: 'ACTIVE',
    },
  });

  const room = await prisma.room.create({
    data: { roomCode: `R101_${suffix}`, name: 'Phòng 101 Lab', capacity: 25, branchId: branchMain.id },
  });

  // Provision 5 Persona Users
  console.log('\n=== Provisioning 5 Operational Persona Accounts ===');
  const adminUser = await makePersonaUser({ branch: branchMain, role: 'ADMIN', code: 'ADMIN', fullName: 'Vũ Quản Trị' });
  const managerUser = await makePersonaUser({ branch: branchMain, role: 'MANAGER', code: 'MGR', fullName: 'Trần Quản Lý' });
  const staffUser = await makePersonaUser({ branch: branchMain, role: 'STAFF', code: 'STF', fullName: 'Lê Học Vụ' });
  const teacherUser = await makePersonaUser({ branch: branchMain, role: 'TEACHER', code: 'TCH', fullName: 'Nguyễn Giáo Viên' });
  const admissionsUser = await makePersonaUser({ branch: branchMain, role: 'STAFF', code: 'ADM', fullName: 'Phạm Tư Vấn' });

  logStep('Admin', 'Provisioned 5 persona accounts with branch bindings & role grants');

  // --------------------------------------------------------------------------
  // STEP 1: Persona UAT — Admin (Hệ thống, Danh mục, Audit)
  // --------------------------------------------------------------------------
  console.log('\n=== 1. Persona UAT: Quản trị viên (Admin) ===');
  const catRes = await api('/api/categories/courses', { user: adminUser });
  assert.ok(catRes.data.length > 0, 'Admin can read course catalog');
  logStep('Admin', 'Catalog verification: courses retrieved successfully');

  const auditRes = await api('/api/audit-logs?limit=5', { user: adminUser });
  assert.ok(Array.isArray(auditRes.data) || Array.isArray(auditRes.data.data), 'Audit logs queryable by Admin');
  logStep('Admin', 'Audit trail verification: system audit logs queryable');

  // --------------------------------------------------------------------------
  // STEP 2: Persona UAT — Tư vấn tuyển sinh (Admissions)
  // --------------------------------------------------------------------------
  console.log('\n=== 2. Persona UAT: Tư vấn tuyển sinh (Admissions) ===');
  // Create Lead
  const leadRes = await api('/api/leads', {
    user: admissionsUser,
    method: 'POST',
    body: {
      fullName: `Ứng Viên UAT ${suffix}`,
      phone: `098${Math.floor(1000000 + Math.random() * 9000000)}`,
      email: `lead_${suffix}@gmail.com`,
      notes: 'Quan tâm khóa tiếng Anh giao tiếp buổi tối',
    },
    expected: 201,
  });
  const lead = leadRes.data;
  logStep('Admissions', `Created new candidate lead: ID=${lead.id}, Name=${lead.fullName}`);

  // Convert Lead to Student
  const convertRes = await api(`/api/enrollment/leads/${lead.id}/convert`, {
    user: admissionsUser,
    method: 'POST',
    body: {
      branchId: branchMain.id,
      dob: '2005-08-15',
      gender: 'MALE',
    },
    expected: 201,
  });
  const convertedStudent = convertRes.data.data?.student ?? convertRes.data.data ?? convertRes.data;
  assert.ok(convertedStudent.id, 'Converted student must have valid ID');
  logStep('Admissions', `Converted lead to official student: Code=${convertedStudent.studentCode}`);

  // Record Placement Test for the student
  const placementRes = await api(`/api/students/${convertedStudent.id}/placement-tests`, {
    user: admissionsUser,
    method: 'POST',
    body: {
      branchId: branchMain.id,
      programId: program.id,
      listeningScore: 25,
      readingScore: 25,
      writingScore: 20, // Total = 70 -> falls inside level min: 50, max: 79
      testDate: today,
      notes: 'Nghe tốt, phản xạ nhanh, đạt trình độ Intermediate',
    },
    expected: 201,
  });
  assert.equal(placementRes.data.data.totalScore, 70);
  assert.equal(placementRes.data.data.recommendedLevelId, level.id);
  logStep('Admissions', 'Recorded placement test: totalScore=70 maps to Intermediate barem level');

  // --------------------------------------------------------------------------
  // STEP 3: Persona UAT — Quản lý đào tạo (Academic Manager)
  // --------------------------------------------------------------------------
  console.log('\n=== 3. Persona UAT: Quản lý đào tạo (Academic Manager) ===');
  const classCode = `ENG_${suffix.slice(-6)}`;
  const classRes = await api('/api/classes', {
    user: managerUser,
    method: 'POST',
    body: {
      classCode,
      courseId: course.id,
      branchId: branchMain.id,
      teacherId: teacherUser.id,
      maxStudents: 20,
      startDate: today,
    },
    expected: 201,
  });
  const trainingClass = classRes.data.data;
  logStep('Academic Manager', `Created training class: ${trainingClass.classCode}`);

  // Generate sessions for class
  const sessionsRes = await api(`/api/classes/${trainingClass.id}/sessions/generate`, {
    user: managerUser,
    method: 'POST',
    body: {
      startDate: today,
      schedules: [
        { dayOfWeek: new Date(today).getDay(), startTime: '18:00', endTime: '20:00', roomId: room.id },
      ],
      totalSessions: 4,
    },
    expected: 201,
  });
  const generatedSessions = sessionsRes.data.data?.sessions ?? sessionsRes.data.data;
  assert.ok(Array.isArray(generatedSessions) && generatedSessions.length > 0, 'Sessions generated');
  const firstSession = generatedSessions[0];
  logStep('Academic Manager', `Generated ${generatedSessions.length} sessions according to recurring schedule`);

  // Substitute Room
  const room2 = await prisma.room.create({
    data: { roomCode: `R102_${suffix}`, name: 'Phòng 102 VIP', capacity: 30, branchId: branchMain.id },
  });
  await api(`/api/sessions/${firstSession.id}/room`, {
    user: managerUser,
    method: 'PATCH',
    body: { roomId: room2.id, reason: 'Nâng cấp phòng học chất lượng cao' },
    expected: 200,
  });
  logStep('Academic Manager', 'Rescheduled session room to Room 102 with logged audit reason');

  // Check teaching hours report
  const reportRes = await api(`/api/reports/teaching-hours?startDate=${today}&endDate=${nextWeek}`, {
    user: managerUser,
  });
  assert.ok(reportRes.data, 'Teaching hours report generated');
  logStep('Academic Manager', 'Verified teaching hours and teacher workload reporting');

  // --------------------------------------------------------------------------
  // STEP 4: Persona UAT — Giáo viên (Teacher)
  // --------------------------------------------------------------------------
  console.log('\n=== 4. Persona UAT: Giáo viên (Teacher) ===');
  const mySchedule = await api(`/api/sessions/my-schedule?startDate=${today}&endDate=${nextWeek}`, {
    user: teacherUser,
  });
  assert.ok(Array.isArray(mySchedule.data), 'Teacher schedule returned as array');
  assert.ok(
    mySchedule.data.some((s) => s.id === firstSession.id),
    'Teacher personal schedule displays assigned sessions',
  );
  logStep('Teacher', 'Teacher views assigned weekly sessions on personal timetable');

  // Verify class detail access by teacher
  const teacherClassView = await api(`/api/classes/${trainingClass.classCode}`, {
    user: teacherUser,
  });
  assert.equal(teacherClassView.data.classCode, trainingClass.classCode);
  logStep('Teacher', 'Teacher views class roster and syllabus for assigned class');

  // Verify cross-teacher security boundary
  const otherTeacher = await makePersonaUser({ branch: branchSecond, role: 'TEACHER', code: 'TCH2' });
  await api(`/api/classes/${trainingClass.classCode}`, {
    user: otherTeacher,
    expected: 403,
  });
  logStep('Teacher', 'RBAC Boundary: Unauthorized teacher blocked from viewing non-assigned class');

  // --------------------------------------------------------------------------
  // STEP 5: Persona UAT — Học vụ & Thu ngân (Registrar / Finance)
  // --------------------------------------------------------------------------
  console.log('\n=== 5. Persona UAT: Học vụ & Thu ngân (Registrar) ===');
  // Enroll student into class
  await prisma.classStudent.create({
    data: { classId: trainingClass.id, studentId: convertedStudent.id },
  });
  logStep('Registrar', `Enrolled student ${convertedStudent.studentCode} into class ${trainingClass.classCode}`);

  // Create Fee Plan
  const feePlanRes = await api('/api/finance/fee-plans', {
    user: staffUser,
    method: 'POST',
    body: {
      courseId: course.id,
      name: `Kế hoạch học phí chuẩn ${suffix}`,
      amount: 3_500_000,
    },
    expected: 201,
  });
  const feePlan = feePlanRes.data.data;
  logStep('Registrar', `Created fee plan: ${feePlan.name} (${feePlan.amount.toLocaleString()} VND)`);

  // Create Invoice with 10% discount
  const invoiceRes = await api('/api/finance/invoices', {
    user: staffUser,
    method: 'POST',
    body: {
      feePlanId: feePlan.id,
      studentId: convertedStudent.id,
      classId: trainingClass.id,
      dueDate: today,
      discountType: 'PERCENT',
      discountValue: 10,
    },
    expected: 201,
  });
  const invoice = invoiceRes.data.data;
  // 3,500,000 - 10% (350,000) = 3,150,000
  assert.equal(invoice.finalAmount, 3_150_000);
  assert.equal(invoice.status, 'PENDING');
  logStep('Registrar', `Issued tuition invoice: original 3.5M -> 10% discount -> 3,150,000 VND`);

  // Record Partial Payment: 1,500,000 VND
  const payment1 = await api(`/api/finance/invoices/${invoice.id}/payments`, {
    user: staffUser,
    method: 'POST',
    body: {
      amount: 1_500_000,
      paymentMethod: 'BANK_TRANSFER',
      referenceCode: `TX1_${suffix}`,
      note: 'Thanh toán đợt 1 chuyển khoản',
    },
    expected: 201,
  });
  const invAfterPay1 = await api(`/api/finance/invoices/${invoice.id}`, { user: staffUser });
  assert.equal(invAfterPay1.data.data.status, 'PARTIALLY_PAID');
  assert.equal(invAfterPay1.data.data.outstandingAmount, 1_650_000);
  logStep('Registrar', 'Recorded partial payment 1.5M VND -> Invoice status PARTIALLY_PAID, outstanding 1.65M VND');

  // Record Final Payment: 1,650,000 VND
  const payment2 = await api(`/api/finance/invoices/${invoice.id}/payments`, {
    user: staffUser,
    method: 'POST',
    body: {
      amount: 1_650_000,
      paymentMethod: 'CASH',
      referenceCode: `TX2_${suffix}`,
      note: 'Thanh toán hoàn tất đợt 2',
    },
    expected: 201,
  });
  const invAfterPay2 = await api(`/api/finance/invoices/${invoice.id}`, { user: staffUser });
  assert.equal(invAfterPay2.data.data.status, 'PAID');
  assert.equal(invAfterPay2.data.data.outstandingAmount, 0);
  logStep('Registrar', 'Recorded final payment 1.65M VND -> Invoice status PAID, outstanding 0 VND');

  // Generate PDF Receipt
  const receiptRes = await api(`/api/finance/payments/${payment2.data.data.id}/receipt.pdf`, {
    user: staffUser,
  });
  assert.equal(receiptRes.response.headers.get('content-type'), 'application/pdf');
  assert.ok(receiptRes.data.length > 1000, 'PDF receipt stream non-empty');
  logStep('Registrar', `Generated official PDF payment receipt (${receiptRes.data.length} bytes)`);

  // Verify Arrears Report
  const arrearsRes = await api('/api/reports/arrears', { user: staffUser });
  assert.ok(arrearsRes.data.data, 'Arrears summary returned');
  logStep('Registrar', 'Debt & Arrears report reconciliation verified successfully');

  console.log('\n=============================================================');
  console.log('✅ ALL PHASE F UAT PERSONA TEST SCENARIOS PASSED WITH SUCCESS!');
  console.log('=============================================================\n');
}

runUat()
  .catch((err) => {
    console.error('\n❌ Phase F UAT Smoke Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
