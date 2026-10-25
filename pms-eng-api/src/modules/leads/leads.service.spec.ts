import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LeadsService, type LeadsAuthUser } from './leads.service';
import type { PrismaService } from '../../prisma/prisma.service';

const admin: LeadsAuthUser = { userId: 1, roles: ['ADMIN'], branchIds: [] };
const staffBranch1: LeadsAuthUser = { userId: 2, roles: ['STAFF'], branchIds: [1] };

describe('LeadsService - Branch Isolation', () => {
  let service: LeadsService;
  let prisma: {
    lead: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      lead: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new LeadsService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('allows ADMIN to query all leads across all branches', async () => {
      prisma.lead.findMany.mockResolvedValue([]);
      await service.findAll(undefined, admin);

      expect(prisma.lead.findMany).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('scopes non-admin query to user branchIds when branchId is omitted', async () => {
      prisma.lead.findMany.mockResolvedValue([]);
      await service.findAll(undefined, staffBranch1);

      expect(prisma.lead.findMany).toHaveBeenCalledWith({
        where: {
          assignedUser: { userBranches: { some: { branchId: { in: [1] } } } },
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('allows non-admin to filter within authorized branch', async () => {
      prisma.lead.findMany.mockResolvedValue([]);
      await service.findAll(1, staffBranch1);

      expect(prisma.lead.findMany).toHaveBeenCalledWith({
        where: {
          assignedUser: { userBranches: { some: { branchId: 1 } } },
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('rejects non-admin attempt to query unauthorized branch with 403 Forbidden', async () => {
      await expect(service.findAll(2, staffBranch1)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.lead.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    const leadBranch1 = {
      id: 101,
      fullName: 'Lead Hanoi',
      assignedUser: { id: 5, userBranches: [{ branchId: 1 }] },
    };

    const leadBranch2 = {
      id: 102,
      fullName: 'Lead Saigon',
      assignedUser: { id: 6, userBranches: [{ branchId: 2 }] },
    };

    it('allows ADMIN to view lead assigned to any branch', async () => {
      prisma.lead.findUnique.mockResolvedValue(leadBranch2);
      const res = await service.findOne(102, admin);
      expect(res.id).toBe(102);
    });

    it('allows staff to view lead assigned within same branch', async () => {
      prisma.lead.findUnique.mockResolvedValue(leadBranch1);
      const res = await service.findOne(101, staffBranch1);
      expect(res.id).toBe(101);
    });

    it('blocks staff from viewing lead assigned to another branch', async () => {
      prisma.lead.findUnique.mockResolvedValue(leadBranch2);
      await expect(service.findOne(102, staffBranch1)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('denies staff access to an unassigned lead', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        id: 103,
        fullName: 'Unassigned lead',
        assignedUser: null,
      });
      await expect(service.findOne(103, staffBranch1)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when lead does not exist', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999, staffBranch1)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

