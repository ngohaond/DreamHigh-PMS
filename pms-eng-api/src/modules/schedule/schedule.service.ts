import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SessionChangeType, SessionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toPublicUser } from '../../common/mappers/to-public-user';
import {
  CancelSessionDto,
  ChangeSessionRoomDto,
  ChangeSessionTeacherDto,
  RescheduleSessionDto,
} from './dto/reschedule-session.dto';
import {
  GenerateSessionsDto,
  GenerateSessionsForClassDto,
  ScheduleRuleDto,
} from './dto/generate-sessions.dto';
import { ScheduleRangeQueryDto } from './dto/schedule-query.dto';
import {
  buildSchedule,
  scheduleDateRange,
  ScheduleRuleError,
  type PlannedSession,
} from './utils/schedule-rule.util';
import { findOverlapping, isValidInterval, overlaps } from './utils/conflict.util';
import { ScheduleConflictException, type ScheduleConflictDetail } from './utils/schedule-conflict.exception';
import {
  appTimezone,
  formatLocalDate,
  formatLocalTime,
  parseLocalDate,
  parseLocalTime,
  toDateOnly,
  zonedTimeToUtc,
} from './utils/timezone.util';

export type AuthUser = {
  userId: number;
  email?: string;
  roles: string[];
  branchIds: number[];
};

const sessionInclude = {
  trainingClass: { include: { course: true, teacher: true } },
  room: true,
  teacher: true,
} as const;

type SessionWithRelations = Prisma.SessionGetPayload<{ include: typeof sessionInclude }>;

/** Buổi học đã hoàn tất khi endTime <= now và chưa bị huỷ (quyết định nghiệp vụ đã chốt). */
export function isSessionCompleted(session: { endTime: Date; status: SessionStatus }, now: Date): boolean {
  return session.status !== SessionStatus.CANCELLED && session.endTime.getTime() <= now.getTime();
}

@Injectable()
export class ScheduleService {
  constructor(private prisma: PrismaService) {}

  private get timeZone(): string {
    return appTimezone();
  }

  /** Chuẩn hóa response session sang dạng dễ tiêu thụ ở FE. */
  private serializeSession(session: SessionWithRelations) {
    const teacher = session.teacher ?? session.trainingClass?.teacher;
    return {
      id: session.id,
      classId: session.classId,
      classCode: session.trainingClass?.classCode ?? null,
      className: session.trainingClass?.course?.name ?? null,
      roomId: session.roomId,
      roomName: session.room?.name ?? session.room?.roomCode ?? null,
      teacherId: session.teacherId ?? session.trainingClass?.teacherId ?? null,
      teacherName: teacher ? toPublicUser(teacher).fullName : null,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime.toISOString(),
      localDate: formatLocalDate(session.startTime, this.timeZone),
      localStartTime: formatLocalTime(session.startTime, this.timeZone),
      localEndTime: formatLocalTime(session.endTime, this.timeZone),
      status: session.status,
      topicNote: session.topicNote,
    };
  }

  /**
   * Kiểm tra giáo viên và phòng có bị trùng lịch trong khoảng đề xuất hay không.
   * Bỏ qua session CANCELLED và các session nằm trong `excludeSessionIds`.
   */
  private async findConflict(
    params: {
      startTime: Date;
      endTime: Date;
      teacherId: number;
      roomId: number;
      excludeSessionIds?: number[];
    },
    tx?: Prisma.TransactionClient,
  ): Promise<ScheduleConflictDetail | null> {
    const prisma = tx ?? this.prisma;
    const excludeSessionIds = params.excludeSessionIds ?? [];

    const overlapping = await prisma.session.findMany({
      where: {
        status: { not: SessionStatus.CANCELLED },
        id: excludeSessionIds.length ? { notIn: excludeSessionIds } : undefined,
        OR: [
          { roomId: params.roomId },
          { teacherId: params.teacherId },
          // Session mượn giáo viên của lớp (teacherId = null) cũng phải tính vào xung đột GV.
          { teacherId: null, trainingClass: { teacherId: params.teacherId } },
        ],
        startTime: { lt: params.endTime },
        endTime: { gt: params.startTime },
      },
      include: {
        trainingClass: { include: { teacher: true } },
        room: true,
        teacher: true,
      },
    });

    for (const session of overlapping) {
      const sessionTeacherId = session.teacherId ?? session.trainingClass?.teacherId ?? null;
      const teacherName = session.teacher
        ? toPublicUser(session.teacher).fullName
        : session.trainingClass?.teacher
          ? toPublicUser(session.trainingClass.teacher).fullName
          : 'không xác định';

      if (session.roomId === params.roomId) {
        return {
          resourceType: 'ROOM',
          resourceName: session.room?.name ?? session.room?.roomCode ?? `#${session.roomId}`,
          classCode: session.trainingClass?.classCode ?? 'không xác định',
          conflictStartTime: session.startTime,
          conflictEndTime: session.endTime,
          conflictSessionId: session.id,
          requestedStartTime: params.startTime,
          requestedEndTime: params.endTime,
        };
      }

      if (sessionTeacherId != null && sessionTeacherId === params.teacherId) {
        return {
          resourceType: 'TEACHER',
          resourceName: teacherName,
          classCode: session.trainingClass?.classCode ?? 'không xác định',
          conflictStartTime: session.startTime,
          conflictEndTime: session.endTime,
          conflictSessionId: session.id,
          requestedStartTime: params.startTime,
          requestedEndTime: params.endTime,
        };
      }
    }

    return null;
  }

