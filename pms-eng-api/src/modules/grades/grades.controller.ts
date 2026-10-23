import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GradesService } from './grades.service';
import {
  CreateExamDto,
  BulkUpsertGradesDto,
  ListExamsQueryDto,
} from './dto';

export type RequestWithUser = Request & {
  user: {
    userId: number;
    email?: string;
    roles: string[];
    branchIds: number[];
  };
};

@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  /**
   * GET /api/classes/:id/exams
   * List all exams for a class with optional filtering
   * Access: ADMIN, MANAGER, TEACHER (own class only), STAFF
   */
  @Get('classes/:id/exams')
  @Roles('ADMIN', 'MANAGER', 'TEACHER', 'STAFF')
  async listExamsForClass(
    @Param('id', ParseIntPipe) classId: number,
    @Query() query: ListExamsQueryDto,
    @Req() req: RequestWithUser,
  ) {
    return this.gradesService.listExamsForClass(classId, query, req.user);
  }

  /**
   * POST /api/exams
   * Create a new exam for a class
   * Access: ADMIN, MANAGER, TEACHER (own class only)
   */
  @Post('exams')
  @Roles('ADMIN', 'MANAGER', 'TEACHER')
  async createExam(
    @Body() dto: CreateExamDto,
    @Req() req: RequestWithUser,
  ) {
    return this.gradesService.createExam(dto, req.user);
  }

  /**
   * POST /api/exams/:id/grades/bulk
   * Bulk upsert grades for an exam
   * Access: ADMIN, MANAGER, TEACHER (own class only)
   */
  @Post('exams/:id/grades/bulk')
  @Roles('ADMIN', 'MANAGER', 'TEACHER')
  async bulkUpsertGrades(
    @Param('id', ParseIntPipe) examId: number,
    @Body() dto: BulkUpsertGradesDto,
    @Req() req: RequestWithUser,
  ) {
    return this.gradesService.bulkUpsertGrades(examId, dto, req.user);
  }
}
