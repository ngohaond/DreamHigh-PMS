import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SessionStatus } from '@prisma/client';
import { ScheduleService, isSessionCompleted, type AuthUser } from './schedule.service';
import { ScheduleConflictException } from './utils/schedule-conflict.exception';
import type { PrismaService } from '../../prisma/prisma.service';

const TZ = 'Asia/Ho_Chi_Minh';

/** 2026-03-02 là Thứ 2. Giờ địa phương 18:00 = 11:00 UTC. */
const local = (date: string, hhmm: string) =>
  new Date(`${date}T${hhmm}:00+07:00`);

const admin: AuthUser = { userId: 1, roles: ['ADMIN'], branchIds: [] };
const manager: AuthUser = { userId: 2, roles: ['MANAGER'], branchIds: [1] };
const teacher: AuthUser = { userId: 7, roles: ['TEACHER'], branchIds: [1] };

type PrismaMock = {
  session: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    createMany: jest.Mock;
    update: jest.Mock;
  };
  trainingClass: {
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  course: { findUnique: jest.Mock };
  branch: { findUnique: jest.Mock };
  room: { findUnique: jest.Mock };
  systemUser: { findUnique: jest.Mock };
  sessionChange: { findMany: jest.Mock; create: jest.Mock };
  $transaction: jest.Mock;
};

/**
 * Mô phỏng điều kiện `where` mà Prisma áp dụng ở tầng SQL cho bảng `sessions`.
 * Mock phải tôn trọng các bộ lọc này, nếu không service sẽ bị "loãng" và báo
 * conflict sai (ví dụ coi buổi học không chồng lấn là trùng).
 */
function matchesWhere(row: Record<string, any>, where?: Record<string, any>): boolean {
  if (!where) return true;

  if (where.status?.not !== undefined && row.status === where.status.not) return false;
  if (where.id?.notIn && where.id.notIn.includes(row.id)) return false;
  if (where.id?.not !== undefined && row.id === where.id.not) return false;
  if (where.classId !== undefined && row.classId !== where.classId) return false;

  const start = row.startTime as Date;
  const end = row.endTime as Date;
  if (where.startTime?.gte && start < where.startTime.gte) return false;
  if (where.startTime?.gt && start <= where.startTime.gt) return false;
  if (where.startTime?.lt && start >= where.startTime.lt) return false;
  if (where.endTime?.gt && end <= where.endTime.gt) return false;

  if (where.trainingClass?.branchId?.in) {
    if (!where.trainingClass.branchId.in.includes(row.trainingClass?.branchId)) return false;
  }

  if (where.OR) {
    const matched = where.OR.some((cond: Record<string, any>) => {
      if (cond.roomId !== undefined) return row.roomId === cond.roomId;
      if (cond.teacherId !== undefined && cond.teacherId !== null) {
        return row.teacherId === cond.teacherId;
      }
      if (cond.teacherId === null) {
        return (
          row.teacherId === null &&
          row.trainingClass?.teacherId === cond.trainingClass?.teacherId
        );
      }
      return false;
    });
    if (!matched) return false;
  }

  return true;
}

function makePrisma(): PrismaMock {
  const prisma: PrismaMock = {
    session: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
    },
    trainingClass: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    course: { findUnique: jest.fn() },
    branch: { findUnique: jest.fn() },
    room: { findUnique: jest.fn() },
    systemUser: { findUnique: jest.fn() },
    sessionChange: { findMany: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  };
  // Transaction callback chạy với chính mock để assert rollback logic.
  prisma.$transaction.mockImplementation((fn: (tx: PrismaMock) => unknown) => fn(prisma));
  prisma.sessionChange.create.mockResolvedValue({ id: 1 });
  prisma.session.findFirst.mockResolvedValue(null);

  /**
   * `session.findMany` phục vụ nhiều mục đích khác nhau (lấy buổi của lớp, tìm
   * xung đột, lịch cá nhân, giờ dạy). Mock lọc theo đúng `where` để mỗi test
   * chỉ cần khai báo tập buổi học tồn tại trong "DB".
   */
  const state = { sessions: [] as Record<string, any>[] };
  prisma.session.findMany.mockImplementation((args: { where?: Record<string, any> }) =>
    Promise.resolve(state.sessions.filter((row) => matchesWhere(row, args?.where))),
  );
  (prisma as unknown as { __state: typeof state }).__state = state;

  return prisma;
}