  private async assertNoConflict(
    params: {
      startTime: Date;
      endTime: Date;
      teacherId: number;
      roomId: number;
      excludeSessionIds?: number[];
    },
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const conflict = await this.findConflict(params, tx);
    if (conflict) {
      throw new ScheduleConflictException(conflict);
    }
  }

  /**
   * Kiểm tra conflict cho cả lô buổi, dùng một truy vấn lấy toàn bộ session
   * của GV/phòng trong khoảng rồi đối chiếu từng buổi bằng `findOverlapping`.
   * Trả về conflict đầu tiên gặp (theo thứ tự buổi) hoặc null.
   */
  private async findBatchConflict(
    params: {
      intervals: { startTime: Date; endTime: Date }[];
      teacherId: number;
      roomId: number;
      excludeSessionIds?: number[];
    },
    tx?: Prisma.TransactionClient,
  ): Promise<ScheduleConflictDetail | null> {
    if (params.intervals.length === 0) return null;

    const prisma = tx ?? this.prisma;
    const excludeSessionIds = params.excludeSessionIds ?? [];
    const rangeStart = params.intervals.reduce(
      (min, i) => (i.startTime < min ? i.startTime : min),
      params.intervals[0].startTime,
    );
    const rangeEnd = params.intervals.reduce(
      (max, i) => (i.endTime > max ? i.endTime : max),
      params.intervals[0].endTime,
    );

    const candidates = await prisma.session.findMany({
      where: {
        status: { not: SessionStatus.CANCELLED },
        id: excludeSessionIds.length ? { notIn: excludeSessionIds } : undefined,
        OR: [
          { roomId: params.roomId },
          { teacherId: params.teacherId },
          { teacherId: null, trainingClass: { teacherId: params.teacherId } },
        ],
        startTime: { lt: rangeEnd },
        endTime: { gt: rangeStart },
      },
      include: {
        trainingClass: { include: { teacher: true } },
        room: true,
        teacher: true,
      },
    });

    for (const interval of params.intervals) {
      const hit = findOverlapping(
        { start: interval.startTime, end: interval.endTime },
        candidates.map((c) => ({ id: c.id, start: c.startTime, end: c.endTime })),
      );
      if (!hit) continue;

      const session = candidates.find((c) => c.id === hit.id)!;
      const sessionTeacherId = session.teacherId ?? session.trainingClass?.teacherId ?? null;
      const teacherName = session.teacher
        ? toPublicUser(session.teacher).fullName
        : session.trainingClass?.teacher
          ? toPublicUser(session.trainingClass.teacher).fullName
          : 'không xác định';

      if (session.roomId === params.roomId) {
        return {
          resourceType: 'ROOM',
          resourceName: session.room?.name ?? session.room?.roomCode ?? `#${session.roomId}`,
          classCode: session.trainingClass?.classCode ?? 'không xác định',
          conflictStartTime: session.startTime,
          conflictEndTime: session.endTime,
          conflictSessionId: session.id,
          requestedStartTime: interval.startTime,
          requestedEndTime: interval.endTime,
        };
      }

      if (sessionTeacherId != null && sessionTeacherId === params.teacherId) {
        return {
          resourceType: 'TEACHER',
          resourceName: teacherName,
          classCode: session.trainingClass?.classCode ?? 'không xác định',
          conflictStartTime: session.startTime,
          conflictEndTime: session.endTime,
          conflictSessionId: session.id,
          requestedStartTime: interval.startTime,
          requestedEndTime: interval.endTime,
        };
      }
    }

    return null;
  }

  /** Ném 422 nếu bất kỳ buổi nào trong lô bị trùng GV/phòng. */
  private async assertNoBatchConflict(
    planned: { startTime: Date; endTime: Date }[],
    teacherId: number,
    roomId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const conflict = await this.findBatchConflict(
      { intervals: planned, teacherId, roomId },
      tx,
    );
    if (conflict) {
      throw new ScheduleConflictException(conflict);
    }
  }

  /** Chuẩn hóa DTO thành quy tắc lặp có timezone gắn sẵn. */
  private toRule(dto: ScheduleRuleDto) {
    return {
      weekdays: dto.weekdays,
      startDate: dto.startDate,
      endDate: dto.endDate ?? null,
      startTime: dto.startTime,
      endTime: dto.endTime,
      sessionCount: dto.sessionCount ?? null,
      timeZone: this.timeZone,
    };
  }

