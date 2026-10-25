import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type LeadsAuthUser = {
  userId: number;
  roles: string[];
  branchIds: number[];
};

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  async findAll(branchId?: number, user?: LeadsAuthUser) {
    let branchCondition: any = {};

    if (user && !user.roles.includes('ADMIN')) {
      const allowed = user.branchIds ?? [];
      if (branchId != null) {
        if (!allowed.includes(branchId)) {
          throw new ForbiddenException('Bạn không có quyền truy cập lead ở chi nhánh này');
        }
        branchCondition = { assignedUser: { userBranches: { some: { branchId } } } };
      } else {
        branchCondition = { assignedUser: { userBranches: { some: { branchId: { in: allowed } } } } };
      }
    } else if (branchId != null) {
      branchCondition = { assignedUser: { userBranches: { some: { branchId } } } };
    }

    return this.prisma.lead.findMany({
      where: branchCondition,
      include: {
        assignedUser: { include: { userBranches: true } },
        convertedStudent: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, user?: LeadsAuthUser) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        assignedUser: { include: { userBranches: true } },
        convertedStudent: true,
      },
    });
    if (!lead) throw new NotFoundException('Lead không tồn tại');

    if (user && !user.roles.includes('ADMIN')) {
      const allowed = user.branchIds ?? [];
      const leadBranches = (lead.assignedUser?.userBranches ?? []).map((ub) => ub.branchId);
      if (leadBranches.length === 0 || !leadBranches.some((bid) => allowed.includes(bid))) {
        throw new ForbiddenException('Bạn không có quyền truy cập lead này');
      }
    }

    return lead;
  }

  async create(data: any) {
    return this.prisma.lead.create({
      data: {
        ...data,
        status: data.status || 'NEW',
      },
    });
  }

  async update(id: number, data: any, user?: LeadsAuthUser) {
    await this.findOne(id, user);
    return this.prisma.lead.update({
      where: { id },
      data,
    });
  }

  async delete(id: number, user?: LeadsAuthUser) {
    await this.findOne(id, user);
    return this.prisma.lead.delete({
      where: { id },
    });
  }
}
