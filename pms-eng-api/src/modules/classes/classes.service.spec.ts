import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ClassesService, type ClassesAuthUser } from './classes.service';
import type { PrismaService } from '../../prisma/prisma.service';

const admin: ClassesAuthUser = { userId: 1, roles: ['ADMIN'], branchIds: [] };
const manager: ClassesAuthUser = { userId: 2, roles: ['MANAGER'], branchIds: [1] };
const teacher: ClassesAuthUser = { userId: 7, roles: ['TEACHER'], branchIds: [1] };
const otherTeacher: ClassesAuthUser = { userId: 8, roles: ['TEACHER'], branchIds: [1] };

type PrismaMock = {
  trainingClass: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  course: { findUnique: jest.Mock };
  branch: { findUnique: jest.Mock };
  systemUser: { findUnique: jest.Mock };
};

function makePrisma(): PrismaMock {
  return {
    trainingClass: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    course: { findUnique: jest.fn() },
    branch: { findUnique: jest.fn() },
    systemUser: { findUnique: jest.fn() },
  };
}

const teacherRow = { id: 7, fullName: 'Nguyễn Văn A', status: 'ACTIVE', userBranches: [{ branchId: 1 }] };
const courseRow = { id: 2, name: 'IELTS Foundation', status: 'ACTIVE' };
const branchRow = { id: 1, name: 'Cơ sở Hà Nội', status: 'ACTIVE' };

const classInfo = {
  id: 11,
  classCode: 'PY-K1-01',
  courseId: 2,
  branchId: 1,
  teacherId: 7,
  maxStudents: 15,
  startDate: new Date('2026-03-02T00:00:00Z'),
  endDate: new Date('2026-06-01T00:00:00Z'),
  status: 'PLANNED',
  course: courseRow,
  teacher: teacherRow,
  branch: branchRow,
};

describe('ClassesService.getClassDetails', () => {
  let service: ClassesService;
  let prisma: PrismaMock;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makePrisma();
    service = new ClassesService(prisma as unknown as PrismaService);
  });

  it('throws NotFoundException when class code does not exist', async () => {
    prisma.trainingClass.findUnique.mockResolvedValue(null);

    await expect(service.getClassDetails('XXXX')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns class detail with course, sessions and enrollments', async () => {
    const data = {
      id: 1,
      classCode: 'PY-K1-01',
      course: { id: 1, name: 'Python Kids 1' },
      teacher: null,
      sessions: [{ id: 1, startTime: new Date('2026-03-02T02:00:00Z'), teacherId: null }],
      exams: [],
      enrollments: [{ id: 1 }],
      branchId: 1,
      teacherId: 7,
    };
    prisma.trainingClass.findUnique.mockResolvedValue(data);

    const result = await service.getClassDetails('PY-K1-01');

    expect(result.statusCode).toBe(200);
    expect(result.data.classCode).toBe('PY-K1-01');
    expect(result.data.course.name).toBe('Python Kids 1');
    expect(result.data.sessions).toHaveLength(1);
    expect(result.data.enrollments).toHaveLength(1);
  });

  it('does not expose teacher passwordHash or googleSub', async () => {
    prisma.trainingClass.findUnique.mockResolvedValue({
      id: 1,
      classCode: 'PY-K1-01',
      course: { id: 1 },
      teacher: {
        id: 7,
        fullName: 'Nguyễn Văn A',
        email: 'a@dreamhigh.vn',
        passwordHash: 'super-secret-hash',
        googleSub: 'google-oauth-sub-123',
      },
      sessions: [],
      exams: [],
      enrollments: [],
      branchId: 1,
      teacherId: 7,
    });

    const result = await service.getClassDetails('PY-K1-01');

    expect(result.data.teacher).not.toHaveProperty('passwordHash');
    expect(result.data.teacher).not.toHaveProperty('googleSub');
    expect(result.data.teacher.fullName).toBe('Nguyễn Văn A');
    expect(result.data.teacher.roles).toEqual([]);
  });

  it('returns null teacher when class has no teacher relation', async () => {
    prisma.trainingClass.findUnique.mockResolvedValue({
      id: 1,
      classCode: 'PY-K1-01',
      course: { id: 1 },
      teacher: null,
      sessions: [],
      exams: [],
      enrollments: [],
      branchId: 1,
      teacherId: 7,
    });

    const result = await service.getClassDetails('PY-K1-01');

    expect(result.data.teacher).toBeNull();
  });

  it('lets the class teacher view their own class', async () => {
    prisma.trainingClass.findUnique.mockResolvedValue({
      ...classInfo,
      sessions: [{ id: 1, teacherId: null }],
      exams: [],
      enrollments: [],
    });

    const result = await service.getClassDetails('PY-K1-01', teacher);

    expect(result.statusCode).toBe(200);
  });

  it('forbids a teacher who does not teach the class from viewing it', async () => {
    prisma.trainingClass.findUnique.mockResolvedValue({
      ...classInfo,
      sessions: [{ id: 1, teacherId: null }],
      exams: [],
      enrollments: [],
    });

    await expect(service.getClassDetails('PY-K1-01', otherTeacher)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lets a teacher assigned to a single session view the class', async () => {
    prisma.trainingClass.findUnique.mockResolvedValue({
      ...classInfo,
      teacherId: 7,
      sessions: [{ id: 1, teacherId: 8 }],
      exams: [],
      enrollments: [],
    });

    const result = await service.getClassDetails('PY-K1-01', otherTeacher);

    expect(result.statusCode).toBe(200);
  });
});

