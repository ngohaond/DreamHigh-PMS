import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceAuthUser } from './finance.service';

type ReceiptPayment = {
  id: number;
  branchId: number | null;
  amount: Prisma.Decimal | number;
  paymentMethod: PaymentMethod | string;
  paidAt: Date;
  transactionRef: string | null;
  branch: { code: string; name: string; address: string | null; phone: string | null };
  invoice: {
    invoiceNumber: string;
    feePlanNameSnapshot: string | null;
    student: { studentCode: string; fullName: string };
  };
};

export type ReceiptDocumentData = {
  receiptNumber: string;
  paidAt: Date;
  branch: ReceiptPayment['branch'];
  student: ReceiptPayment['invoice']['student'];
  invoiceNumber: string;
  feePlanName: string | null;
  amount: number;
  paymentMethod: string;
  transactionRef: string | null;
  collectorName: string;
};

type PdfMakeDocument = {
  getBuffer(callback: (buffer: Uint8Array) => void): void;
};

type PdfMakeApi = {
  addVirtualFileSystem(files: Record<string, string>): void;
  setFonts(fonts: Record<string, Record<string, string>>): void;
  createPdf(definition: Record<string, unknown>): PdfMakeDocument;
};

const pdfMake = require('pdfmake/build/pdfmake') as PdfMakeApi;
const embeddedFonts = require('pdfmake/build/vfs_fonts') as Record<string, string>;

pdfMake.addVirtualFileSystem(embeddedFonts);
pdfMake.setFonts({
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
});
const dreamHighLogo = `data:image/png;base64,${readFileSync(join(__dirname, 'assets', 'dreamhigh-logo.png')).toString('base64')}`;

const paymentMethodLabels: Record<string, string> = {
  [PaymentMethod.CASH]: 'Tiền mặt',
  [PaymentMethod.BANK_TRANSFER]: 'Chuyển khoản',
  [PaymentMethod.CARD]: 'Thẻ',
  [PaymentMethod.E_WALLET]: 'Ví điện tử',
  [PaymentMethod.OTHER]: 'Khác',
};

export function buildReceiptDocument(data: ReceiptDocumentData) {
  const dateLabel = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(data.paidAt);
  const amountLabel = `${new Intl.NumberFormat('vi-VN').format(data.amount)} VND`;

  return {
    info: { title: `Phiếu thu ${data.receiptNumber}`, author: 'DreamHigh' },
    pageSize: 'A4',
    pageMargins: [52, 48, 52, 48],
    defaultStyle: { font: 'Roboto', fontSize: 11, color: '#121212' },
    images: { dreamHighLogo },
    styles: {
      brand: { fontSize: 12, bold: true, color: '#C89B3C' },
      title: { fontSize: 22, bold: true, color: '#121212', margin: [0, 14, 0, 4] },
      receiptNumber: { fontSize: 11, color: '#555555', margin: [0, 0, 0, 20] },
      section: { fontSize: 10, bold: true, color: '#C89B3C', margin: [0, 14, 0, 6] },
      amount: { fontSize: 19, bold: true, color: '#121212', margin: [0, 3, 0, 12] },
      footer: { fontSize: 9, color: '#555555', margin: [0, 28, 0, 0] },
    },
    content: [
      { image: 'dreamHighLogo', width: 185, alignment: 'center', margin: [0, 0, 0, 10] },
      { text: 'PHIẾU THU', style: 'title' },
      { text: `Số phiếu: ${data.receiptNumber}`, style: 'receiptNumber' },
      { text: data.branch.name, bold: true },
      ...(data.branch.address ? [{ text: data.branch.address }] : []),
      ...(data.branch.phone ? [{ text: `Điện thoại: ${data.branch.phone}` }] : []),
      { text: 'THÔNG TIN HỌC VIÊN', style: 'section' },
      { text: `Học viên: ${data.student.fullName}` },
      { text: `Mã học viên: ${data.student.studentCode}` },
      { text: `Hóa đơn: ${data.invoiceNumber}` },
      ...(data.feePlanName ? [{ text: `Khung học phí: ${data.feePlanName}` }] : []),
      { text: 'CHI TIẾT THANH TOÁN', style: 'section' },
      { text: `Ngày thu: ${dateLabel}` },
      { text: 'Số tiền:', margin: [0, 10, 0, 0] },
      { text: amountLabel, style: 'amount' },
      { text: `Phương thức: ${paymentMethodLabels[data.paymentMethod] ?? data.paymentMethod}` },
      { text: `Mã tham chiếu: ${data.transactionRef ?? 'Không có'}` },
      { text: `Người thu: ${data.collectorName}` },
      { text: 'Cảm ơn Quý phụ huynh và học viên.', style: 'footer' },
    ],
  };
}

@Injectable()
export class ReceiptService {
  constructor(private readonly prisma: PrismaService) {}

  async createPaymentReceipt(paymentId: number, user: FinanceAuthUser) {
    const scope = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, branchId: true, paidAt: true },
    });
    if (!scope || scope.branchId === null) {
      throw new NotFoundException('Giao dịch thanh toán không tồn tại');
    }
    if (!user.roles.includes('ADMIN') && !user.branchIds.includes(scope.branchId)) {
      throw new ForbiddenException('Bạn không có quyền xem phiếu thu của chi nhánh này');
    }

    const payment = (await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { branch: true, invoice: { include: { student: true } } },
    })) as ReceiptPayment | null;
    if (!payment || payment.branchId === null || !payment.branch) {
      throw new NotFoundException('Giao dịch thanh toán không tồn tại');
    }

    const audit = await this.prisma.auditLog.findFirst({
      where: { resource: 'PAYMENT', action: 'CREATE', recordId: String(paymentId) },
      include: { user: { select: { fullName: true } } },
      orderBy: { id: 'asc' },
    });
    if (!audit?.user?.fullName) {
      throw new ConflictException('Không thể lập phiếu thu vì thiếu thông tin người thu');
    }

    const year = payment.paidAt.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const nextYearStart = new Date(Date.UTC(year + 1, 0, 1));
    const sequenceRows = await this.prisma.$queryRaw<Array<{ sequence: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS sequence
      FROM payments
      WHERE branch_id = ${payment.branchId}
        AND paid_at >= ${yearStart}
        AND paid_at < ${nextYearStart}
        AND id <= ${payment.id}
    `);
    const sequence = sequenceRows[0]?.sequence;
    if (!Number.isInteger(sequence) || sequence < 1) {
      throw new ConflictException('Không thể cấp số phiếu thu');
    }

    const receiptNumber = `RC-${payment.branch.code}-${year}-${String(sequence).padStart(6, '0')}`;
    const buffer = await this.renderPdf({
      receiptNumber,
      paidAt: payment.paidAt,
      branch: payment.branch,
      student: payment.invoice.student,
      invoiceNumber: payment.invoice.invoiceNumber,
      feePlanName: payment.invoice.feePlanNameSnapshot,
      amount: Number(payment.amount),
      paymentMethod: payment.paymentMethod,
      transactionRef: payment.transactionRef,
      collectorName: audit.user.fullName,
    });

    return {
      buffer,
      fileName: `receipt-${receiptNumber.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`,
    };
  }

  private renderPdf(data: ReceiptDocumentData): Promise<Buffer> {
    return new Promise((resolve) => {
      pdfMake.createPdf(buildReceiptDocument(data) as unknown as Record<string, unknown>).getBuffer((bytes) => {
        resolve(Buffer.from(bytes));
      });
    });
  }
}