/** Khai báo các buổi học tồn tại trong "DB" cho test hiện tại. */
function setSessions(prisma: PrismaMock, rows: Record<string, any>[]) {
  (prisma as unknown as { __state: { sessions: Record<string, any>[] } }).__state.sessions = rows;
}

const teacherRow = { id: 7, fullName: 'Nguyễn Văn A', status: 'ACTIVE', userBranches: [{ branchId: 1 }] };
const roomRow = { id: 3, name: 'Phòng A1', capacity: 20, status: 'AVAILABLE', branchId: 1 };
const courseRow = { id: 2, name: 'IELTS Foundation', status: 'ACTIVE' };
const branchRow = { id: 1, name: 'Cơ sở Hà Nội', status: 'ACTIVE' };

const classRow = {
  id: 11,
  classCode: 'PY-K1-01',
  courseId: 2,
  branchId: 1,
  teacherId: 7,
  maxStudents: 15,
  startDate: new Date('2026-03-02T00:00:00Z'),
  endDate: new Date('2026-06-01T00:00:00Z'),
  status: 'PLANNED',
  teacher: teacherRow,
  course: courseRow,
};

/**
 * Buổi học mặc định nằm ở năm 2099 để còn "chưa diễn ra" — service chặn sửa
 * buổi đã hoàn tất nên fixture quá khứ sẽ bị từ chối ở mọi test biến động.
 */
const sessionRow = (overrides: Record<string, unknown> = {}) => ({
  id: 100,
  classId: 11,
  roomId: 3,
  teacherId: null,
  startTime: local('2099-03-02', '18:00'),
  endTime: local('2099-03-02', '19:30'),
  status: SessionStatus.NORMAL,
  topicNote: null,
  trainingClass: classRow,
  room: roomRow,
  teacher: null,
  ...overrides,
});

