import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DiscountType, InvoicePaymentStatus, PaymentMethod, Prisma } from '@prisma/client';
import { FinanceService, FinanceAuthUser } from './finance.service';

const staff: FinanceAuthUser = { userId: 8, roles: ['STAFF'], branchIds: [3] };
const feePlan = {
  id: 21,
  branchId: 3,
  courseId: 5,
  classId: null,
  name: 'Course fee',
  amount: 100001,
  effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
  isActive: true,
  branch: { id: 3, code: 'HN', status: 'ACTIVE' },
};

function makeInvoice(payments: { amount: Prisma.Decimal }[] = []) {
  return {
    id: 41,
    invoiceNumber: 'INV-HN-2026-000001',
    studentId: 12,
    branchId: 3,
    classId: 17,
    feePlanId: 21,
    issueDate: new Date('2026-10-23T00:00:00.000Z'),
    dueDate: new Date('2026-11-01T00:00:00.000Z'),
    totalAmount: new Prisma.Decimal(100001),
    discountAmount: new Prisma.Decimal(0),
    finalAmount: new Prisma.Decimal(100001),
    baseAmountSnapshot: 100001,
    feePlanNameSnapshot: 'Course fee',
    discountType: null,
    discountValue: null,
    paymentStatus: InvoicePaymentStatus.PENDING,
    notes: null,
    student: { id: 12, fullName: 'Test Student' },
    branch: { id: 3, code: 'HN' },
    trainingClass: { id: 17 },
    feePlan,
    payments: payments.map((payment, index) => ({
      ...payment,
      id: 60 + index,
      invoiceId: 41,
      branchId: 3,
      paymentMethod: PaymentMethod.CASH,
      paidAt: new Date('2026-10-23T00:00:00.000Z'),
      transactionRef: null,
      notes: null,
    })),
  };
}