  private buildPlanned(dto: ScheduleRuleDto): PlannedSession[] {
    try {
      return buildSchedule(this.toRule(dto));
    } catch (error) {
      if (error instanceof ScheduleRuleError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /** Kiểm tra lịch mới có trùng với chính các buổi trong lô hay không. */
  private assertNoInternalOverlap(sessions: { startTime: Date; endTime: Date }[]) {
    const sorted = [...sessions].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime(),
    );
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (overlaps(prev.startTime, prev.endTime, curr.startTime, curr.endTime)) {
        throw new BadRequestException(
          `Lịch tự trùng lặp: buổi ${formatLocalDate(curr.startTime, this.timeZone)} ${formatLocalTime(curr.startTime, this.timeZone)} chồng lấn buổi trước.`,
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Preview & generate
  // -------------------------------------------------------------------------

  /**
   * Xem trước lịch sinh ra — không ghi DB.
   * Khi có `classId`, dùng giáo viên/phòng của lớp đó (trừ khi DTO ghi đè).
   */
  async previewSessions(
    dto: ScheduleRuleDto & { roomId?: number; teacherId?: number; classId?: number },
    user?: AuthUser,
  ) {
    const planned = this.buildPlanned(dto);
    this.assertNoInternalOverlap(planned);

    let teacherId = dto.teacherId;
    let roomId = dto.roomId;

    if (dto.classId != null) {
      const trainingClass = await this.prisma.trainingClass.findUnique({
        where: { id: dto.classId },
        include: { teacher: true },
      });
      if (!trainingClass) throw new NotFoundException('Lớp học không tồn tại');
      if (user) this.assertBranchAccess(user, trainingClass.branchId);
      teacherId = teacherId ?? trainingClass.teacherId;
      if (!roomId) {
        const lastSession = await this.prisma.session.findFirst({
          where: { classId: trainingClass.id },
          orderBy: { startTime: 'desc' },
          select: { roomId: true },
        });
        roomId = lastSession?.roomId;
      }
    }

    if (teacherId == null) {
      throw new BadRequestException('Cần giáo viên để xếp lịch');
    }

    const teacher = await this.prisma.systemUser.findUnique({
      where: { id: teacherId },
      include: { userBranches: true },
    });
    if (!teacher) throw new NotFoundException('Giáo viên không tồn tại');
    if (teacher.status !== 'ACTIVE') {
      throw new BadRequestException('Giáo viên không hoạt động, không thể xếp lịch');
    }

    if (roomId == null) {
      throw new BadRequestException('Cần phòng học để xếp lịch');
    }

    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Phòng học không tồn tại');
    if (room.status !== 'AVAILABLE') {
      throw new BadRequestException(`Phòng ${room.name ?? room.roomCode} không khả dụng để xếp lịch`);
    }

    const conflict = await this.findBatchConflict({
      intervals: planned,
      teacherId: teacher.id,
      roomId: room.id,
    });
    const conflicts = conflict ? [conflict] : [];

    return {
      sessions: planned.map((item) => ({
        startTime: item.startTime.toISOString(),
        endTime: item.endTime.toISOString(),
        localDate: item.date,
        localStartTime: formatLocalTime(item.startTime, this.timeZone),
        localEndTime: formatLocalTime(item.endTime, this.timeZone),
        weekday: item.weekday,
      })),
      total: planned.length,
      conflicts,
      hasConflict: conflicts.length > 0,
      timeZone: this.timeZone,
    };
  }

  /** Tạo lớp mới kèm lịch lặp và sinh session trong một transaction. */
  async generateSessions(dto: GenerateSessionsDto, user: AuthUser) {
    // Kiểm tra phạm vi chi nhánh trước mọi tra cứu/validate khác để user ngoài
    // phạm vi nhận 403 thay vì 400 nói lộ chi tiết khóa/phòng/GV của chi nhánh khác.
    this.assertBranchAccess(user, dto.branchId);

    const timeZone = this.timeZone;
    const planned = this.buildPlanned(dto);
    this.assertNoInternalOverlap(planned);

    const [course, branch, room, teacher] = await Promise.all([
      this.prisma.course.findUnique({ where: { id: dto.courseId } }),
      this.prisma.branch.findUnique({ where: { id: dto.branchId } }),
      this.prisma.room.findUnique({ where: { id: dto.roomId } }),
      this.prisma.systemUser.findUnique({
        where: { id: dto.teacherId },
        include: { userBranches: true },
      }),
    ]);

    if (!course) throw new NotFoundException('Khóa học không tồn tại');
    if (course.status !== 'ACTIVE') {
      throw new BadRequestException('Khóa học không hoạt động, không thể mở lớp');
    }
    if (!branch) throw new NotFoundException('Chi nhánh không tồn tại');
    if (branch.status !== 'ACTIVE') {
      throw new BadRequestException('Chi nhánh không hoạt động, không thể mở lớp');
    }
    if (!room) throw new NotFoundException('Phòng học không tồn tại');
    if (room.status !== 'AVAILABLE') {
      throw new BadRequestException(`Phòng ${room.name ?? room.roomCode} không khả dụng để xếp lịch`);
    }
    if (room.branchId !== branch.id) {
      throw new BadRequestException('Phòng học không thuộc chi nhánh của lớp');
    }
    if (!teacher) throw new NotFoundException('Giáo viên không tồn tại');
    if (teacher.status !== 'ACTIVE') {
      throw new BadRequestException('Giáo viên không hoạt động, không thể xếp lịch');
    }

    this.assertBranchAccess(user, branch.id);

    const teacherBranchIds = (teacher.userBranches ?? []).map((ub) => ub.branchId);
    if (teacherBranchIds.length > 0 && !teacherBranchIds.includes(branch.id)) {
      throw new BadRequestException('Giáo viên không thuộc chi nhánh của lớp');
    }

    if (room.capacity < dto.maxStudents) {
      throw new BadRequestException(
        `Sức chứa phòng (${room.capacity}) nhỏ hơn sĩ số tối đa của lớp (${dto.maxStudents})`,
      );
    }

    const existingClass = await this.prisma.trainingClass.findUnique({
      where: { classCode: dto.classCode },
    });
    if (existingClass) {
      throw new BadRequestException(`Mã lớp ${dto.classCode} đã tồn tại`);
    }

    // Kiểm tra conflict trước khi mở transaction, lại kiểm tra lại trong transaction.
    await this.assertNoBatchConflict(planned, teacher.id, room.id);

    const { startDate, endDate } = scheduleDateRange(planned);

    const created = await this.prisma.$transaction(async (tx) => {
      await this.assertNoBatchConflict(planned, teacher.id, room.id, tx);

      const trainingClass = await tx.trainingClass.create({
        data: {
          classCode: dto.classCode,
          courseId: course.id,
          branchId: branch.id,
          teacherId: teacher.id,
          maxStudents: dto.maxStudents,
          startDate,
          endDate,
          status: 'PLANNED',
        },
      });

      await tx.session.createMany({
        data: planned.map((item) => ({
          classId: trainingClass.id,
          roomId: room.id,
          teacherId: teacher.id,
          startTime: item.startTime,
          endTime: item.endTime,
          status: SessionStatus.NORMAL,
        })),
      });

      return tx.trainingClass.findUniqueOrThrow({
        where: { id: trainingClass.id },
        include: {
          course: true,
          teacher: true,
          sessions: { include: sessionInclude, orderBy: { startTime: 'asc' } },
        },
      });
    });

    return {
      statusCode: 201,
      message: `Đã tạo lớp ${created.classCode} với ${created.sessions.length} buổi học.`,
      data: {
        id: created.id,
        classCode: created.classCode,
        startDate: created.startDate,
        endDate: created.endDate,
        status: created.status,
        teacher: created.teacher ? toPublicUser(created.teacher) : null,
        sessions: created.sessions.map((s) => this.serializeSession(s)),
      },
      meta: { total: created.sessions.length, timeZone },
    };
  }

  /** Sinh thêm session cho một lớp đã tồn tại. */
  async generateSessionsForClass(
    classId: number,
    dto: GenerateSessionsForClassDto,
    user: AuthUser,
  ) {
    const trainingClass = await this.prisma.trainingClass.findUnique({
      where: { id: classId },
      include: { course: true, teacher: true },
    });
    if (!trainingClass) throw new NotFoundException('Lớp học không tồn tại');
    if (trainingClass.status === 'COMPLETED' || trainingClass.status === 'CANCELLED') {
      throw new BadRequestException('Không thể sinh buổi học cho lớp đã kết thúc hoặc đã huỷ');
    }

    this.assertBranchAccess(user, trainingClass.branchId);

    const room = await this.prisma.room.findUnique({ where: { id: dto.roomId } });
    if (!room) throw new NotFoundException('Phòng học không tồn tại');
    if (room.status !== 'AVAILABLE') {
      throw new BadRequestException(`Phòng ${room.name ?? room.roomCode} không khả dụng để xếp lịch`);
    }
    if (room.branchId !== trainingClass.branchId) {
      throw new BadRequestException('Phòng học không thuộc chi nhánh của lớp');
    }

    const teacherId = trainingClass.teacherId;
    const planned = this.buildPlanned(dto);
    this.assertNoInternalOverlap(planned);

    await this.assertNoBatchConflict(planned, teacherId, room.id);

    const created = await this.prisma.$transaction(async (tx) => {
      await this.assertNoBatchConflict(planned, teacherId, room.id, tx);

      await tx.session.createMany({
        data: planned.map((item) => ({
          classId: trainingClass.id,
          roomId: room.id,
          teacherId,
          startTime: item.startTime,
          endTime: item.endTime,
          status: SessionStatus.NORMAL,
        })),
      });

      return tx.session.findMany({
        where: { classId: trainingClass.id },
        include: sessionInclude,
        orderBy: { startTime: 'asc' },
      });
    });

    return {
      statusCode: 201,
      message: `Đã sinh ${planned.length} buổi học cho lớp ${trainingClass.classCode}.`,
      data: created.map((s) => this.serializeSession(s)),
      meta: { created: planned.length, timeZone: this.timeZone },
    };
  }

  // -------------------------------------------------------------------------
  // Reschedule / shift
  // -------------------------------------------------------------------------

  /** Dời lịch một buổi, tuỳ chọn dời tiếp các buổi sau của cùng lớp. */
  async rescheduleSession(sessionId: number, dto: RescheduleSessionDto, user: AuthUser) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { trainingClass: { include: { teacher: true } }, room: true, teacher: true },
    });
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    this.assertBranchAccess(user, session.trainingClass.branchId);
    this.assertMutable(session);

    const timeZone = this.timeZone;
    const currentStart = session.startTime;
    const currentEnd = session.endTime;
    const durationMs = currentEnd.getTime() - currentStart.getTime();

    let newStart: Date;
    if (dto.date) {
      const parts = parseLocalDate(dto.date);
      if (!parts) throw new BadRequestException('Ngày không hợp lệ (định dạng YYYY-MM-DD)');
      const startTimeParts = parseLocalTime(dto.startTime ?? formatLocalTime(currentStart, timeZone))!;
      newStart = zonedTimeToUtc(
        { ...parts, hour: startTimeParts.hour, minute: startTimeParts.minute },
        timeZone,
      );
    } else if (dto.startTime) {
      const startTimeParts = parseLocalTime(dto.startTime);
      if (!startTimeParts) throw new BadRequestException('Giờ bắt đầu không hợp lệ (định dạng HH:mm)');
      const local = this.toLocalParts(currentStart, timeZone);
      newStart = zonedTimeToUtc(
        { ...local, hour: startTimeParts.hour, minute: startTimeParts.minute },
        timeZone,
      );
    } else {
      newStart = currentStart;
    }

    let newEnd: Date;
    if (dto.endTime) {
      const endTimeParts = parseLocalTime(dto.endTime);
      if (!endTimeParts) throw new BadRequestException('Giờ kết thúc không hợp lệ (định dạng HH:mm)');
      const startLocal = this.toLocalParts(newStart, timeZone);
      newEnd = zonedTimeToUtc(
        { ...startLocal, hour: endTimeParts.hour, minute: endTimeParts.minute },
        timeZone,
      );
    } else {
      newEnd = new Date(newStart.getTime() + durationMs);
    }

    if (!isValidInterval(newStart, newEnd)) {
      throw new BadRequestException('Khoảng thời gian không hợp lệ: giờ kết thúc phải sau giờ bắt đầu');
    }

    const teacherId = session.teacherId ?? session.trainingClass.teacherId;
    const roomId = session.roomId;
    const deltaMs = newStart.getTime() - currentStart.getTime();

    const following = dto.shiftFollowing
      ? await this.prisma.session.findMany({
          where: {
            classId: session.classId,
            id: { not: session.id },
            startTime: { gt: currentStart },
            status: { not: SessionStatus.CANCELLED },
          },
          include: { trainingClass: { include: { teacher: true } }, room: true, teacher: true },
          orderBy: { startTime: 'asc' },
        })
      : [];

    const updates: {
      id: number;
      fromStartTime: Date;
      fromEndTime: Date;
      toStartTime: Date;
      toEndTime: Date;
      fromTeacherId: number | null;
      toTeacherId: number | null;
      fromRoomId: number;
      toRoomId: number;
      fromStatus: SessionStatus;
      toStatus: SessionStatus;
    }[] = [];

    for (const item of following) {
      const shiftedStart = new Date(item.startTime.getTime() + deltaMs);
      const shiftedEnd = new Date(item.endTime.getTime() + deltaMs);
      if (!isValidInterval(shiftedStart, shiftedEnd)) {
        throw new BadRequestException('Khoảng thời gian không hợp lệ sau khi dời lịch');
      }
      updates.push({
        id: item.id,
        fromStartTime: item.startTime,
        fromEndTime: item.endTime,
        toStartTime: shiftedStart,
        toEndTime: shiftedEnd,
        fromTeacherId: item.teacherId ?? item.trainingClass?.teacherId ?? null,
        toTeacherId: item.teacherId ?? item.trainingClass?.teacherId ?? null,
        fromRoomId: item.roomId,
        toRoomId: item.roomId,
        fromStatus: item.status,
        toStatus: SessionStatus.RESCHEDULED,
      });
    }

    const excludeIds = [session.id, ...following.map((f) => f.id)];

    await this.assertNoConflict({
      startTime: newStart,
      endTime: newEnd,
      teacherId,
      roomId,
      excludeSessionIds: excludeIds,
    });

    const shiftedIntervals = updates.map((update) => ({
      startTime: update.toStartTime,
      endTime: update.toEndTime,
    }));
    this.assertNoInternalOverlap(shiftedIntervals);

    for (const update of updates) {
      await this.assertNoConflict({
        startTime: update.toStartTime,
        endTime: update.toEndTime,
        teacherId: update.toTeacherId!,
        roomId: update.toRoomId,
        excludeSessionIds: excludeIds,
      });
    }

    const changedBy = user.userId;
    const result = await this.prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.session.update({
          where: { id: update.id },
          data: {
            startTime: update.toStartTime,
            endTime: update.toEndTime,
            status: update.toStatus,
          },
        });
        await tx.sessionChange.create({
          data: {
            sessionId: update.id,
            changedBy,
            changeType: SessionChangeType.SHIFT,
            reason: dto.reason ?? null,
            fromStartTime: update.fromStartTime,
            toStartTime: update.toStartTime,
            fromEndTime: update.fromEndTime,
            toEndTime: update.toEndTime,
            fromTeacherId: update.fromTeacherId,
            toTeacherId: update.toTeacherId,
            fromRoomId: update.fromRoomId,
            toRoomId: update.toRoomId,
            fromStatus: update.fromStatus,
            toStatus: update.toStatus,
          },
        });
      }

      const updated = await tx.session.update({
        where: { id: session.id },
        data: {
          startTime: newStart,
          endTime: newEnd,
          status: SessionStatus.RESCHEDULED,
        },
        include: sessionInclude,
      });

      await tx.sessionChange.create({
        data: {
          sessionId: session.id,
          changedBy,
          changeType: SessionChangeType.RESCHEDULE,
          reason: dto.reason ?? null,
          fromStartTime: currentStart,
          toStartTime: newStart,
          fromEndTime: currentEnd,
          toEndTime: newEnd,
          fromTeacherId: session.teacherId ?? session.trainingClass?.teacherId ?? null,
          toTeacherId: session.teacherId ?? session.trainingClass?.teacherId ?? null,
          fromRoomId: session.roomId,
          toRoomId: session.roomId,
          fromStatus: session.status,
          toStatus: SessionStatus.RESCHEDULED,
        },
      });

      return updated;
    });

