import { Body, Controller, Get, Param, ParseIntPipe, Post, Request, UseGuards } from '@nestjs/common';
import { EnrollmentService } from './enrollment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreatePlacementTestDto } from './dto/create-placement-test.dto';
import type { EnrollmentAuthUser } from './enrollment.service';

type RequestWithUser = { user: EnrollmentAuthUser };

@Controller('enrollment')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  @Post('leads/:id/convert')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  convertLeadToStudent(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { branchId: number; dob: string; gender?: string }
  ) {
    return this.enrollmentService.convertLeadToStudent(id, body);
  }

}

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlacementTestController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  @Post(':id/placement-tests')
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'TEACHER')
  recordPlacementTest(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreatePlacementTestDto,
    @Request() req: RequestWithUser,
  ) {
    return this.enrollmentService.recordPlacementTest(id, body, req.user);
  }

  @Get(':id/placement-tests')
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'TEACHER')
  getPlacementTests(@Param('id', ParseIntPipe) id: number, @Request() req: RequestWithUser) {
    return this.enrollmentService.getPlacementTests(id, req.user);
  }
}