describe('ClassesService.listClasses', () => {
  let service: ClassesService;
  let prisma: PrismaMock;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makePrisma();
    service = new ClassesService(prisma as unknown as PrismaService);
  });

  it('restricts the list to the branches the manager can access', async () => {
    prisma.trainingClass.findMany.mockResolvedValue([]);
    prisma.trainingClass.count.mockResolvedValue(0);

    await service.listClasses({}, manager);

    const where = prisma.trainingClass.findMany.mock.calls[0][0].where;
    expect(where.branchId).toEqual({ in: [1] });
  });

  it('does not filter by branch for an admin', async () => {
    prisma.trainingClass.findMany.mockResolvedValue([]);
    prisma.trainingClass.count.mockResolvedValue(0);

    await service.listClasses({}, admin);

    const where = prisma.trainingClass.findMany.mock.calls[0][0].where;
    expect(where.branchId).toBeUndefined();
  });

  it('does not let a manager query a branch outside their scope', async () => {
    prisma.trainingClass.findMany.mockResolvedValue([]);
    prisma.trainingClass.count.mockResolvedValue(0);

    await service.listClasses({ branchId: 9 }, manager);

    const where = prisma.trainingClass.findMany.mock.calls[0][0].where;
    expect(where.branchId).toEqual({ in: [] });
  });

  it('never leaks teacher credentials in the list response', async () => {
    prisma.trainingClass.findMany.mockResolvedValue([
      {
        ...classInfo,
        teacher: { ...teacherRow, passwordHash: 'secret', googleSub: 'sub' },
      },
    ]);
    prisma.trainingClass.count.mockResolvedValue(1);

    const result = await service.listClasses({}, admin);

    expect(result.data[0].teacher).not.toHaveProperty('passwordHash');
    expect(result.data[0].teacher).not.toHaveProperty('googleSub');
    expect(result.meta.total).toBe(1);
  });
});

describe('ClassesService.createClass', () => {
  let service: ClassesService;
  let prisma: PrismaMock;

  const dto = {
    classCode: 'PY-K1-01',
    courseId: 2,
    branchId: 1,
    teacherId: 7,
    maxStudents: 15,
    startDate: '2026-03-02',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makePrisma();
    service = new ClassesService(prisma as unknown as PrismaService);
    prisma.course.findUnique.mockResolvedValue(courseRow);
    prisma.branch.findUnique.mockResolvedValue(branchRow);
    prisma.systemUser.findUnique.mockResolvedValue(teacherRow);
    prisma.trainingClass.findUnique.mockResolvedValue(null);
    prisma.trainingClass.create.mockResolvedValue(classInfo);
  });

  it('creates a class in PLANNED status', async () => {
    const result = await service.createClass(dto, admin);

    expect(result.statusCode).toBe(201);
    const data = prisma.trainingClass.create.mock.calls[0][0].data;
    expect(data.status).toBe('PLANNED');
    expect(data.classCode).toBe('PY-K1-01');
  });

  it('rejects a duplicate class code', async () => {
    prisma.trainingClass.findUnique.mockResolvedValue(classInfo);

    await expect(service.createClass(dto, admin)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.trainingClass.create).not.toHaveBeenCalled();
  });

  it('rejects a manager creating a class outside their branch', async () => {
    await expect(
      service.createClass({ ...dto, branchId: 9 }, manager),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.trainingClass.create).not.toHaveBeenCalled();
  });

  it('rejects an inactive course', async () => {
    prisma.course.findUnique.mockResolvedValue({ ...courseRow, status: 'INACTIVE' });

    await expect(service.createClass(dto, admin)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a teacher outside the class branch', async () => {
    prisma.systemUser.findUnique.mockResolvedValue({ ...teacherRow, userBranches: [{ branchId: 9 }] });

    await expect(service.createClass(dto, admin)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ClassesService.updateClass', () => {
  let service: ClassesService;
  let prisma: PrismaMock;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makePrisma();
    service = new ClassesService(prisma as unknown as PrismaService);
    prisma.trainingClass.findUnique.mockResolvedValue(classInfo);
    prisma.trainingClass.update.mockResolvedValue(classInfo);
  });

  it('throws NotFoundException when the class does not exist', async () => {
    prisma.trainingClass.findUnique.mockResolvedValue(null);

    await expect(service.updateClass(999, { maxStudents: 20 }, admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('allows PLANNED to move to ACTIVE', async () => {
    const result = await service.updateClass(11, { status: 'ACTIVE' }, admin);

    expect(result.statusCode).toBe(200);
    expect(prisma.trainingClass.update.mock.calls[0][0].data.status).toBe('ACTIVE');
  });

  it('rejects moving a COMPLETED class back to ACTIVE', async () => {
    prisma.trainingClass.findUnique.mockResolvedValue({ ...classInfo, status: 'COMPLETED' });

    await expect(service.updateClass(11, { status: 'ACTIVE' }, admin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a manager updating a class outside their branch', async () => {
    prisma.trainingClass.findUnique.mockResolvedValue({ ...classInfo, branchId: 9 });

    await expect(service.updateClass(11, { maxStudents: 20 }, manager)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects an end date before the start date', async () => {
    await expect(
      service.updateClass(11, { startDate: '2026-05-01', endDate: '2026-04-01' }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
