import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { StudentsService, type StudentsAuthUser } from './students.service';
import type { PrismaService } from '../../prisma/prisma.service';

const admin: StudentsAuthUser = { userId: 1, roles: ['ADMIN'], branchIds: [] };
const managerBranch1: StudentsAuthUser = { userId: 2, roles: ['MANAGER'], branchIds: [1] };
const teacherBranch1: StudentsAuthUser = { userId: 3, roles: ['TEACHER'], branchIds: [1] };

describe('StudentsService - Branch Isolation', () => {
  let service: StudentsService;
  let prisma: {
    student: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      student: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new StudentsService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('allows ADMIN to query all students without branch restriction', async () => {
      prisma.student.findMany.mockResolvedValue([]);
      await service.findAll({}, admin);

      expect(prisma.student.findMany).toHaveBeenCalledWith({
        where: {
          AND: [{}, {}],
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('scopes non-admin query to user branchIds when branchId is omitted', async () => {
      prisma.student.findMany.mockResolvedValue([]);
      await service.findAll({}, managerBranch1);

      expect(prisma.student.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            { classEnrollments: { some: { trainingClass: { branchId: { in: [1] } } } } },
            {},
          ],
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('allows non-admin to filter within authorized branch', async () => {
      prisma.student.findMany.mockResolvedValue([]);
      await service.findAll({ branchId: 1 }, managerBranch1);

      expect(prisma.student.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            { classEnrollments: { some: { trainingClass: { branchId: 1 } } } },
            {},
          ],
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('rejects non-admin attempt to query unauthorized branch with 403 Forbidden', async () => {
      await expect(service.findAll({ branchId: 2 }, managerBranch1)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.student.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    const studentBranch1 = {
      id: 10,
      fullName: 'Student HN',
      status: 'ACTIVE',
      classEnrollments: [{ trainingClass: { branchId: 1, teacherId: 3, sessions: [] } }],
    };

    const studentBranch2 = {
      id: 20,
      fullName: 'Student HCM',
      status: 'ACTIVE',
      classEnrollments: [{ trainingClass: { branchId: 2, teacherId: 99, sessions: [] } }],
    };

    it('allows ADMIN to view student in any branch', async () => {
      prisma.student.findUnique.mockResolvedValue(studentBranch2);
      const res = await service.findOne(20, admin);
      expect(res.id).toBe(20);
    });

    it('allows manager to view student enrolled in manager branch', async () => {
      prisma.student.findUnique.mockResolvedValue(studentBranch1);
      const res = await service.findOne(10, managerBranch1);
      expect(res.id).toBe(10);
    });

    it('blocks manager from viewing student enrolled only in another branch', async () => {
      prisma.student.findUnique.mockResolvedValue(studentBranch2);
      await expect(service.findOne(20, managerBranch1)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows teacher assigned to student class to view student', async () => {
      prisma.student.findUnique.mockResolvedValue(studentBranch1);
      const res = await service.findOne(10, teacherBranch1);
      expect(res.id).toBe(10);
    });

    it('blocks teacher from viewing student not in teacher classes', async () => {
      const studentOtherTeacher = {
        id: 11,
        fullName: 'Student Other Class',
        status: 'ACTIVE',
        classEnrollments: [{ trainingClass: { branchId: 1, teacherId: 999, sessions: [] } }],
      };
      prisma.student.findUnique.mockResolvedValue(studentOtherTeacher);
      await expect(service.findOne(11, teacherBranch1)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('denies manager access to a student without branch enrollment', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 30,
        fullName: 'Unassigned student',
        status: 'ACTIVE',
        classEnrollments: [],
      });
      await expect(service.findOne(30, managerBranch1)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows a substituted teacher to view an enrolled student', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 12,
        fullName: 'Student with substitute teacher',
        status: 'ACTIVE',
        classEnrollments: [
          {
            trainingClass: {
              branchId: 1,
              teacherId: 999,
              sessions: [{ teacherId: teacherBranch1.userId }],
            },
          },
        ],
      });
      await expect(service.findOne(12, teacherBranch1)).resolves.toMatchObject({ id: 12 });
    });

    it('throws NotFoundException when student does not exist', async () => {
      prisma.student.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999, managerBranch1)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

