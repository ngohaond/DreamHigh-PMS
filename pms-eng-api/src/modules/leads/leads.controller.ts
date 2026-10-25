import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ParseIntPipe, Query, Request } from '@nestjs/common';
import { LeadsService, type LeadsAuthUser } from './leads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

type RequestWithUser = Request & { user: LeadsAuthUser };

@Controller('leads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  findAll(@Query('branchId') branchId: string | undefined, @Request() req: RequestWithUser) {
    const parsed = branchId && branchId.trim() !== '' && !Number.isNaN(Number(branchId)) ? Number(branchId) : undefined;
    return this.leadsService.findAll(parsed, req.user);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: RequestWithUser) {
    return this.leadsService.findOne(id, req.user);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  create(@Body() body: any) {
    return this.leadsService.create(body);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Request() req: RequestWithUser) {
    return this.leadsService.update(id, body, req.user);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  delete(@Param('id', ParseIntPipe) id: number, @Request() req: RequestWithUser) {
    return this.leadsService.delete(id, req.user);
  }
}
