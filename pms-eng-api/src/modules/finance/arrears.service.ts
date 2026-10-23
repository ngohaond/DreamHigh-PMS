import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InvoicePaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ArrearsQueryDto, ArrearsStatus } from './dto/arrears-query.dto';
import { FinanceAuthUser } from './finance.service';

@Injectable()
export class ArrearsService {
  constructor(private readonly prisma: PrismaService) {}

  async getArrears(query: ArrearsQueryDto, user: FinanceAuthUser) {
    if (query.fromDate && query.toDate && query.fromDate > query.toDate) {
      throw new BadRequestException('fromDate phải nhỏ hơn hoặc bằng toDate');
    }
    if (query.branchId !== undefined && !user.roles.includes('ADMIN') && !user.branchIds.includes(query.branchId)) {
      throw new ForbiddenException('Bạn không có quyền xem công nợ của chi nhánh này');
    }

    const branchScope = user.roles.includes('ADMIN')
      ? query.branchId === undefined
        ? { not: null }
        : query.branchId
      : query.branchId ?? { in: user.branchIds };
    const dueDate: Prisma.DateTimeNullableFilter = { not: null };
    if (query.fromDate) dueDate.gte = this.utcDate(query.fromDate);
    if (query.toDate) dueDate.lt = this.utcDate(this.nextDate(query.toDate));

    const where: Prisma.InvoiceWhereInput = {
      branchId: branchScope,
      paymentStatus: { in: [InvoicePaymentStatus.PENDING, InvoicePaymentStatus.PARTIAL] },
      dueDate,
      ...(query.student
        ? {
            student: {
              is: {
                OR: [
                  { fullName: { contains: query.student, mode: 'insensitive' } },
                  { studentCode: { contains: query.student, mode: 'insensitive' } },
                ],
              },
            },
          }
        : {}),
    };

    return this.prisma.$transaction(
      async (tx) => {
        const invoices = await tx.invoice.findMany({
          where,
          include: {
            student: { select: { id: true, studentCode: true, fullName: true } },
            trainingClass: { select: { id: true, classCode: true } },
            payments: { select: { amount: true } },
          },
          orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
        });
        const now = new Date();
        const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        const matchingItems = invoices.flatMap((invoice) => {
          if (!invoice.dueDate) return [];
          const paidAmount = invoice.payments.reduce(
            (total, payment) => total.plus(payment.amount),
            new Prisma.Decimal(0),
          );
          const amountDue = new Prisma.Decimal(invoice.finalAmount).minus(paidAmount);
          if (amountDue.lte(0)) return [];

          const overdue = todayUtc > Date.UTC(
            invoice.dueDate.getUTCFullYear(),
            invoice.dueDate.getUTCMonth(),
            invoice.dueDate.getUTCDate(),
          );
          const status: ArrearsStatus = overdue ? 'OVERDUE' : 'CURRENT';
          if (query.status && query.status !== status) return [];

          return [{
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            student: invoice.student,
            class: invoice.trainingClass,
            amountDue: amountDue.toNumber(),
            dueDate: invoice.dueDate.toISOString().slice(0, 10),
            status,
            paymentStatus: invoice.paymentStatus,
          }];
        });

        const totalDebt = matchingItems.reduce(
          (total, item) => total.plus(item.amountDue),
          new Prisma.Decimal(0),
        );
        const overdueTotal = matchingItems.reduce(
          (total, item) => item.status === 'OVERDUE' ? total.plus(item.amountDue) : total,
          new Prisma.Decimal(0),
        );
        const studentCount = new Set(matchingItems.map((item) => item.student.id)).size;
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 25;
        const totalItems = matchingItems.length;
        const offset = (page - 1) * pageSize;

        return {
          statusCode: 200,
          message: 'Lấy báo cáo công nợ thành công',
          data: {
            totals: {
              totalDebt: totalDebt.toNumber(),
              studentCount,
              overdueTotal: overdueTotal.toNumber(),
            },
            items: matchingItems.slice(offset, offset + pageSize),
          },
          meta: {
            page,
            pageSize,
            totalItems,
            totalPages: Math.ceil(totalItems / pageSize),
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private utcDate(date: string) {
    return new Date(`${date}T00:00:00.000Z`);
  }

  private nextDate(date: string) {
    const nextDay = this.utcDate(date);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    return nextDay.toISOString().slice(0, 10);
  }
}