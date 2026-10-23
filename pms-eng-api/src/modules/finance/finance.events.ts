import { EventEmitter } from 'node:events';
import { Injectable } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';

export type PaymentSuccessEvent = {
  paymentId: number;
  invoiceId: number;
  studentId: number;
  branchId: number;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionRef: string | null;
  paidAt: Date;
};

@Injectable()
export class FinanceEvents {
  private readonly emitter = new EventEmitter();

  emitPaymentSuccess(event: PaymentSuccessEvent) {
    this.emitter.emit('payment.success', event);
  }

  onPaymentSuccess(listener: (event: PaymentSuccessEvent) => void) {
    this.emitter.on('payment.success', listener);
    return () => this.emitter.off('payment.success', listener);
  }
}