describe('ScheduleService', () => {
  let service: ScheduleService;
  let prisma: PrismaMock;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makePrisma();
    service = new ScheduleService(prisma as unknown as PrismaService);
  });

  describe('previewSessions', () => {
    beforeEach(() => {
      prisma.systemUser.findUnique.mockResolvedValue(teacherRow);
      prisma.room.findUnique.mockResolvedValue(roomRow);
      setSessions(prisma, []);
    });

    it('returns the planned sessions without writing to the database', async () => {
      const result = await service.previewSessions({
        weekdays: [1],
        startDate: '2099-03-02',
        endDate: '2099-03-16',
        startTime: '18:00',
        endTime: '19:30',
        roomId: 3,
        teacherId: 7,
      });

      expect(result.total).toBe(3);
      expect(result.hasConflict).toBe(false);
      expect(result.conflicts).toEqual([]);
      expect(result.sessions[0].localDate).toBe('2099-03-02');
      expect(result.sessions[0].localStartTime).toBe('18:00');
      expect(result.timeZone).toBe(TZ);
      expect(prisma.session.createMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('reports a room conflict when the room is already booked', async () => {
      setSessions(prisma, [
        sessionRow({ id: 900, startTime: local('2099-03-02', '18:30'), endTime: local('2099-03-02', '20:00') }),
      ]);

      const result = await service.previewSessions({
        weekdays: [1],
        startDate: '2099-03-02',
        endDate: '2099-03-02',
        startTime: '18:00',
        endTime: '19:30',
        roomId: 3,
        teacherId: 7,
      });

      expect(result.hasConflict).toBe(true);
      expect(result.conflicts[0].resourceType).toBe('ROOM');
      expect(result.conflicts[0].resourceName).toBe('Phòng A1');
    });

    it('reports a teacher conflict when the teacher is busy at another room', async () => {
      setSessions(prisma, [
        sessionRow({ id: 901, roomId: 9, room: { id: 9, name: 'Phòng B2' } }),
      ]);

      const result = await service.previewSessions({
        weekdays: [1],
        startDate: '2099-03-02',
        endDate: '2099-03-02',
        startTime: '18:00',
        endTime: '19:30',
        roomId: 3,
        teacherId: 7,
      });

      expect(result.hasConflict).toBe(true);
      expect(result.conflicts[0].resourceType).toBe('TEACHER');
      expect(result.conflicts[0].resourceName).toBe('Nguyễn Văn A');
    });

    it('does not conflict when the new session starts exactly when another one ends', async () => {
      setSessions(prisma, [
        sessionRow({ id: 902, startTime: local('2099-03-02', '17:00'), endTime: local('2099-03-02', '18:00') }),
      ]);

      const result = await service.previewSessions({
        weekdays: [1],
        startDate: '2099-03-02',
        endDate: '2099-03-02',
        startTime: '18:00',
        endTime: '19:30',
        roomId: 3,
        teacherId: 7,
      });

      expect(result.hasConflict).toBe(false);
    });

    it('rejects a non-active teacher', async () => {
      prisma.systemUser.findUnique.mockResolvedValue({ ...teacherRow, status: 'INACTIVE' });

      await expect(
        service.previewSessions({
          weekdays: [1],
          startDate: '2099-03-02',
          endDate: '2099-03-02',
          startTime: '18:00',
          endTime: '19:30',
          roomId: 3,
          teacherId: 7,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a room that is under maintenance', async () => {
      prisma.room.findUnique.mockResolvedValue({ ...roomRow, status: 'MAINTENANCE' });

      await expect(
        service.previewSessions({
          weekdays: [1],
          startDate: '2099-03-02',
          endDate: '2099-03-02',
          startTime: '18:00',
          endTime: '19:30',
          roomId: 3,
          teacherId: 7,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a rule whose end time is not after the start time', async () => {
      await expect(
        service.previewSessions({
          weekdays: [1],
          startDate: '2099-03-02',
          endDate: '2099-03-02',
          startTime: '19:30',
          endTime: '18:00',
          roomId: 3,
          teacherId: 7,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a rule whose end time equals the start time', async () => {
      await expect(
        service.previewSessions({
          weekdays: [1],
          startDate: '2099-03-02',
          endDate: '2099-03-02',
          startTime: '18:00',
          endTime: '18:00',
          roomId: 3,
          teacherId: 7,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a weekday outside the 1-7 range', async () => {
      await expect(
        service.previewSessions({
          weekdays: [0],
          startDate: '2099-03-02',
          endDate: '2099-03-02',
          startTime: '18:00',
          endTime: '19:30',
          roomId: 3,
          teacherId: 7,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a date range that ends before it starts', async () => {
      await expect(
        service.previewSessions({
          weekdays: [1],
          startDate: '2099-03-16',
          endDate: '2099-03-02',
          startTime: '18:00',
          endTime: '19:30',
          roomId: 3,
          teacherId: 7,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a session count below one', async () => {
      await expect(
        service.previewSessions({
          weekdays: [1],
          startDate: '2099-03-02',
          endDate: '2099-03-16',
          startTime: '18:00',
          endTime: '19:30',
          sessionCount: 0,
          roomId: 3,
          teacherId: 7,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('stops after the requested number of sessions', async () => {
      const result = await service.previewSessions({
        weekdays: [1],
        startDate: '2099-03-02',
        endDate: '2099-03-16',
        startTime: '18:00',
        endTime: '19:30',
        sessionCount: 2,
        roomId: 3,
        teacherId: 7,
      });

      expect(result.total).toBe(2);
      expect(result.sessions.map((s) => s.localDate)).toEqual(['2099-03-02', '2099-03-09']);
    });
  });

  describe('generateSessions', () => {
    beforeEach(() => {
      prisma.systemUser.findUnique.mockResolvedValue(teacherRow);
      prisma.room.findUnique.mockResolvedValue(roomRow);
      prisma.course.findUnique.mockResolvedValue(courseRow);
      prisma.branch.findUnique.mockResolvedValue(branchRow);
      // Kiểm tra mã lớp trùng dùng findUnique → không có lớp cùng mã.
      prisma.trainingClass.findUnique.mockResolvedValue(null);
      setSessions(prisma, []);
      prisma.trainingClass.create.mockResolvedValue({ ...classRow, id: 55 });
      prisma.trainingClass.findUniqueOrThrow.mockResolvedValue({
        ...classRow,
        id: 55,
        teacher: teacherRow,
        sessions: [sessionRow({ id: 501 })],
      });
    });

    const dto = {
      classCode: 'PY-K1-01',
      courseId: 2,
      branchId: 1,
      teacherId: 7,
      roomId: 3,
      maxStudents: 15,
      weekdays: [1],
      startDate: '2099-03-02',
      endDate: '2099-03-16',
      startTime: '18:00',
      endTime: '19:30',
    };

    it('creates the class and its sessions in one transaction', async () => {
      const result = await service.generateSessions(dto, admin);

      expect(result.statusCode).toBe(201);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.trainingClass.create).toHaveBeenCalledTimes(1);
      expect(prisma.session.createMany).toHaveBeenCalledTimes(1);
      const created = prisma.session.createMany.mock.calls[0][0];
      expect(created.data).toHaveLength(3);
      expect(result.data.sessions).toHaveLength(1);
    });

    it('rejects a duplicate class code', async () => {
      prisma.trainingClass.findUnique.mockResolvedValue(classRow);

      await expect(service.generateSessions(dto, admin)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a class whose headcount exceeds the room capacity', async () => {
      prisma.room.findUnique.mockResolvedValue({ ...roomRow, capacity: 10 });

      await expect(service.generateSessions(dto, admin)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.trainingClass.create).not.toHaveBeenCalled();
    });

    it('rejects a room that belongs to another branch', async () => {
      prisma.room.findUnique.mockResolvedValue({ ...roomRow, branchId: 5 });

      await expect(service.generateSessions(dto, admin)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a teacher who does not belong to the class branch', async () => {
      prisma.systemUser.findUnique.mockResolvedValue({ ...teacherRow, userBranches: [{ branchId: 9 }] });

      await expect(service.generateSessions(dto, admin)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a manager working outside their branch scope', async () => {
      await expect(
        service.generateSessions({ ...dto, branchId: 9 }, manager),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws 422 and creates nothing when one session in the batch conflicts', async () => {
      setSessions(prisma, [
        sessionRow({ id: 900, startTime: local('2099-03-09', '18:30'), endTime: local('2099-03-09', '20:00') }),
      ]);

      await expect(service.generateSessions(dto, admin)).rejects.toBeInstanceOf(ScheduleConflictException);
      expect(prisma.trainingClass.create).not.toHaveBeenCalled();
      expect(prisma.session.createMany).not.toHaveBeenCalled();
    });
  });

  describe('rescheduleSession', () => {
    beforeEach(() => {
      prisma.session.findUnique.mockResolvedValue(sessionRow());
      setSessions(prisma, []);
      prisma.session.update.mockImplementation(({ where }: { where: { id: number } }) =>
        Promise.resolve(sessionRow({ id: where.id, status: SessionStatus.RESCHEDULED })),
      );
    });

    it('moves a single session to a new time and records the change', async () => {
      const result = await service.rescheduleSession(
        100,
        { date: '2099-03-03', startTime: '19:00', reason: 'GV bận' },
        admin,
      );

      expect(result.statusCode).toBe(200);
      expect(result.data.shiftedCount).toBe(0);
      expect(prisma.session.update).toHaveBeenCalledTimes(1);
      const updateArg = prisma.session.update.mock.calls[0][0];
      expect(updateArg.data.startTime.toISOString()).toBe(local('2099-03-03', '19:00').toISOString());
      expect(prisma.sessionChange.create).toHaveBeenCalledTimes(1);
      expect(prisma.sessionChange.create.mock.calls[0][0].data.changeType).toBe('RESCHEDULE');
    });

    it('shifts the following sessions by the same delta and keeps their duration', async () => {
      const following = sessionRow({
        id: 101,
        startTime: local('2099-03-09', '18:00'),
        endTime: local('2099-03-09', '19:30'),
      });
      setSessions(prisma, [following]);
      prisma.session.update.mockImplementation(({ where }: { where: { id: number } }) =>
        Promise.resolve(sessionRow({ id: where.id })),
      );

      const result = await service.rescheduleSession(
        100,
        { date: '2099-03-03', shiftFollowing: true },
        admin,
      );

      expect(result.data.shiftedCount).toBe(1);
      expect(prisma.session.update).toHaveBeenCalledTimes(2);
      const shiftUpdate = prisma.session.update.mock.calls.find(
        (call) => call[0].where.id === 101,
      )!;
      // Giữ nguyên thời lượng 90 phút.
      expect(shiftUpdate[0].data.endTime.getTime() - shiftUpdate[0].data.startTime.getTime()).toBe(
        90 * 60 * 1000,
      );
      expect(prisma.sessionChange.create).toHaveBeenCalledTimes(2);
    });

    it('rejects a session that already ended', async () => {
      prisma.session.findUnique.mockResolvedValue(
        sessionRow({
          startTime: local('2020-01-01', '18:00'),
          endTime: local('2020-01-01', '19:30'),
        }),
      );

      await expect(
        service.rescheduleSession(100, { date: '2099-03-03' }, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects rescheduling a cancelled session', async () => {
      prisma.session.findUnique.mockResolvedValue(sessionRow({ status: SessionStatus.CANCELLED }));

      await expect(
        service.rescheduleSession(100, { date: '2099-03-03' }, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a target time where the teacher is already booked', async () => {
      setSessions(prisma, [
        sessionRow({ id: 902, roomId: 9, startTime: local('2099-03-03', '19:00'), endTime: local('2099-03-03', '20:00') }),
      ]);

      await expect(
        service.rescheduleSession(100, { date: '2099-03-03', startTime: '19:00' }, admin),
      ).rejects.toBeInstanceOf(ScheduleConflictException);
    });

    it('rejects a manager rescheduling a session outside their branch', async () => {
      prisma.session.findUnique.mockResolvedValue(sessionRow({ trainingClass: { ...classRow, branchId: 9 } }));

      await expect(
        service.rescheduleSession(100, { date: '2099-03-03' }, manager),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects an end time that is not after the new start time', async () => {
      await expect(
        service.rescheduleSession(
          100,
          { date: '2099-03-03', startTime: '19:00', endTime: '18:00' },
          admin,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an end time equal to the new start time', async () => {
      await expect(
        service.rescheduleSession(
          100,
          { date: '2099-03-03', startTime: '19:00', endTime: '19:00' },
          admin,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('keeps the gap between shifted sessions and the session being moved', async () => {
      const second = sessionRow({
        id: 101,
        startTime: local('2099-03-09', '18:00'),
        endTime: local('2099-03-09', '19:30'),
      });
      const third = sessionRow({
        id: 102,
        startTime: local('2099-03-16', '18:00'),
        endTime: local('2099-03-16', '19:30'),
      });
      setSessions(prisma, [second, third]);
      prisma.session.update.mockImplementation(({ where }: { where: { id: number } }) =>
        Promise.resolve(sessionRow({ id: where.id })),
      );

      await service.rescheduleSession(
        100,
        { date: '2099-03-03', shiftFollowing: true },
        admin,
      );

      const updateOf = (id: number) =>
        prisma.session.update.mock.calls.find((call) => call[0].where.id === id)![0].data;

      // Buổi gốc dời từ 02/03 sang 03/03 → lệch +1 ngày.
      const movedStart = updateOf(100).startTime.getTime();
      const secondStart = updateOf(101).startTime.getTime();
      const thirdStart = updateOf(102).startTime.getTime();

      // Khoảng cách giữa các buổi được giữ nguyên (7 ngày).
      expect(secondStart - movedStart).toBe(7 * 24 * 60 * 60 * 1000);
      expect(thirdStart - secondStart).toBe(7 * 24 * 60 * 60 * 1000);
      // Mỗi buổi giữ nguyên thời lượng 90 phút.
      for (const id of [100, 101, 102]) {
        const data = updateOf(id);
        expect(data.endTime.getTime() - data.startTime.getTime()).toBe(90 * 60 * 1000);
      }
    });

    it('skips cancelled sessions when shifting the following ones', async () => {
      const cancelled = sessionRow({
        id: 101,
        status: SessionStatus.CANCELLED,
        startTime: local('2099-03-09', '18:00'),
        endTime: local('2099-03-09', '19:30'),
      });
      setSessions(prisma, [cancelled]);
      prisma.session.update.mockImplementation(({ where }: { where: { id: number } }) =>
        Promise.resolve(sessionRow({ id: where.id })),
      );

      const result = await service.rescheduleSession(
        100,
        { date: '2099-03-03', shiftFollowing: true },
        admin,
      );

      expect(result.data.shiftedCount).toBe(0);
      expect(prisma.session.update).toHaveBeenCalledTimes(1);
      expect(prisma.session.update.mock.calls[0][0].where.id).toBe(100);
    });

    it('rolls back the whole group when one shifted session conflicts', async () => {
      const second = sessionRow({
        id: 101,
        startTime: local('2099-03-09', '18:00'),
        endTime: local('2099-03-09', '19:30'),
      });
      // Buổi của lớp khác chiếm đúng chỗ mà buổi 101 sẽ dời tới (10/03).
      const blocker = sessionRow({
        id: 903,
        classId: 12,
        roomId: 9,
        startTime: local('2099-03-10', '18:00'),
        endTime: local('2099-03-10', '19:30'),
      });
      setSessions(prisma, [second, blocker]);
      prisma.session.update.mockImplementation(({ where }: { where: { id: number } }) =>
        Promise.resolve(sessionRow({ id: where.id })),
      );

      await expect(
        service.rescheduleSession(100, { date: '2099-03-03', shiftFollowing: true }, admin),
      ).rejects.toBeInstanceOf(ScheduleConflictException);

      expect(prisma.session.update).not.toHaveBeenCalled();
      expect(prisma.sessionChange.create).not.toHaveBeenCalled();
    });
  });

  describe('changeTeacher / changeRoom', () => {
    beforeEach(() => {
      prisma.session.findUnique.mockResolvedValue(sessionRow());
      setSessions(prisma, []);
      prisma.session.update.mockImplementation(({ where }: { where: { id: number } }) =>
        Promise.resolve(sessionRow({ id: where.id })),
      );
      prisma.systemUser.findUnique.mockResolvedValue({
        id: 8,
        fullName: 'Lê Thu Hà',
        status: 'ACTIVE',
        userBranches: [{ branchId: 1 }],
      });
    });

    it('assigns a new teacher to a single session without touching the class teacher', async () => {
      const result = await service.changeTeacher(100, { teacherId: 8, reason: 'Thay GV' }, admin);

      expect(result.statusCode).toBe(200);
      expect(prisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { teacherId: 8 } }),
      );
      // GV của lớp không đổi — chỉ riêng buổi này được gán GV khác.
      expect(prisma.trainingClass.update).not.toHaveBeenCalled();
      expect(prisma.sessionChange.create.mock.calls[0][0].data.changeType).toBe('CHANGE_TEACHER');
      expect(prisma.sessionChange.create.mock.calls[0][0].data.fromTeacherId).toBe(7);
      expect(prisma.sessionChange.create.mock.calls[0][0].data.toTeacherId).toBe(8);
    });

    it('rejects a teacher who is already teaching in that slot', async () => {
      setSessions(prisma, [
        sessionRow({ id: 903, roomId: 9, teacherId: 8 }),
      ]);

      await expect(service.changeTeacher(100, { teacherId: 8 }, admin)).rejects.toBeInstanceOf(
        ScheduleConflictException,
      );
    });

    it('rejects an inactive teacher', async () => {
      prisma.systemUser.findUnique.mockResolvedValue({
        id: 8,
        fullName: 'Lê Thu Hà',
        status: 'INACTIVE',
        userBranches: [{ branchId: 1 }],
      });

      await expect(service.changeTeacher(100, { teacherId: 8 }, admin)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects a room that belongs to another branch', async () => {
      prisma.room.findUnique.mockResolvedValue({ ...roomRow, branchId: 5 });

      await expect(service.changeRoom(100, { roomId: 3 }, admin)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects a room already booked in that slot', async () => {
      prisma.room.findUnique.mockResolvedValue(roomRow);
      setSessions(prisma, [
        sessionRow({ id: 904, teacherId: 8 }),
      ]);

      await expect(service.changeRoom(100, { roomId: 3 }, admin)).rejects.toBeInstanceOf(
        ScheduleConflictException,
      );
    });

    it('records the previous and the new room in the change log', async () => {
      prisma.room.findUnique.mockResolvedValue({ ...roomRow, id: 5, name: 'Phòng B2' });

      const result = await service.changeRoom(100, { roomId: 5, reason: 'Phòng A1 hỏng' }, admin);

      expect(result.statusCode).toBe(200);
      expect(prisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { roomId: 5 } }),
      );
      const change = prisma.sessionChange.create.mock.calls[0][0].data;
      expect(change.changeType).toBe('CHANGE_ROOM');
      expect(change.fromRoomId).toBe(3);
      expect(change.toRoomId).toBe(5);
      expect(change.reason).toBe('Phòng A1 hỏng');
    });

    it('rejects a teacher who does not belong to the class branch', async () => {
      prisma.systemUser.findUnique.mockResolvedValue({
        id: 8,
        fullName: 'Lê Thu Hà',
        status: 'ACTIVE',
        userBranches: [{ branchId: 9 }],
      });

      await expect(service.changeTeacher(100, { teacherId: 8 }, admin)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects changing a session that already ended', async () => {
      prisma.session.findUnique.mockResolvedValue(
        sessionRow({
          startTime: local('2020-01-01', '18:00'),
          endTime: local('2020-01-01', '19:30'),
        }),
      );

      await expect(service.changeTeacher(100, { teacherId: 8 }, admin)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.session.update).not.toHaveBeenCalled();
    });
  });

  describe('cancelSession', () => {
    beforeEach(() => {
      prisma.session.findUnique.mockResolvedValue(sessionRow());
      prisma.session.update.mockImplementation(({ where }: { where: { id: number } }) =>
        Promise.resolve(sessionRow({ id: where.id, status: SessionStatus.CANCELLED })),
      );
    });

    it('marks the session as cancelled and records the reason', async () => {
      const result = await service.cancelSession(100, { reason: 'Học viên đột xuất' }, admin);

      expect(result.statusCode).toBe(200);
      expect(prisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: SessionStatus.CANCELLED } }),
      );
      const change = prisma.sessionChange.create.mock.calls[0][0].data;
      expect(change.changeType).toBe('CANCEL');
      expect(change.reason).toBe('Học viên đột xuất');
    });
  });

  describe('getMySchedule', () => {
    it('scopes the query to the signed-in teacher, including sessions borrowing the class teacher', async () => {
      setSessions(prisma, [
        sessionRow({
          startTime: local('2026-03-02', '18:00'),
          endTime: local('2026-03-02', '19:30'),
        }),
      ]);

      const result = await service.getMySchedule(
        { from: '2026-03-01', to: '2026-03-31' },
        teacher,
      );

      expect(prisma.session.findMany).toHaveBeenCalledTimes(1);
      const where = prisma.session.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { teacherId: teacher.userId },
        { teacherId: null, trainingClass: { teacherId: teacher.userId } },
      ]);
      expect(result.data).toHaveLength(1);
    });

    it('rejects a range where from is not before to', async () => {
      await expect(
        service.getMySchedule({ from: '2026-03-31', to: '2026-03-01' }, teacher),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a range longer than 366 days', async () => {
      await expect(
        service.getMySchedule({ from: '2024-01-01', to: '2026-01-01' }, teacher),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    /**
     * 3.3-TC-02: giáo viên khác không thấy lịch của giáo viên đang đăng nhập.
     * Scope suy ra từ JWT (`user.userId`), không nhận teacherId từ client.
     */
    it('never returns another teacher sessions', async () => {
      const otherTeacherSession = sessionRow({
        id: 950,
        teacherId: 99,
        startTime: local('2026-03-02', '18:00'),
        endTime: local('2026-03-02', '19:30'),
      });
      setSessions(prisma, [otherTeacherSession]);

      const result = await service.getMySchedule(
        { from: '2026-03-01', to: '2026-03-31' },
        teacher,
      );

      expect(result.data).toHaveLength(0);
    });
  });

  describe('getTeachingHours', () => {
    it('counts only completed sessions and skips cancelled or future ones', async () => {
      const past = sessionRow({
        id: 1,
        startTime: local('2026-03-02', '09:00'),
        endTime: local('2026-03-02', '10:30'),
      });
      const future = sessionRow({
        id: 2,
        startTime: local('2099-03-02', '09:00'),
        endTime: local('2099-03-02', '10:30'),
      });
      setSessions(prisma, [past, future]);

      const result = await service.getTeachingHours({ from: '2026-03-01', to: '2026-03-31' }, admin);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].teacherId).toBe(7);
      expect(result.data[0].totalMinutes).toBe(90);
      expect(result.data[0].totalHours).toBe(1.5);
      expect(result.meta.totalHours).toBe(1.5);
    });

    it('ignores cancelled sessions', async () => {
      setSessions(prisma, [
        sessionRow({
          id: 1,
          status: SessionStatus.CANCELLED,
          startTime: local('2026-03-02', '09:00'),
          endTime: local('2026-03-02', '10:30'),
        }),
      ]);

      const result = await service.getTeachingHours({ from: '2026-03-01', to: '2026-03-31' }, admin);

      expect(result.data).toHaveLength(0);
      expect(result.meta.totalHours).toBe(0);
    });

    it('restricts the report to the branches the manager can access', async () => {
      setSessions(prisma, []);

      await service.getTeachingHours({ from: '2026-03-01', to: '2026-03-31' }, manager);

      const where = prisma.session.findMany.mock.calls[0][0].where;
      expect(where.trainingClass).toEqual({ branchId: { in: [1] } });
    });

    it('excludes cancelled sessions from the total even when they already ended', async () => {
      setSessions(prisma, [
        sessionRow({
          id: 1,
          status: SessionStatus.CANCELLED,
          startTime: local('2026-03-02', '09:00'),
          endTime: local('2026-03-02', '10:30'),
        }),
      ]);

      const result = await service.getTeachingHours({ from: '2026-03-01', to: '2026-03-31' }, admin);

      expect(result.data).toHaveLength(0);
      expect(result.meta.totalMinutes).toBe(0);
      expect(result.meta.totalHours).toBe(0);
    });

    it('excludes sessions that have not finished yet', async () => {
      setSessions(prisma, [
        sessionRow({
          id: 1,
          startTime: local('2099-03-02', '09:00'),
          endTime: local('2099-03-02', '10:30'),
        }),
      ]);

      const result = await service.getTeachingHours({ from: '2026-03-01', to: '2026-03-31' }, admin);

      expect(result.data).toHaveLength(0);
      expect(result.meta.totalHours).toBe(0);
    });

    it('sums the durations of several completed sessions for the same teacher', async () => {
      setSessions(prisma, [
        sessionRow({
          id: 1,
          startTime: local('2026-03-02', '09:00'),
          endTime: local('2026-03-02', '10:30'),
        }),
        sessionRow({
          id: 2,
          startTime: local('2026-03-09', '09:00'),
          endTime: local('2026-03-09', '10:00'),
        }),
      ]);

      const result = await service.getTeachingHours({ from: '2026-03-01', to: '2026-03-31' }, admin);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].sessionCount).toBe(2);
      expect(result.data[0].totalMinutes).toBe(150);
      expect(result.data[0].totalHours).toBe(2.5);
    });

    it('rejects a range where from is not before to', async () => {
      await expect(
        service.getTeachingHours({ from: '2026-03-31', to: '2026-03-01' }, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getSessionHistory', () => {
    it('returns the change log of a session', async () => {
      prisma.session.findUnique.mockResolvedValue(sessionRow());
      prisma.sessionChange.findMany.mockResolvedValue([
        {
          id: 1,
          changeType: 'RESCHEDULE',
          reason: 'Lý do',
          createdAt: new Date('2026-03-01T00:00:00Z'),
          changedByUser: { id: 1, fullName: 'Admin' },
          fromStartTime: local('2026-03-02', '18:00'),
          toStartTime: local('2026-03-03', '18:00'),
          fromEndTime: local('2026-03-02', '19:30'),
          toEndTime: local('2026-03-03', '19:30'),
          fromTeacherId: 7,
          toTeacherId: 7,
          fromRoomId: 3,
          toRoomId: 3,
          fromStatus: SessionStatus.NORMAL,
          toStatus: SessionStatus.RESCHEDULED,
        },
      ]);

      const result = await service.getSessionHistory(100, admin);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].changeType).toBe('RESCHEDULE');
      expect(result.data[0].changedBy.fullName).toBe('Admin');
    });

    it('throws 404 when the session does not exist', async () => {
      prisma.session.findUnique.mockResolvedValue(null);

      await expect(service.getSessionHistory(999, admin)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

describe('isSessionCompleted', () => {
  const now = new Date('2026-03-02T12:00:00Z');

  it('is true when the session ended in the past and is not cancelled', () => {
    expect(
      isSessionCompleted({ endTime: new Date('2026-03-02T11:00:00Z'), status: SessionStatus.NORMAL }, now),
    ).toBe(true);
  });

  it('is false for a future session', () => {
    expect(
      isSessionCompleted({ endTime: new Date('2026-03-02T13:00:00Z'), status: SessionStatus.NORMAL }, now),
    ).toBe(false);
  });

  it('is false for a cancelled session that already ended', () => {
    expect(
      isSessionCompleted({ endTime: new Date('2026-03-02T11:00:00Z'), status: SessionStatus.CANCELLED }, now),
    ).toBe(false);
  });
});
