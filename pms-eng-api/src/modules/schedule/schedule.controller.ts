import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ScheduleService, type AuthUser } from './schedule.service';
import {
  CancelSessionDto,
  ChangeSessionRoomDto,
  ChangeSessionTeacherDto,
  RescheduleSessionDto,
} from './dto/reschedule-session.dto';
import {
  GenerateSessionsDto,
  GenerateSessionsForClassDto,
  PreviewSessionsForClassDto,
} from './dto/generate-sessions.dto';
import { ScheduleRangeQueryDto } from './dto/schedule-query.dto';

type RequestWithUser = Request & { user: AuthUser };

@Controller('sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  /** Lịch cá nhân của giáo viên đang đăng nhập. */
  @Get('my-schedule')
  @Roles('TEACHER', 'MANAGER', 'ADMIN', 'STAFF')
  getMySchedule(@Request() req: RequestWithUser, @Query() query: ScheduleRangeQueryDto) {
    return this.scheduleService.getMySchedule(query, req.user);
  }

  /** Lịch sử thay đổi của một buổi học. */
  @Get(':id/history')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  getSessionHistory(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ) {
    return this.scheduleService.getSessionHistory(id, req.user);
  }

  /** Dời lịch một buổi, tuỳ chọn dời tiếp các buổi sau. */
  @Patch(':id/reschedule')
  @Roles('ADMIN', 'MANAGER')
  reschedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RescheduleSessionDto,
    @Request() req: RequestWithUser,
  ) {
    return this.scheduleService.rescheduleSession(id, body, req.user);
  }

  /** Đổi giáo viên thực dạy cho một buổi. */
  @Patch(':id/teacher')
  @Roles('ADMIN', 'MANAGER')
  changeTeacher(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ChangeSessionTeacherDto,
    @Request() req: RequestWithUser,
  ) {
    return this.scheduleService.changeTeacher(id, body, req.user);
  }

  /** Đổi phòng học cho một buổi. */
  @Patch(':id/room')
  @Roles('ADMIN', 'MANAGER')
  changeRoom(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ChangeSessionRoomDto,
    @Request() req: RequestWithUser,
  ) {
    return this.scheduleService.changeRoom(id, body, req.user);
  }

  /** Hủy một buổi học. */
  @Patch(':id/cancel')
  @Roles('ADMIN', 'MANAGER')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CancelSessionDto,
    @Request() req: RequestWithUser,
  ) {
    return this.scheduleService.cancelSession(id, body, req.user);
  }
}

/** Route theo lớp — tách controller để tránh va chạm `GET /classes/:code` hiện có. */
@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  /** Xem trước lịch sinh ra — không ghi DB. */
  @Post(':id/sessions/preview')
  @Roles('ADMIN', 'MANAGER')
  @HttpCode(HttpStatus.OK)
  preview(
    @Param('id', ParseIntPipe) classId: number,
    @Body() body: PreviewSessionsForClassDto,
    @Request() req: RequestWithUser,
  ) {
    return this.scheduleService.previewSessions({ ...body, classId }, req.user);
  }

  /** Tạo lớp mới kèm lịch lặp và sinh session trong một transaction. */
  @Post('with-sessions')
  @Roles('ADMIN', 'MANAGER')
  generateWithClass(
    @Body() body: GenerateSessionsDto,
    @Request() req: RequestWithUser,
  ) {
    return this.scheduleService.generateSessions(body, req.user);
  }

  /** Sinh thêm session cho một lớp đã tồn tại. */
  @Post(':id/sessions/generate')
  @Roles('ADMIN', 'MANAGER')
  generate(
    @Param('id', ParseIntPipe) classId: number,
    @Body() body: GenerateSessionsForClassDto,
    @Request() req: RequestWithUser,
  ) {
    return this.scheduleService.generateSessionsForClass(classId, body, req.user);
  }
}

/** Báo cáo giờ dạy. */
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly scheduleService: ScheduleService) {}

  /** Tổng giờ dạy theo giáo viên trong khoảng ngày. */
  @Get('teaching-hours')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  getTeachingHours(
    @Query() query: ScheduleRangeQueryDto,
    @Request() req: RequestWithUser,
  ) {
    return this.scheduleService.getTeachingHours(query, req.user);
  }
}
