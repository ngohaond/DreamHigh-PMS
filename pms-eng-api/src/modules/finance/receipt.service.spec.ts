import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentMethod, Prisma } from '@prisma/client';
import { FinanceAuthUser } from './finance.service';
import { buildReceiptDocument, ReceiptService } from './receipt.service';

const branchStaff: FinanceAuthUser = { userId: 8, roles: ['STAFF'], branchIds: [3] };
const paymentDate = new Date('2026-10-23T09:00:00.000Z');

function makePayment() {
  return {
    id: 44,
    branchId: 3,
    amount: new Prisma.Decimal(125000),
    paymentMethod: PaymentMethod.BANK_TRANSFER,
    paidAt: paymentDate,
    transactionRef: 'BANK-REF-01',
    branch: {
      id: 3,
      code: 'HN',
      name: 'DreamHigh Hà Nội',
      address: '12 Nguyễn Du, Hà Nội',
      phone: '0240000000',
    },
    invoice: {
      invoiceNumber: 'INV-HN-2026-000014',
      feePlanNameSnapshot: 'Khóa học giao tiếp',
      student: { studentCode: 'DH000012', fullName: 'Nguyễn Thị Ánh' },
    },
  };
}

describe('ReceiptService', () => {
  let service: ReceiptService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      payment: { findUnique: jest.fn() },
      auditLog: { findFirst: jest.fn() },
      $queryRaw: jest.fn(),
    };
    service = new ReceiptService(prisma);
  });

  it('returns a PDF with the branch/year receipt number and all receipt data', async () => {
    prisma.payment.findUnique
      .mockResolvedValueOnce({ id: 44, branchId: 3, paidAt: paymentDate })
      .mockResolvedValueOnce(makePayment());
    prisma.auditLog.findFirst.mockResolvedValue({ user: { fullName: 'Trần Thu Hà' } });
    prisma.$queryRaw.mockResolvedValue([{ sequence: 1 }]);

    const result = await service.createPaymentReceipt(44, branchStaff);

    expect(result.fileName).toBe('receipt-RC-HN-2026-000001.pdf');
    expect(result.buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(prisma.payment.findUnique.mock.calls[0][0]).toEqual({
      where: { id: 44 },
      select: { id: true, branchId: true, paidAt: true },
    });
    expect(prisma.auditLog.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { resource: 'PAYMENT', action: 'CREATE', recordId: '44' },
      include: { user: { select: { fullName: true } } },
    }));

    const query = prisma.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(query.sql).toContain('branch_id =');
    expect(query.sql).toContain('paid_at >=');
    expect(query.sql).toContain('paid_at <');
    expect(query.sql).toContain('id <=');
    expect(query.values).toEqual([3, new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2027, 0, 1)), 44]);
  });

  it('does not load receipt details or render for a payment outside the caller branch', async () => {
    prisma.payment.findUnique.mockResolvedValue({ id: 44, branchId: 4, paidAt: paymentDate });

    await expect(service.createPaymentReceipt(44, branchStaff)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.payment.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.findFirst).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns not found for an unknown payment without attempting PDF work', async () => {
    prisma.payment.findUnique.mockResolvedValue(null);

    await expect(service.createPaymentReceipt(999, branchStaff)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.auditLog.findFirst).not.toHaveBeenCalled();
  });

  it('refuses to issue a receipt when the transactional collector audit is missing', async () => {
    prisma.payment.findUnique
      .mockResolvedValueOnce({ id: 44, branchId: 3, paidAt: paymentDate })
      .mockResolvedValueOnce(makePayment());
    prisma.auditLog.findFirst.mockResolvedValue({ user: null });

    await expect(service.createPaymentReceipt(44, branchStaff)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('builds a Vietnamese Unicode receipt document with the required fields', () => {
    const document = buildReceiptDocument({
      receiptNumber: 'RC-HN-2026-000001',
      paidAt: paymentDate,
      branch: makePayment().branch,
      student: makePayment().invoice.student,
      invoiceNumber: 'INV-HN-2026-000014',
      feePlanName: 'Khóa học giao tiếp',
      amount: 125000,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      transactionRef: 'BANK-REF-01',
      collectorName: 'Trần Thu Hà',
    });
    const content = JSON.stringify(document);

    expect(document.images.dreamHighLogo).toMatch(/^data:image\/png;base64,/);
    expect(document.content[0]).toMatchObject({ image: 'dreamHighLogo', width: 185, alignment: 'center' });
    expect(content).toContain('RC-HN-2026-000001');
    expect(content).toContain('Nguyễn Thị Ánh');
    expect(content).toContain('INV-HN-2026-000014');
    expect(content).toContain('125.000 VND');
    expect(content).toContain('Chuyển khoản');
    expect(content).toContain('BANK-REF-01');
    expect(content).toContain('Trần Thu Hà');
  });
});