    return {
      statusCode: 200,
      message: updates.length
        ? `Đã dời buổi học và ${updates.length} buổi sau.`
        : 'Đã dời buổi học.',
      data: {
        session: this.serializeSession(result),
        shiftedCount: updates.length,
      },
      meta: null,
    };
  }

  // -------------------------------------------------------------------------
  // Đổi giáo viên / phòng / hủy
  // -------------------------------------------------------------------------

  /** Đổi giáo viên thực dạy cho riêng một buổi. */
  async changeTeacher(sessionId: number, dto: ChangeSessionTeacherDto, user: AuthUser) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { trainingClass: { include: { teacher: true } }, room: true, teacher: true },
    });
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    this.assertBranchAccess(user, session.trainingClass.branchId);
    this.assertMutable(session);

    const teacher = await this.prisma.systemUser.findUnique({
      where: { id: dto.teacherId },
      include: { userBranches: true },
    });
    if (!teacher) throw new NotFoundException('Giáo viên không tồn tại');
    if (teacher.status !== 'ACTIVE') {
      throw new BadRequestException('Giáo viên không hoạt động, không thể phân công');
    }

    const teacherBranchIds = (teacher.userBranches ?? []).map((ub) => ub.branchId);
    if (
      teacherBranchIds.length > 0 &&
      !teacherBranchIds.includes(session.trainingClass.branchId)
    ) {
      throw new BadRequestException('Giáo viên không thuộc chi nhánh của lớp');
    }

    const previousTeacherId = session.teacherId ?? session.trainingClass.teacherId;

    await this.assertNoConflict({
      startTime: session.startTime,
      endTime: session.endTime,
      teacherId: teacher.id,
      roomId: session.roomId,
      excludeSessionIds: [session.id],
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.session.update({
        where: { id: session.id },
        data: { teacherId: teacher.id },
        include: sessionInclude,
      });

      await tx.sessionChange.create({
        data: {
          sessionId: session.id,
          changedBy: user.userId,
          changeType: SessionChangeType.CHANGE_TEACHER,
          reason: dto.reason ?? null,
          fromStartTime: session.startTime,
          toStartTime: session.startTime,
          fromEndTime: session.endTime,
          toEndTime: session.endTime,
          fromTeacherId: previousTeacherId,
          toTeacherId: teacher.id,
          fromRoomId: session.roomId,
          toRoomId: session.roomId,
          fromStatus: session.status,
          toStatus: session.status,
        },
      });

      return result;
    });

    return {
      statusCode: 200,
      message: `Đã đổi giáo viên buổi học thành ${toPublicUser(teacher).fullName}.`,
      data: this.serializeSession(updated),
      meta: null,
    };
  }

  /** Đổi phòng học cho riêng một buổi. */
  async changeRoom(sessionId: number, dto: ChangeSessionRoomDto, user: AuthUser) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { trainingClass: { include: { teacher: true } }, room: true, teacher: true },
    });
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    this.assertBranchAccess(user, session.trainingClass.branchId);
    this.assertMutable(session);

    const room = await this.prisma.room.findUnique({ where: { id: dto.roomId } });
    if (!room) throw new NotFoundException('Phòng học không tồn tại');
    if (room.status !== 'AVAILABLE') {
      throw new BadRequestException(`Phòng ${room.name ?? room.roomCode} không khả dụng để xếp lịch`);
    }
    if (room.branchId !== session.trainingClass.branchId) {
      throw new BadRequestException('Phòng học không thuộc chi nhánh của lớp');
    }

    const teacherId = session.teacherId ?? session.trainingClass.teacherId;

    await this.assertNoConflict({
      startTime: session.startTime,
      endTime: session.endTime,
      teacherId,
      roomId: room.id,
      excludeSessionIds: [session.id],
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.session.update({
        where: { id: session.id },
        data: { roomId: room.id },
        include: sessionInclude,
      });

      await tx.sessionChange.create({
        data: {
          sessionId: session.id,
          changedBy: user.userId,
          changeType: SessionChangeType.CHANGE_ROOM,
          reason: dto.reason ?? null,
          fromStartTime: session.startTime,
          toStartTime: session.startTime,
          fromEndTime: session.endTime,
          toEndTime: session.endTime,
          fromTeacherId: session.teacherId ?? session.trainingClass?.teacherId ?? null,
          toTeacherId: session.teacherId ?? session.trainingClass?.teacherId ?? null,
          fromRoomId: session.roomId,
          toRoomId: room.id,
          fromStatus: session.status,
          toStatus: session.status,
        },
      });

      return result;
    });

    return {
      statusCode: 200,
      message: `Đã đổi phòng buổi học thành ${room.name ?? room.roomCode}.`,
      data: this.serializeSession(updated),
      meta: null,
    };
  }

  /** Hủy một buổi học. */
  async cancelSession(sessionId: number, dto: CancelSessionDto, user: AuthUser) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { trainingClass: { include: { teacher: true } }, room: true, teacher: true },
    });
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    this.assertBranchAccess(user, session.trainingClass.branchId);
    this.assertMutable(session);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.session.update({
        where: { id: session.id },
        data: { status: SessionStatus.CANCELLED },
        include: sessionInclude,
      });

      await tx.sessionChange.create({
        data: {
          sessionId: session.id,
          changedBy: user.userId,
          changeType: SessionChangeType.CANCEL,
          reason: dto.reason,
          fromStartTime: session.startTime,
          toStartTime: session.startTime,
          fromEndTime: session.endTime,
          toEndTime: session.endTime,
          fromTeacherId: session.teacherId ?? session.trainingClass?.teacherId ?? null,
          toTeacherId: session.teacherId ?? session.trainingClass?.teacherId ?? null,
          fromRoomId: session.roomId,
          toRoomId: session.roomId,
          fromStatus: session.status,
          toStatus: SessionStatus.CANCELLED,
        },
      });

      return result;
    });

    return {
      statusCode: 200,
      message: 'Đã huỷ buổi học.',
      data: this.serializeSession(updated),
      meta: null,
    };
  }

  // -------------------------------------------------------------------------
  // Truy vấn
  // -------------------------------------------------------------------------

  /** Lịch cá nhân của giáo viên đang đăng nhập. Không nhận teacherId từ client. */
  async getMySchedule(query: ScheduleRangeQueryDto, user: AuthUser) {
    const { from, to, start, end } = this.resolveRange(query);

    const sessions = await this.prisma.session.findMany({
      where: {
        status: { not: SessionStatus.CANCELLED },
        startTime: { gte: start, lt: end },
        OR: [
          { teacherId: user.userId },
          { teacherId: null, trainingClass: { teacherId: user.userId } },
        ],
      },
      include: sessionInclude,
      orderBy: { startTime: 'asc' },
    });

    return {
      statusCode: 200,
      message: 'Lấy lịch cá nhân thành công',
      data: sessions.map((s) => this.serializeSession(s)),
      meta: { total: sessions.length, from, to, timeZone: this.timeZone },
    };
  }

  /** Tổng hời dạy thực tế theo giáo viên trong khoảng ngày. */
  async getTeachingHours(query: ScheduleRangeQueryDto, user: AuthUser) {
    const { from, to, start, end } = this.resolveRange(query);
    const now = new Date();
    const branchIds = this.allowedBranchIds(user);

    const sessions = await this.prisma.session.findMany({
      where: {
        status: { not: SessionStatus.CANCELLED },
        startTime: { gte: start, lt: end },
        ...(branchIds ? { trainingClass: { branchId: { in: branchIds } } } : {}),
      },
      include: sessionInclude,
      orderBy: { startTime: 'asc' },
    });

    const byTeacher = new Map<
      number,
      { teacherId: number; teacherName: string; totalMinutes: number; sessionCount: number }
    >();

    for (const session of sessions) {
      // Buổi tương lai hoặc chưa kết thúc chưa tính vào giờ dạy thực tế.
      if (!isSessionCompleted(session, now)) continue;

      const teacherId = session.teacherId ?? session.trainingClass?.teacherId;
      if (teacherId == null) continue;

      const minutes =
        (session.endTime.getTime() - session.startTime.getTime()) / 60000;
      const teacher = session.teacher ?? session.trainingClass?.teacher;
      const current = byTeacher.get(teacherId);
      if (current) {
        current.totalMinutes += minutes;
        current.sessionCount += 1;
      } else {
        byTeacher.set(teacherId, {
          teacherId,
          teacherName: teacher ? toPublicUser(teacher).fullName : `Giáo viên #${teacherId}`,
          totalMinutes: minutes,
          sessionCount: 1,
        });
      }
    }

    const rows = Array.from(byTeacher.values())
      .map((row) => ({
        teacherId: row.teacherId,
        teacherName: row.teacherName,
        sessionCount: row.sessionCount,
        totalMinutes: Math.round(row.totalMinutes),
        totalHours: Number((row.totalMinutes / 60).toFixed(2)),
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);

    const totalMinutes = rows.reduce((sum, r) => sum + r.totalMinutes, 0);

    return {
      statusCode: 200,
      message: 'Tổng hợp giờ dạy thành công',
      data: rows,
      meta: {
        from,
        to,
        totalMinutes,
        totalHours: Number((totalMinutes / 60).toFixed(2)),
        timeZone: this.timeZone,
      },
    };
  }

  /** Lịch sử thay đổi của một buổi học. */
  async getSessionHistory(sessionId: number, user: AuthUser) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { trainingClass: true },
    });
    if (!session) throw new NotFoundException('Buổi học không tồn tại');
    this.assertBranchAccess(user, session.trainingClass.branchId);

    const changes = await this.prisma.sessionChange.findMany({
      where: { sessionId },
      include: { changedByUser: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      statusCode: 200,
      message: 'Lấy lịch sử thay đổi buổi học thành công',
      data: changes.map((change) => ({
        id: change.id,
        changeType: change.changeType,
        reason: change.reason,
        createdAt: change.createdAt.toISOString(),
        changedBy: change.changedByUser ? toPublicUser(change.changedByUser) : null,
        fromStartTime: change.fromStartTime?.toISOString() ?? null,
        toStartTime: change.toStartTime?.toISOString() ?? null,
        fromEndTime: change.fromEndTime?.toISOString() ?? null,
        toEndTime: change.toEndTime?.toISOString() ?? null,
        fromTeacherId: change.fromTeacherId,
        toTeacherId: change.toTeacherId,
        fromRoomId: change.fromRoomId,
        toRoomId: change.toRoomId,
        fromStatus: change.fromStatus,
        toStatus: change.toStatus,
      })),
      meta: { total: changes.length },
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private toLocalParts(instant: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(instant);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return {
      year: get('year'),
      month: get('month'),
      day: get('day'),
      hour: get('hour'),
      minute: get('minute'),
    };
  }

  /** Chuyển khoảng ngày (giờ địa phương) thành khoảng UTC, đồng thời trả về giá trị gốc để trả về. */
  private resolveRange(query: ScheduleRangeQueryDto) {
    const from = parseLocalDate(query.from);
    const to = parseLocalDate(query.to);
    if (!from) throw new BadRequestException('from không hợp lệ (định dạng YYYY-MM-DD)');
    if (!to) throw new BadRequestException('to không hợp lệ (định dạng YYYY-MM-DD)');

    const fromKey = from.year * 10000 + from.month * 100 + from.day;
    const toKey = to.year * 10000 + to.month * 100 + to.day;
    if (fromKey >= toKey) {
      throw new BadRequestException('Khoảng ngày không hợp lệ: from phải nhỏ hơn to');
    }
    const days = Math.round(
      (toDateOnly(to.year, to.month, to.day).getTime() -
        toDateOnly(from.year, from.month, from.day).getTime()) /
        86400000,
    );
    if (days > 366) {
      throw new BadRequestException('Khoảng ngày tra cứu không được vượt quá 366 ngày');
    }

    const timeZone = this.timeZone;
    const start = zonedTimeToUtc({ ...from, hour: 0, minute: 0 }, timeZone);
    const end = zonedTimeToUtc({ ...to, hour: 0, minute: 0 }, timeZone);

    return { from: query.from, to: query.to, start, end };
  }

  /** Buổi đã hoàn tất hoặc đã huỷ thì không được sửa. */
  private assertMutable(session: { endTime: Date; status: SessionStatus }) {
    if (session.status === SessionStatus.CANCELLED) {
      throw new BadRequestException('Buổi học đã huỷ, không thể chỉnh sửa');
    }
    if (isSessionCompleted(session, new Date())) {
      throw new BadRequestException('Buổi học đã hoàn tất, không thể chỉnh sửa');
    }
  }

  /** Phạm vi chi nhánh: lấy từ JWT, không tin giá trị client gửi lên. */
  private assertBranchAccess(user: AuthUser, branchId: number) {
    const isSuperAdmin = user.roles.includes('ADMIN');
    if (isSuperAdmin) return;
    if (!user.branchIds.includes(branchId)) {
      throw new ForbiddenException('Bạn không có quyền truy cập lớp học ở chi nhánh này');
    }
  }

  /**
   * Danh sách chi nhánh user được phép xem.
   * ADMIN (super admin) không giới hạn — trả về null để bỏ qua filter.
   */
  private allowedBranchIds(user: AuthUser): number[] | null {
    if (user.roles.includes('ADMIN')) return null;
    return user.branchIds ?? [];
  }
}
