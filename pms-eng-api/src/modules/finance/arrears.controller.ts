import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ArrearsQueryDto } from './dto/arrears-query.dto';
import { FinanceAuthUser } from './finance.service';
import { ArrearsService } from './arrears.service';

type AuthenticatedRequest = { user: FinanceAuthUser };

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ArrearsController {
  constructor(private readonly arrearsService: ArrearsService) {}

  @Get('arrears')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  getArrears(@Query() query: ArrearsQueryDto, @Request() req: AuthenticatedRequest) {
    return this.arrearsService.getArrears(query, req.user);
  }
}