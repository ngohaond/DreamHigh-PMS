import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EnrollmentService, type EnrollmentAuthUser } from './enrollment.service';
import type { PrismaService } from '../../prisma/prisma.service';

const staff: EnrollmentAuthUser = { userId: 10, roles: ['STAFF'], branchIds: [3] };

function makePrisma() {
  const tx = {
    student: { findUnique: jest.fn() },
    program: { findUnique: jest.fn().mockResolvedValue({ id: 4, status: 'ACTIVE' }) },
    level: { findMany: jest.fn() },
    placementTest: { create: jest.fn(), findMany: jest.fn() },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
  };
  return { prisma, tx };
}

const placement = {
  branchId: 3,
  programId: 4,
  listeningScore: 50,
  readingScore: 30,
  writingScore: 20,
  testDate: '2026-10-23',
};

describe('EnrollmentService.recordPlacementTest', () => {
  it.each([100, 150])('maps and persists a total score on inclusive barem boundary %s', async (boundary) => {
    const { prisma, tx } = makePrisma();
    tx.student.findUnique.mockResolvedValue({ id: 7, classEnrollments: [] });
    tx.level.findMany.mockResolvedValue([
      { id: 9, code: 'LEVEL_A', name: 'Level A', minPlacementScore: 100, maxPlacementScore: 150, program: { id: 4, name: 'Program' } },
    ]);
    tx.placementTest.create.mockResolvedValue({ id: 12, recommendedLevel: { id: 9 } });
    const service = new EnrollmentService(prisma as unknown as PrismaService);

    const result = await service.recordPlacementTest(7, {
      ...placement,
      listeningScore: boundary,
      readingScore: 0,
      writingScore: 0,
    }, staff);

    expect(tx.level.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        minPlacementScore: { lte: boundary },
        maxPlacementScore: { gte: boundary },
      }),
    }));
    expect(tx.placementTest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        studentId: 7,
        branchId: 3,
        programId: 4,
        listeningScore: boundary,
        totalScore: boundary,
        recommendedLevelId: 9,
      }),
    }));
    expect(result.data.recommendedLevel.id).toBe(9);
  });

  it('persists a result with no recommended level when no configured barem matches', async () => {
    const { prisma, tx } = makePrisma();
    tx.student.findUnique.mockResolvedValue({ id: 7, classEnrollments: [] });
    tx.level.findMany.mockResolvedValue([]);
    tx.placementTest.create.mockResolvedValue({ id: 13, recommendedLevel: null });
    const service = new EnrollmentService(prisma as unknown as PrismaService);

    const result = await service.recordPlacementTest(7, placement, staff);

    expect(tx.placementTest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ totalScore: 100, recommendedLevelId: null }),
    }));
    expect(result.data.recommendedLevel).toBeNull();
  });

  it('rejects a student that does not exist', async () => {
    const { prisma, tx } = makePrisma();
    tx.student.findUnique.mockResolvedValue(null);
    const service = new EnrollmentService(prisma as unknown as PrismaService);

    await expect(service.recordPlacementTest(404, placement, staff)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a branch outside the current user scope', async () => {
    const { prisma, tx } = makePrisma();
    tx.student.findUnique.mockResolvedValue({ id: 7, classEnrollments: [] });
    const service = new EnrollmentService(prisma as unknown as PrismaService);

    await expect(service.recordPlacementTest(7, { ...placement, branchId: 8 }, staff)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(tx.placementTest.create).not.toHaveBeenCalled();
  });

  it('rejects when the student is enrolled in a different branch', async () => {
    const { prisma, tx } = makePrisma();
    tx.student.findUnique.mockResolvedValue({
      id: 7,
      classEnrollments: [{ trainingClass: { branchId: 8, teacherId: 11, sessions: [] } }],
    });
    const service = new EnrollmentService(prisma as unknown as PrismaService);

    await expect(service.recordPlacementTest(7, placement, staff)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.placementTest.create).not.toHaveBeenCalled();
  });
});