describe('FinanceService', () => {
  let service: FinanceService;
  let prisma: any;
  let tx: any;
  let financeEvents: { emitPaymentSuccess: jest.Mock };

  beforeEach(() => {
    tx = {
      feePlan: { create: jest.fn(), update: jest.fn() },
      invoice: { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      payment: { create: jest.fn(), findUnique: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    prisma = {
      feePlan: { findUnique: jest.fn().mockResolvedValue(feePlan), findFirst: jest.fn() },
      student: { findUnique: jest.fn().mockResolvedValue({ id: 12 }) },
      classStudent: { findMany: jest.fn().mockResolvedValue([{ classId: 17 }]) },
      course: { findUnique: jest.fn() },
      trainingClass: { findUnique: jest.fn() },
      invoice: { findFirst: jest.fn() },
      payment: { findFirst: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([{ last_number: 7 }]),
      $transaction: jest.fn((callback: (transaction: any) => unknown) => callback(tx)),
    };
    financeEvents = { emitPaymentSuccess: jest.fn() };
    service = new FinanceService(prisma, financeEvents as any);
  });

  it('creates a discounted invoice with VND snapshot and floors the final percentage calculation', async () => {
    const createdInvoice = makeInvoice();
    tx.invoice.create.mockResolvedValue(createdInvoice);

    const result = await service.createInvoice(
      {
        feePlanId: 21,
        studentId: 12,
        dueDate: '2026-11-01',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 12.34,
      },
      staff,
    );

    const createData = tx.invoice.create.mock.calls[0][0].data;
    expect(createData.invoiceNumber).toMatch(/^INV-HN-2026-\d{6}$/);
    expect(createData.baseAmountSnapshot).toBe(100001);
    expect(createData.feePlanNameSnapshot).toBe('Course fee');
    expect(createData.discountAmount.toNumber()).toBe(12340);
    expect(createData.finalAmount.toNumber()).toBe(87661);
    expect(result.data).toMatchObject({ outstanding: 100001, paymentStatus: InvoicePaymentStatus.PENDING });
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('floors small decimal percentage discounts without floating-point rejection', async () => {
    tx.invoice.create.mockResolvedValue(makeInvoice());

    await service.createInvoice(
      {
        feePlanId: 21,
        studentId: 12,
        dueDate: '2026-11-01',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 0.29,
      },
      staff,
    );

    const createData = tx.invoice.create.mock.calls[0][0].data;
    expect(createData.discountAmount.toNumber()).toBe(290);
    expect(createData.finalAmount.toNumber()).toBe(99711);
  });

  it('rejects invoice creation when no active class relationship establishes branch ownership', async () => {
    prisma.classStudent.findMany.mockResolvedValue([]);

    await expect(
      service.createInvoice({ feePlanId: 21, studentId: 12, dueDate: '2026-11-01' }, staff),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it('rejects fee-plan mutations outside the user branch scope', async () => {
    await expect(
      service.createFeePlan(
        { branchId: 4, courseId: 5, name: 'Other branch', amount: 100000 },
        staff,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.course.findUnique).not.toHaveBeenCalled();
  });

  it('does not reveal invoices from another branch', async () => {
    prisma.invoice.findFirst.mockResolvedValue(null);

    await expect(service.getInvoice(41, staff)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 41, branchId: { in: [3] } },
    }));
  });

  it('rejects a fixed discount greater than the fee-plan snapshot', async () => {
    await expect(
      service.createInvoice(
        {
          feePlanId: 21,
          studentId: 12,
          dueDate: '2026-11-01',
          discountType: DiscountType.FIXED_AMOUNT,
          discountValue: 100002,
        },
        staff,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('updates invoice outstanding and status with the payment in one transaction', async () => {
    const beforePayment = makeInvoice();
    const afterPayment = makeInvoice([{ amount: new Prisma.Decimal(35000) }]);
    tx.invoice.findFirst.mockResolvedValue(beforePayment);
    tx.invoice.findUnique.mockResolvedValueOnce(beforePayment).mockResolvedValueOnce(afterPayment);
    tx.payment.findUnique.mockResolvedValue(null);
    tx.payment.create.mockResolvedValue({
      id: 67,
      invoiceId: 41,
      branchId: 3,
      amount: new Prisma.Decimal(35000),
      paymentMethod: PaymentMethod.CASH,
      paidAt: new Date('2026-10-23T00:00:00.000Z'),
      transactionRef: null,
      idempotencyKey: 'pay-1',
      requestHash: 'hash',
      notes: null,
    });
    const result = await service.recordPayment(
      41,
      'pay-1',
      { amount: 35000, paymentMethod: PaymentMethod.CASH, paidAt: '2026-10-23T00:00:00.000Z' },
      staff,
    );

    expect(tx.payment.create).toHaveBeenCalledTimes(1);
    expect(tx.invoice.update).toHaveBeenCalledWith({
      where: { id: 41 },
      data: { paymentStatus: InvoicePaymentStatus.PARTIAL },
    });
    expect(result.data.invoice).toMatchObject({ paidAmount: 35000, outstanding: 65001 });
    expect(result.data.payment).not.toHaveProperty('idempotencyKey');
    expect(result.data.payment).not.toHaveProperty('requestHash');
    expect(financeEvents.emitPaymentSuccess).toHaveBeenCalledWith(expect.objectContaining({
      paymentId: 67,
      invoiceId: 41,
      studentId: 12,
      branchId: 3,
      amount: 35000,
      paymentMethod: PaymentMethod.CASH,
    }));
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a payment greater than outstanding without writing payment or invoice status', async () => {
    const invoice = makeInvoice([{ amount: new Prisma.Decimal(80000) }]);
    tx.invoice.findFirst.mockResolvedValue(makeInvoice());
    tx.invoice.findUnique.mockResolvedValue(invoice);
    tx.payment.findUnique.mockResolvedValue(null);

    await expect(
      service.recordPayment(
        41,
        'pay-over',
        { amount: 20002, paymentMethod: PaymentMethod.BANK_TRANSFER, paidAt: '2026-10-23T00:00:00.000Z' },
        staff,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.invoice.update).not.toHaveBeenCalled();
  });

  it('returns the original payment on a matching idempotency replay', async () => {
    const dto = { amount: 35000, paymentMethod: PaymentMethod.CASH, paidAt: '2026-10-23T00:00:00.000Z' };
    const normalized = {
      invoiceId: 41,
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
      paidAt: new Date(dto.paidAt).toISOString(),
      transactionRef: null,
      notes: null,
    };
    const requestHash = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
    const previous = {
      id: 67,
      invoiceId: 41,
      branchId: 3,
      amount: new Prisma.Decimal(35000),
      paymentMethod: PaymentMethod.CASH,
      paidAt: new Date(dto.paidAt),
      transactionRef: null,
      idempotencyKey: 'pay-replay',
      requestHash,
      notes: null,
    };
    tx.invoice.findFirst.mockResolvedValue(makeInvoice());
    tx.payment.findUnique.mockResolvedValue(previous);
    tx.invoice.findUnique.mockResolvedValue(makeInvoice([{ amount: new Prisma.Decimal(35000) }]));

    const result = await service.recordPayment(41, 'pay-replay', dto, staff);

    expect(result.data.replayed).toBe(true);
    expect(result.data.payment.id).toBe(67);
    expect(result.data.invoice.outstanding).toBe(65001);
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(financeEvents.emitPaymentSuccess).not.toHaveBeenCalled();
  });

  it('rejects reuse of an idempotency key for a different payment payload', async () => {
    tx.invoice.findFirst.mockResolvedValue(makeInvoice());
    tx.invoice.findUnique.mockResolvedValue(makeInvoice());
    tx.payment.findUnique.mockResolvedValue({ requestHash: 'different-request' });

    await expect(
      service.recordPayment(
        41,
        'pay-reused',
        { amount: 35000, paymentMethod: PaymentMethod.CASH, paidAt: '2026-10-23T00:00:00.000Z' },
        staff,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.invoice.update).not.toHaveBeenCalled();
  });
});