import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateFeePlanDto, ListFeePlansQueryDto, UpdateFeePlanDto } from './dto/fee-plan.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { FinanceService, FinanceAuthUser } from './finance.service';
import { ReceiptService } from './receipt.service';

type AuthenticatedRequest = {
  user: FinanceAuthUser;
  ip?: string;
};

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly receiptService: ReceiptService,
  ) {}

  @Get('fee-plans')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  listFeePlans(@Query() query: ListFeePlansQueryDto, @Request() req: AuthenticatedRequest) {
    return this.financeService.listFeePlans(query, req.user);
  }

  @Get('fee-plans/:id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  getFeePlan(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    return this.financeService.getFeePlan(id, req.user);
  }

  @Post('fee-plans')
  @Roles('ADMIN', 'MANAGER')
  createFeePlan(@Body() body: CreateFeePlanDto, @Request() req: AuthenticatedRequest) {
    return this.financeService.createFeePlan(body, req.user, req.ip);
  }

  @Patch('fee-plans/:id')
  @Roles('ADMIN', 'MANAGER')
  updateFeePlan(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateFeePlanDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.financeService.updateFeePlan(id, body, req.user, req.ip);
  }

  @Post('fee-plans/:id/deactivate')
  @Roles('ADMIN', 'MANAGER')
  deactivateFeePlan(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    return this.financeService.deactivateFeePlan(id, req.user, req.ip);
  }

  @Post('invoices')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  createInvoice(@Body() body: CreateInvoiceDto, @Request() req: AuthenticatedRequest) {
    return this.financeService.createInvoice(body, req.user, req.ip);
  }

  @Get('invoices/:id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  getInvoice(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    return this.financeService.getInvoice(id, req.user);
  }

  @Post('invoices/:id/payments')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  recordPayment(
    @Param('id', ParseIntPipe) id: number,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: RecordPaymentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.financeService.recordPayment(id, idempotencyKey, body, req.user, req.ip);
  }

  @Get('payments/:id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  getPayment(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    return this.financeService.getPayment(id, req.user);
  }

  @Get('payments/:id/receipt.pdf')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async downloadPaymentReceipt(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    const receipt = await this.receiptService.createPaymentReceipt(id, req.user);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${receipt.fileName}"`);
    response.setHeader('Content-Length', String(receipt.buffer.length));
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(receipt.buffer);
  }
}