import { ForbiddenException } from '@nestjs/common';
import { InvoicePaymentStatus, Prisma } from '@prisma/client';
import { ArrearsService } from './arrears.service';
import { FinanceAuthUser } from './finance.service';

const branchStaff: FinanceAuthUser = { userId: 8, roles: ['STAFF'], branchIds: [3] };

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    invoiceNumber: 'INV-HN-2026-000001',
    branchId: 3,
    finalAmount: new Prisma.Decimal(100000),
    dueDate: new Date('2026-10-24T00:00:00.000Z'),
    paymentStatus: InvoicePaymentStatus.PENDING,
    student: { id: 12, studentCode: 'DH-0012', fullName: 'Nguyen An' },
    trainingClass: { id: 17, classCode: 'ENG-A1' },
    payments: [],
    ...overrides,
  };
}

describe('ArrearsService', () => {
  let service: ArrearsService;
  let prisma: any;
  let tx: any;

  beforeEach(() => {
    tx = { invoice: { findMany: jest.fn().mockResolvedValue([]) } };
    prisma = {
      $transaction: jest.fn((callback: (transaction: any) => unknown) => callback(tx)),
    };
    service = new ArrearsService(prisma);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('computes debt, distinct students, and overdue totals across results while excluding paid invoices', async () => {
    tx.invoice.findMany.mockResolvedValue([
      makeInvoice({ id: 1, dueDate: new Date('2026-10-23T00:00:00.000Z') }),
      makeInvoice({
        id: 2,
        invoiceNumber: 'INV-HN-2026-000002',
        finalAmount: new Prisma.Decimal(80000),
        paymentStatus: InvoicePaymentStatus.PARTIAL,
        payments: [{ amount: new Prisma.Decimal(30000) }],
      }),
      makeInvoice({
        id: 3,
        finalAmount: new Prisma.Decimal(50000),
        paymentStatus: InvoicePaymentStatus.COMPLETED,
        payments: [{ amount: new Prisma.Decimal(50000) }],
      }),
      makeInvoice({
        id: 4,
        finalAmount: new Prisma.Decimal(40000),
        payments: [{ amount: new Prisma.Decimal(40000) }],
      }),
    ]);
    jest.useFakeTimers().setSystemTime(new Date('2026-10-24T12:00:00.000Z'));

    const result = await service.getArrears({ page: 2, pageSize: 1 } as any, branchStaff);

    expect(result.data.totals).toEqual({ totalDebt: 150000, studentCount: 1, overdueTotal: 100000 });
    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0]).toMatchObject({ invoiceId: 2, amountDue: 50000, status: 'CURRENT' });
    expect(result.meta).toEqual({ page: 2, pageSize: 1, totalItems: 2, totalPages: 2 });
    expect(tx.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        branchId: { in: [3] },
        paymentStatus: { in: [InvoicePaymentStatus.PENDING, InvoicePaymentStatus.PARTIAL] },
      }),
    }));
    expect(prisma.$transaction.mock.calls[0][1]).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  });

  it('classifies a due date equal to the UTC calendar day as current and the prior day as overdue', async () => {
    tx.invoice.findMany.mockResolvedValue([
      makeInvoice({ id: 1, dueDate: new Date('2026-10-24T00:00:00.000Z') }),
      makeInvoice({ id: 2, dueDate: new Date('2026-10-23T00:00:00.000Z') }),
    ]);
    jest.useFakeTimers().setSystemTime(new Date('2026-10-24T23:30:00+05:00'));

    const result = await service.getArrears({} as any, branchStaff);

    expect(result.data.items.map((item) => [item.dueDate, item.status])).toEqual([
      ['2026-10-24', 'CURRENT'],
      ['2026-10-23', 'OVERDUE'],
    ]);
  });

  it('applies due-date, student, status, and page filters while keeping totals for all matching rows', async () => {
    tx.invoice.findMany.mockResolvedValue([
      makeInvoice({ id: 1, dueDate: new Date('2026-10-20T00:00:00.000Z') }),
      makeInvoice({ id: 2, dueDate: new Date('2026-10-21T00:00:00.000Z') }),
    ]);
    jest.useFakeTimers().setSystemTime(new Date('2026-10-21T00:00:00.000Z'));

    const result = await service.getArrears({
      fromDate: '2026-10-20',
      toDate: '2026-10-21',
      student: 'DH-0012',
      status: 'CURRENT',
      page: 1,
      pageSize: 1,
    } as any, branchStaff);

    const query = tx.invoice.findMany.mock.calls[0][0];
    expect(query.where.dueDate).toMatchObject({
      gte: new Date('2026-10-20T00:00:00.000Z'),
      lt: new Date('2026-10-22T00:00:00.000Z'),
    });
    expect(query.where.student.is.OR).toEqual([
      { fullName: { contains: 'DH-0012', mode: 'insensitive' } },
      { studentCode: { contains: 'DH-0012', mode: 'insensitive' } },
    ]);
    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0]).toMatchObject({ invoiceId: 2, status: 'CURRENT' });
    expect(result.data.totals).toEqual({ totalDebt: 100000, studentCount: 1, overdueTotal: 0 });
    expect(result.meta).toEqual({ page: 1, pageSize: 1, totalItems: 1, totalPages: 1 });
  });

  it('rejects a requested branch outside the JWT branch scope without querying invoices', async () => {
    await expect(service.getArrears({ branchId: 4 } as any, branchStaff)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an inverted due-date range', async () => {
    await expect(service.getArrears({ fromDate: '2026-10-22', toDate: '2026-10-21' } as any, branchStaff))
      .rejects.toThrow('fromDate phải nhỏ hơn hoặc bằng toDate');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});