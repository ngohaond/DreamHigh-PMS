import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TrainingClassStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toPublicUser } from '../../common/mappers/to-public-user';
import { parseLocalDate, toDateOnly } from '../schedule/utils/timezone.util';
import type {
  CreateClassDto,
  ListClassesQueryDto,
  UpdateClassDto,
} from './dto/create-class.dto';

export type ClassesAuthUser = {
  userId: number;
  email?: string;
  roles: string[];
  branchIds: number[];
};

/**
 * Chuyển đổi trạng thái lớp hợp lệ theo vòng đời:
 * PLANNED → ACTIVE → COMPLETED | CANCELLED, và PLANNED → CANCELLED.
 */
const CLASS_STATUS_TRANSITIONS: Record<TrainingClassStatus, TrainingClassStatus[]> = {
  PLANNED: ['PLANNED', 'ACTIVE', 'CANCELLED'],
  ACTIVE: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['COMPLETED'],
  CANCELLED: ['CANCELLED'],
};

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  async getClassDetails(classCode: string, user?: ClassesAuthUser) {
    const classInfo = await this.prisma.trainingClass.findUnique({
      where: { classCode },
      include: {
        course: true,
        teacher: true,
        sessions: {
          include: {
            room: true,
            attendances: true,
          },
          orderBy: {
            startTime: 'asc',
          },
        },
        exams: {
          include: {
            grades: true,
          },
        },
        enrollments: {
          include: {
            student: true,
          },
        },
      },
    });

    if (!classInfo) {
      throw new NotFoundException(`Lớp học mã ${classCode} không tồn tại`);
    }

    if (user) {
      this.assertClassAccess(user, classInfo.branchId, classInfo.teacherId, classInfo.sessions);
    }

    return {
      statusCode: 200,
      message: 'Lấy thông tin chi tiết lớp thành công',
      data: {
        ...classInfo,
        teacher: classInfo.teacher ? toPublicUser(classInfo.teacher) : null,
      },
      meta: null,
    };
  }

  /** Danh sách lớp học có lọc + phân trang, giới hạn theo branch của user. */
  async listClasses(query: ListClassesQueryDto, user: ClassesAuthUser) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const branchIds = this.allowedBranchIds(user);

    const visibleBranchIds = branchIds
      ? query.branchId != null
        ? branchIds.filter((id) => id === query.branchId)
        : branchIds
      : query.branchId != null
        ? [query.branchId]
        : null;
    const where: Prisma.TrainingClassWhereInput = {
      ...(visibleBranchIds ? { branchId: { in: visibleBranchIds } } : {}),
      ...(query.status ? { status: query.status as TrainingClassStatus } : {}),
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      ...(query.search
        ? {
            OR: [
              { classCode: { contains: query.search, mode: 'insensitive' } },
              { course: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.trainingClass.findMany({
        where,
        include: { course: true, teacher: true, branch: true },
        orderBy: { startDate: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.trainingClass.count({ where }),
    ]);

    return {
      statusCode: 200,
      message: 'Lấy danh sách lớp học thành công',
      data: items.map((item) => ({
        ...item,
        teacher: item.teacher ? toPublicUser(item.teacher) : null,
      })),
      meta: { total, limit, offset },
    };
  }

  /** Tạo lớp học mới — validate khóa/chi nhánh/GV, sức chứa và mã lớp duy nhất. */
  async createClass(dto: CreateClassDto, user: ClassesAuthUser) {
    this.assertBranchAccess(user, dto.branchId);

    const [course, branch, teacher] = await Promise.all([
      this.prisma.course.findUnique({ where: { id: dto.courseId } }),
      this.prisma.branch.findUnique({ where: { id: dto.branchId } }),
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
    if (!teacher) throw new NotFoundException('Giáo viên không tồn tại');
    if (teacher.status !== 'ACTIVE') {
      throw new BadRequestException('Giáo viên không hoạt động, không thể phân công');
    }

    const teacherBranchIds = (teacher.userBranches ?? []).map((ub) => ub.branchId);
    if (teacherBranchIds.length > 0 && !teacherBranchIds.includes(dto.branchId)) {
      throw new BadRequestException('Giáo viên không thuộc chi nhánh của lớp');
    }

    const startDate = this.parseDate(dto.startDate, 'startDate');
    const endDate = dto.endDate ? this.parseDate(dto.endDate, 'endDate') : null;
    if (endDate && endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException('endDate phải từ startDate trở đi');
    }

    const existing = await this.prisma.trainingClass.findUnique({
      where: { classCode: dto.classCode },
    });
    if (existing) {
      throw new ConflictException(`Mã lớp ${dto.classCode} đã tồn tại`);
    }

    const created = await this.prisma.trainingClass.create({
      data: {
        classCode: dto.classCode,
        courseId: course.id,
        branchId: branch.id,
        teacherId: teacher.id,
        maxStudents: dto.maxStudents,
        startDate,
        endDate,
        status: TrainingClassStatus.PLANNED,
      },
      include: { course: true, teacher: true, branch: true },
    });

    return {
      statusCode: 201,
      message: `Đã tạo lớp ${created.classCode}.`,
      data: {
        ...created,
        teacher: created.teacher ? toPublicUser(created.teacher) : null,
      },
      meta: null,
    };
  }

  /** Cập nhật lớp học — không cho đổi mã lớp, validate lifecycle trạng thái. */
  async updateClass(classId: number, dto: UpdateClassDto, user: ClassesAuthUser) {
    const existing = await this.prisma.trainingClass.findUnique({
      where: { id: classId },
    });
    if (!existing) throw new NotFoundException('Lớp học không tồn tại');

    this.assertBranchAccess(user, existing.branchId);
    if (dto.branchId != null) this.assertBranchAccess(user, dto.branchId);

    if (dto.status) {
      const next = dto.status as TrainingClassStatus;
      if (!CLASS_STATUS_TRANSITIONS[existing.status]) {
        throw new BadRequestException(`Trạng thái lớp không hợp lệ: ${dto.status}`);
      }
      if (!CLASS_STATUS_TRANSITIONS[existing.status].includes(next)) {
        throw new BadRequestException(
          `Không thể chuyển lớp từ ${existing.status} sang ${next}`,
        );
      }
    }

    if (dto.courseId != null) {
      const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
      if (!course) throw new NotFoundException('Khóa học không tồn tại');
      if (course.status !== 'ACTIVE') {
        throw new BadRequestException('Khóa học không hoạt động, không thể gán vào lớp');
      }
    }

    if (dto.teacherId != null) {
      const teacher = await this.prisma.systemUser.findUnique({
        where: { id: dto.teacherId },
        include: { userBranches: true },
      });
      if (!teacher) throw new NotFoundException('Giáo viên không tồn tại');
      if (teacher.status !== 'ACTIVE') {
        throw new BadRequestException('Giáo viên không hoạt động, không thể phân công');
      }
      const targetBranchId = dto.branchId ?? existing.branchId;
      const teacherBranchIds = (teacher.userBranches ?? []).map((ub) => ub.branchId);
      if (teacherBranchIds.length > 0 && !teacherBranchIds.includes(targetBranchId)) {
        throw new BadRequestException('Giáo viên không thuộc chi nhánh của lớp');
      }
    }

    const startDate = dto.startDate ? this.parseDate(dto.startDate, 'startDate') : existing.startDate;
    const endDate =
      dto.endDate !== undefined
        ? dto.endDate
          ? this.parseDate(dto.endDate, 'endDate')
          : null
        : existing.endDate;
    if (endDate && endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException('endDate phải từ startDate trở đi');
    }

    const updated = await this.prisma.trainingClass.update({
      where: { id: classId },
      data: {
        ...(dto.courseId != null ? { courseId: dto.courseId } : {}),
        ...(dto.branchId != null ? { branchId: dto.branchId } : {}),
        ...(dto.teacherId != null ? { teacherId: dto.teacherId } : {}),
        ...(dto.maxStudents != null ? { maxStudents: dto.maxStudents } : {}),
        ...(dto.startDate ? { startDate } : {}),
        ...(dto.endDate !== undefined ? { endDate } : {}),
        ...(dto.status ? { status: dto.status as TrainingClassStatus } : {}),
      },
      include: { course: true, teacher: true, branch: true },
    });

    return {
      statusCode: 200,
      message: `Đã cập nhật lớp ${updated.classCode}.`,
      data: {
        ...updated,
        teacher: updated.teacher ? toPublicUser(updated.teacher) : null,
      },
      meta: null,
    };
  }

  /**
   * Phạm vi chi nhánh của user. ADMIN không giới hạn (null = không filter),
   * user khác chỉ thấy chi nhánh được cấp trong JWT.
   */
  private allowedBranchIds(user: ClassesAuthUser): number[] | null {
    if (user.roles.includes('ADMIN')) return null;
    return user.branchIds ?? [];
  }

  private assertBranchAccess(user: ClassesAuthUser, branchId: number) {
    if (user.roles.includes('ADMIN')) return;
    if (!user.branchIds.includes(branchId)) {
      throw new ForbiddenException('Bạn không có quyền truy cập lớp học ở chi nhánh này');
    }
  }

  /**
   * Quyền xem chi tiết lớp:
   * - ADMIN: tất cả.
   * - MANAGER / STAFF: trong phạm vi chi nhánh được cấp.
   * - TEACHER: chỉ lớp mình giảng dạy (là GV của lớp hoặc được gán dạy một buổi).
   * - Role khác: không được xem.
   */
  private assertClassAccess(
    user: ClassesAuthUser,
    branchId: number,
    teacherId: number,
    sessions: { teacherId: number | null }[] = [],
  ) {
    if (user.roles.includes('ADMIN')) return;

    if (user.roles.includes('TEACHER')) {
      const teachesClass = teacherId === user.userId;
      const teachesSession = sessions.some((s) => s.teacherId === user.userId);
      if (!teachesClass && !teachesSession) {
        throw new ForbiddenException('Bạn không có quyền xem lớp học này');
      }
      return;
    }

    this.assertBranchAccess(user, branchId);
  }

  private parseDate(value: string, field: string): Date {
    const parts = parseLocalDate(value);
    if (!parts) {
      throw new BadRequestException(`${field} không hợp lệ (định dạng YYYY-MM-DD)`);
    }
    return toDateOnly(parts.year, parts.month, parts.day);
  }
}
