import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DiscountType, InvoicePaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateFeePlanDto, ListFeePlansQueryDto, UpdateFeePlanDto } from './dto/fee-plan.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { FinanceEvents } from './finance.events';

export type FinanceAuthUser = {
  userId: number;
  roles: string[];
  branchIds: number[];
};

type FinanceTransaction = Prisma.TransactionClient;

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeEvents: FinanceEvents,
  ) {}

  async listFeePlans(query: ListFeePlansQueryDto, user: FinanceAuthUser) {
    if (query.branchId !== undefined) this.assertBranchAccess(user, query.branchId);
    const where: Prisma.FeePlanWhereInput = {
      ...(user.roles.includes('ADMIN') ? {} : { branchId: { in: user.branchIds } }),
      ...(query.branchId !== undefined ? { branchId: query.branchId } : {}),
      ...(query.courseId !== undefined ? { courseId: query.courseId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };
    const plans = await this.prisma.feePlan.findMany({
      where,
      include: { branch: true, course: true, trainingClass: true },
      orderBy: [{ branchId: 'asc' }, { effectiveFrom: 'desc' }, { id: 'desc' }],
    });
    return this.envelope(200, 'Lấy danh sách khung học phí thành công', plans);
  }

  async getFeePlan(id: number, user: FinanceAuthUser) {
    const plan = await this.findFeePlan(id, user);
    return this.envelope(200, 'Lấy thông tin khung học phí thành công', plan);
  }

  async createFeePlan(dto: CreateFeePlanDto, user: FinanceAuthUser, ipAddress?: string) {
    this.assertBranchAccess(user, dto.branchId);
    await this.assertActiveBranch(dto.branchId);
    await this.assertFeePlanReferences(dto.branchId, dto.courseId, dto.classId ?? null);
    const plan = await this.prisma.$transaction(async (tx) => {
      const created = await tx.feePlan.create({
        data: {
          branchId: dto.branchId,
          courseId: dto.courseId,
          classId: dto.classId ?? null,
          name: dto.name.trim(),
          amount: dto.amount,
          ...(dto.effectiveFrom ? { effectiveFrom: new Date(dto.effectiveFrom) } : {}),
        },
        include: { branch: true, course: true, trainingClass: true },
      });
      await this.writeAudit(tx, user, ipAddress, 'CREATE', 'FEE_PLAN', String(created.id), {
        branchId: created.branchId,
        courseId: created.courseId,
        classId: created.classId,
        amount: created.amount,
      });
      return created;
    });
    return this.envelope(201, 'Tạo khung học phí thành công', plan);
  }

  async updateFeePlan(id: number, dto: UpdateFeePlanDto, user: FinanceAuthUser, ipAddress?: string) {
    const existing = await this.findFeePlan(id, user);
    const branchId = dto.branchId ?? existing.branchId;
    const courseId = dto.courseId ?? existing.courseId;
    const classId = dto.classId === undefined ? existing.classId : dto.classId;
    this.assertBranchAccess(user, branchId);
    await this.assertActiveBranch(branchId);
    await this.assertFeePlanReferences(branchId, courseId, classId);

    const plan = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.feePlan.update({
        where: { id },
        data: {
          ...(dto.branchId !== undefined ? { branchId } : {}),
          ...(dto.courseId !== undefined ? { courseId } : {}),
          ...(dto.classId !== undefined ? { classId } : {}),
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
          ...(dto.effectiveFrom !== undefined ? { effectiveFrom: new Date(dto.effectiveFrom) } : {}),
        },
        include: { branch: true, course: true, trainingClass: true },
      });
      await this.writeAudit(tx, user, ipAddress, 'UPDATE', 'FEE_PLAN', String(id), {
        branchId: updated.branchId,
        changedFields: Object.keys(dto),
      });
      return updated;
    });
    return this.envelope(200, 'Cập nhật khung học phí thành công', plan);
  }

  async deactivateFeePlan(id: number, user: FinanceAuthUser, ipAddress?: string) {
    const existing = await this.findFeePlan(id, user);
    if (!existing.isActive) {
      return this.envelope(200, 'Khung học phí đã ngừng áp dụng', existing);
    }
    const plan = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.feePlan.update({ where: { id }, data: { isActive: false } });
      await this.writeAudit(tx, user, ipAddress, 'DEACTIVATE', 'FEE_PLAN', String(id), {
        branchId: updated.branchId,
      });
      return updated;
    });
    return this.envelope(200, 'Ngừng áp dụng khung học phí thành công', plan);
  }

  async createInvoice(dto: CreateInvoiceDto, user: FinanceAuthUser, ipAddress?: string) {
    const feePlan = await this.prisma.feePlan.findUnique({
      where: { id: dto.feePlanId },
      include: { branch: true },
    });
    if (!feePlan || !feePlan.isActive) {
      throw new NotFoundException('Khung học phí không tồn tại hoặc đã ngừng áp dụng');
    }
    this.assertBranchAccess(user, feePlan.branchId);
    if (feePlan.branch.status !== 'ACTIVE') {
      throw new BadRequestException('Chi nhánh của khung học phí đang ngừng hoạt động');
    }
    if (feePlan.effectiveFrom.getTime() > Date.now()) {
      throw new BadRequestException('Khung học phí chưa đến ngày hiệu lực');
    }
    const student = await this.prisma.student.findUnique({ where: { id: dto.studentId }, select: { id: true } });
    if (!student) throw new NotFoundException('Học viên không tồn tại');

    const classId = await this.resolveInvoiceClass(dto.classId, feePlan, dto.studentId);
    const discountAmount = this.calculateDiscount(feePlan.amount, dto.discountType, dto.discountValue);
    const finalAmount = feePlan.amount - discountAmount;
    const dueDate = new Date(dto.dueDate);
    const year = new Date().getUTCFullYear();
    const invoiceNumber = await this.reserveInvoiceNumber(feePlan.branchId, year, feePlan.branch.code);

    const invoice = await this.prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          studentId: dto.studentId,
          branchId: feePlan.branchId,
          classId,
          feePlanId: feePlan.id,
          issueDate: new Date(),
          dueDate,
          totalAmount: new Prisma.Decimal(feePlan.amount),
          discountAmount: new Prisma.Decimal(discountAmount),
          finalAmount: new Prisma.Decimal(finalAmount),
          baseAmountSnapshot: feePlan.amount,
          feePlanNameSnapshot: feePlan.name,
          discountType: dto.discountType ?? null,
          discountValue: dto.discountValue === undefined ? null : new Prisma.Decimal(dto.discountValue),
          notes: dto.notes?.trim() ?? null,
        },
        include: { student: true, branch: true, trainingClass: true, feePlan: true, payments: true },
      });
      await this.writeAudit(tx, user, ipAddress, 'CREATE', 'INVOICE', String(created.id), {
        branchId: feePlan.branchId,
        studentId: dto.studentId,
        invoiceNumber,
        baseAmount: feePlan.amount,
        discountAmount,
        finalAmount,
      });
      return created;
    });
    return this.envelope(201, 'Tạo hóa đơn thành công', this.invoiceState(invoice));
  }

  async getInvoice(id: number, user: FinanceAuthUser) {
    const invoice = await this.findInvoice(id, user);
    return this.envelope(200, 'Lấy thông tin hóa đơn thành công', this.invoiceState(invoice));
  }

  async recordPayment(
    invoiceId: number,
    idempotencyKey: string | undefined,
    dto: RecordPaymentDto,
    user: FinanceAuthUser,
    ipAddress?: string,
  ) {
    const key = idempotencyKey?.trim();
    if (!key || key.length > 128) {
      throw new BadRequestException('Header Idempotency-Key là bắt buộc và tối đa 128 ký tự');
    }
    const normalized = {
      invoiceId,
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
      paidAt: new Date(dto.paidAt).toISOString(),
      transactionRef: dto.transactionRef?.trim() || null,
      notes: dto.notes?.trim() || null,
    };
    const requestHash = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ locked: number }>>(Prisma.sql`
          SELECT CASE
            WHEN pg_advisory_xact_lock(hashtextextended(${key}, 0)) IS NULL THEN 1
            ELSE 0
          END AS locked
        `);
        const accessibleInvoice = await tx.invoice.findFirst({
          where: {
            id: invoiceId,
            branchId: user.roles.includes('ADMIN') ? { not: null } : { in: user.branchIds },
          },
          include: { student: true, branch: true, trainingClass: true, feePlan: true, payments: true },
        });
        if (!accessibleInvoice) throw new NotFoundException('Hóa đơn không tồn tại');
        if (accessibleInvoice.branchId === null) throw new NotFoundException('Hóa đơn không tồn tại');
        await tx.$queryRaw(Prisma.sql`SELECT id FROM invoices WHERE id = ${invoiceId} FOR UPDATE`);
        const invoice = await tx.invoice.findUnique({
          where: { id: invoiceId },
          include: { student: true, branch: true, trainingClass: true, feePlan: true, payments: true },
        });
        if (!invoice || invoice.branchId === null) throw new NotFoundException('Hóa đơn không tồn tại');

        const previous = await tx.payment.findUnique({ where: { idempotencyKey: key } });
        if (previous) {
          if (previous.requestHash !== requestHash) {
            throw new ConflictException('Idempotency-Key đã được dùng cho nội dung thanh toán khác');
          }
          return { payment: previous, invoice: this.invoiceState(invoice), replayed: true };
        }

        const paidSoFar = invoice.payments.reduce((total, payment) => total + Number(payment.amount), 0);
        const finalAmount = Number(invoice.finalAmount);
        const outstanding = finalAmount - paidSoFar;
        if (outstanding <= 0) throw new BadRequestException('Hóa đơn đã được thanh toán đủ');
        if (dto.amount > outstanding) throw new BadRequestException('Số tiền thu vượt số dư hóa đơn');

        const payment = await tx.payment.create({
          data: {
            invoiceId,
            branchId: invoice.branchId,
            amount: new Prisma.Decimal(dto.amount),
            paymentMethod: dto.paymentMethod,
            paidAt: new Date(dto.paidAt),
            transactionRef: normalized.transactionRef,
            idempotencyKey: key,
            requestHash,
            notes: normalized.notes,
          },
        });
        const paidTotal = paidSoFar + dto.amount;
        const status = this.paymentStatus(paidTotal, finalAmount);
        await tx.invoice.update({ where: { id: invoiceId }, data: { paymentStatus: status } });
        await this.writeAudit(tx, user, ipAddress, 'CREATE', 'PAYMENT', String(payment.id), {
          branchId: invoice.branchId,
          invoiceId,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          transactionRef: normalized.transactionRef,
          idempotencyKey: key,
        });
        const currentInvoice = await tx.invoice.findUnique({
          where: { id: invoiceId },
          include: { student: true, branch: true, trainingClass: true, feePlan: true, payments: true },
        });
        if (!currentInvoice) throw new NotFoundException('Hóa đơn không tồn tại');
        return { payment, invoice: this.invoiceState(currentInvoice), replayed: false };
      });
      if (!result.replayed) {
        this.financeEvents.emitPaymentSuccess({
          paymentId: result.payment.id,
          invoiceId: result.payment.invoiceId,
          studentId: result.invoice.student.id,
          branchId: result.payment.branchId!,
          amount: Number(result.payment.amount),
          paymentMethod: result.payment.paymentMethod,
          transactionRef: result.payment.transactionRef,
          paidAt: result.payment.paidAt,
        });
      }
      return this.envelope(201, result.replayed ? 'Thanh toán đã được ghi nhận trước đó' : 'Ghi nhận thanh toán thành công', {
        payment: this.publicPayment(result.payment),
        invoice: result.invoice,
        replayed: result.replayed,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Mã tham chiếu thanh toán đã được sử dụng tại chi nhánh này');
      }
      throw error;
    }
  }

  async getPayment(id: number, user: FinanceAuthUser) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id,
        ...(user.roles.includes('ADMIN') ? {} : { branchId: { in: user.branchIds } }),
      },
      include: {
        branch: true,
        invoice: { include: { student: true, branch: true, trainingClass: true, feePlan: true, payments: true } },
      },
    });
    if (!payment) throw new NotFoundException('Giao dịch thanh toán không tồn tại');
    return this.envelope(200, 'Lấy thông tin thanh toán thành công', {
      ...this.publicPayment(payment),
      invoice: this.invoiceState(payment.invoice),
    });
  }

  private async findFeePlan(id: number, user: FinanceAuthUser) {
    const plan = await this.prisma.feePlan.findFirst({
      where: { id, ...(user.roles.includes('ADMIN') ? {} : { branchId: { in: user.branchIds } }) },
      include: { branch: true, course: true, trainingClass: true },
    });
    if (!plan) throw new NotFoundException('Khung học phí không tồn tại');
    return plan;
  }

  private async findInvoice(id: number, user: FinanceAuthUser) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        ...(user.roles.includes('ADMIN') ? {} : { branchId: { in: user.branchIds } }),
      },
      include: { student: true, branch: true, trainingClass: true, feePlan: true, payments: true },
    });
    if (!invoice || invoice.branchId === null) throw new NotFoundException('Hóa đơn không tồn tại');
    return invoice;
  }

  private async assertFeePlanReferences(branchId: number, courseId: number, classId: number | null) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId }, select: { id: true, status: true } });
    if (!course) throw new NotFoundException('Khóa học không tồn tại');
    if (course.status !== 'ACTIVE') throw new BadRequestException('Khóa học đang ngừng hoạt động');
    if (classId === null) return;
    const trainingClass = await this.prisma.trainingClass.findUnique({
      where: { id: classId },
      select: { branchId: true, courseId: true },
    });
    if (!trainingClass) throw new NotFoundException('Lớp học không tồn tại');
    if (trainingClass.branchId !== branchId || trainingClass.courseId !== courseId) {
      throw new BadRequestException('Lớp học phải thuộc cùng chi nhánh và khóa học với khung học phí');
    }
  }

  private async assertActiveBranch(branchId: number) {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId }, select: { status: true } });
    if (!branch) throw new NotFoundException('Chi nhánh không tồn tại');
    if (branch.status !== 'ACTIVE') throw new BadRequestException('Chi nhánh đang ngừng hoạt động');
  }

  private async resolveInvoiceClass(
    requestedClassId: number | undefined,
    feePlan: { branchId: number; courseId: number; classId: number | null },
    studentId: number,
  ) {
    if (feePlan.classId !== null && requestedClassId !== undefined && requestedClassId !== feePlan.classId) {
      throw new BadRequestException('Lớp trên hóa đơn không khớp khung học phí');
    }
    const classId = feePlan.classId ?? requestedClassId;
    const enrollments = await this.prisma.classStudent.findMany({
      where: {
        studentId,
        status: 'ACTIVE',
        trainingClass: {
          branchId: feePlan.branchId,
          courseId: feePlan.courseId,
          ...(classId !== undefined ? { id: classId } : {}),
        },
      },
      select: { classId: true },
    });
    if (enrollments.length === 0) {
      throw new ForbiddenException('Không xác định được quyền sở hữu chi nhánh từ lớp đang học của học viên');
    }
    if (classId === undefined && enrollments.length > 1) {
      throw new BadRequestException('Học viên có nhiều lớp phù hợp; cần chỉ định classId');
    }
    return enrollments[0].classId;
  }

  private calculateDiscount(baseAmount: number, discountType?: DiscountType, discountValue?: number) {
    if (discountType === undefined) {
      if (discountValue !== undefined) throw new BadRequestException('discountValue cần có discountType');
      return 0;
    }
    if (discountValue === undefined) throw new BadRequestException('discountValue là bắt buộc khi có discountType');
    let discountAmount: number;
    if (discountType === DiscountType.PERCENTAGE) {
      if (discountValue > 100) throw new BadRequestException('Discount phần trăm không được vượt quá 100%');
      discountAmount = new Prisma.Decimal(baseAmount)
        .mul(new Prisma.Decimal(discountValue))
        .div(100)
        .floor()
        .toNumber();
    } else {
      if (!Number.isInteger(discountValue)) {
        throw new BadRequestException('Discount số tiền phải là VND nguyên');
      }
      discountAmount = discountValue;
    }
    if (discountAmount > baseAmount) throw new BadRequestException('Discount không được vượt học phí gốc');
    return discountAmount;
  }

  private async reserveInvoiceNumber(branchId: number, year: number, branchCode: string) {
    const rows = await this.prisma.$queryRaw<Array<{ last_number: number }>>(Prisma.sql`
      INSERT INTO invoice_sequences (branch_id, year, last_number)
      VALUES (${branchId}, ${year}, 1)
      ON CONFLICT (branch_id, year)
      DO UPDATE SET last_number = invoice_sequences.last_number + 1
      RETURNING last_number
    `);
    const sequence = rows[0]?.last_number;
    if (!sequence) throw new ConflictException('Không thể cấp số hóa đơn');
    return `INV-${branchCode}-${year}-${String(sequence).padStart(6, '0')}`;
  }

  private paymentStatus(paidAmount: number, finalAmount: number): InvoicePaymentStatus {
    if (paidAmount >= finalAmount) return InvoicePaymentStatus.COMPLETED;
    return paidAmount > 0 ? InvoicePaymentStatus.PARTIAL : InvoicePaymentStatus.PENDING;
  }

  private invoiceState<T extends {
    finalAmount: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    discountAmount: Prisma.Decimal | null;
    dueDate: Date | null;
    payments: {
      id: number;
      invoiceId: number;
      branchId: number | null;
      amount: Prisma.Decimal;
      paymentMethod: string;
      paidAt: Date;
      transactionRef: string | null;
      notes: string | null;
    }[];
    paymentStatus: InvoicePaymentStatus;
  }>(invoice: T) {
    const paidAmount = invoice.payments.reduce((total, payment) => total + Number(payment.amount), 0);
    const finalAmount = Number(invoice.finalAmount);
    const outstanding = finalAmount - paidAmount;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
    dueDate?.setUTCHours(0, 0, 0, 0);
    return {
      ...invoice,
      payments: invoice.payments.map((payment) => this.publicPayment(payment)),
      totalAmount: Number(invoice.totalAmount),
      discountAmount: invoice.discountAmount === null ? null : Number(invoice.discountAmount),
      finalAmount,
      paidAmount,
      outstanding,
      overdue: dueDate !== null && today.getTime() > dueDate.getTime() && outstanding > 0,
      paymentStatus: invoice.paymentStatus,
    };
  }

  private publicPayment<T extends {
    id: number;
    invoiceId: number;
    branchId: number | null;
    amount: Prisma.Decimal;
    paymentMethod: string;
    paidAt: Date;
    transactionRef: string | null;
    notes: string | null;
  }>(payment: T) {
    return {
      id: payment.id,
      invoiceId: payment.invoiceId,
      branchId: payment.branchId,
      amount: Number(payment.amount),
      paymentMethod: payment.paymentMethod,
      paidAt: payment.paidAt,
      transactionRef: payment.transactionRef,
      notes: payment.notes,
    };
  }

  private assertBranchAccess(user: FinanceAuthUser, branchId: number) {
    if (!user.roles.includes('ADMIN') && !user.branchIds.includes(branchId)) {
      throw new ForbiddenException('Bạn không có quyền thao tác tài chính tại chi nhánh này');
    }
  }

  private async writeAudit(
    tx: FinanceTransaction,
    user: FinanceAuthUser,
    ipAddress: string | undefined,
    action: string,
    resource: string,
    recordId: string,
    details: Prisma.InputJsonObject,
  ) {
    await tx.auditLog.create({
      data: {
        userId: user.userId,
        action,
        resource,
        recordId,
        ipAddress: ipAddress ?? null,
        details,
      },
    });
  }

  private envelope<T>(statusCode: number, message: string, data: T) {
    return { statusCode, message, data, meta: null };
  }
}