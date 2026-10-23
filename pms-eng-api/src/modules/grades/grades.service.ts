import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateExamDto,
  BulkUpsertGradesDto,
  ListExamsQueryDto,
} from './dto';

export type AuthUser = {
  userId: number;
  email?: string;
  roles: string[];
  branchIds: number[];
};

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List exams for a class with optional filtering
   * Access control: user must have access to class's branch
   * Teachers can only see exams for classes they teach
   */
  async listExamsForClass(
    classId: number,
    query: ListExamsQueryDto,
    user: AuthUser,
  ) {
    // Verify class exists and get branch info
    const classEntity = await this.prisma.trainingClass.findUnique({
      where: { id: classId },
      select: {
        id: true,
        branchId: true,
        teacherId: true,
      },
    });

    if (!classEntity) {
      throw new NotFoundException('Không tìm thấy lớp học');
    }

    // Branch access control
    this.assertBranchAccess(user, classEntity.branchId);

    // Teacher can only see their own classes
    if (user.roles.includes('TEACHER') && !user.roles.includes('MANAGER') && !user.roles.includes('ADMIN')) {
      if (classEntity.teacherId !== user.userId) {
        throw new ForbiddenException('Bạn chỉ có thể xem bài thi của lớp học do mình phụ trách');
      }
    }

    const { examType, limit = 50, offset = 0 } = query;

    const where = {
      classId,
      ...(examType && { examType }),
    };

    const [exams, total] = await this.prisma.$transaction([
      this.prisma.exam.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          _count: {
            select: { grades: true },
          },
        },
      }),
      this.prisma.exam.count({ where }),
    ]);

    return {
      statusCode: 200,
      message: 'Lấy danh sách bài thi thành công',
      data: exams,
      meta: { total, limit, offset },
    };
  }

  /**
   * Create a new exam for a class
   * Access control: ADMIN, MANAGER, or TEACHER of the class
   */
  async createExam(dto: CreateExamDto, user: AuthUser) {
    const { classId, title, examType, scheduledAt, maxScore, weightPercent } = dto;

    // Verify class exists and get branch info
    const classEntity = await this.prisma.trainingClass.findUnique({
      where: { id: classId },
      select: {
        id: true,
        branchId: true,
        teacherId: true,
      },
    });

    if (!classEntity) {
      throw new NotFoundException('Không tìm thấy lớp học');
    }

    // Branch access control
    this.assertBranchAccess(user, classEntity.branchId);

    // Role-based access: ADMIN/MANAGER can create for any class, TEACHER only for their own
    const isAdminOrManager = user.roles.includes('ADMIN') || user.roles.includes('MANAGER');
    if (!isAdminOrManager) {
      this.assertTeacherOwnsClass(user, classEntity.teacherId);
    }

    // Validate scheduledAt format (ISO 8601)
    const scheduledAtDate = new Date(scheduledAt);
    if (isNaN(scheduledAtDate.getTime())) {
      throw new BadRequestException('Thời gian thi không hợp lệ');
    }

    // If weightPercent is provided, validate total weight doesn't exceed 100
    if (weightPercent !== undefined && weightPercent !== null) {
      await this.validateExamWeights(classId, weightPercent, null);
    }

    const exam = await this.prisma.exam.create({
      data: {
        classId,
        title,
        examType: examType || null,
        scheduledAt: scheduledAtDate,
        maxScore,
        weightPercent: weightPercent || null,
      },
    });

    return {
      statusCode: 200,
      message: 'Tạo bài thi thành công',
      data: exam,
    };
  }

  /**
   * Bulk upsert grades for an exam
   * Validates score ranges, checks low scores, uses unique constraint for upsert
   */
  async bulkUpsertGrades(
    examId: number,
    dto: BulkUpsertGradesDto,
    user: AuthUser,
  ) {
    const { grades } = dto;

    if (!grades || grades.length === 0) {
      throw new BadRequestException('Danh sách điểm không được để trống');
    }

    // Fetch exam with class info
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        trainingClass: {
          select: {
            id: true,
            branchId: true,
            teacherId: true,
          },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException('Không tìm thấy bài thi');
    }

    // Branch access control
    this.assertBranchAccess(user, exam.trainingClass.branchId);

    // Teacher authorization: only ADMIN, MANAGER, or teacher of this class
    const isAdminOrManager = user.roles.includes('ADMIN') || user.roles.includes('MANAGER');
    if (!isAdminOrManager) {
      this.assertTeacherOwnsClass(user, exam.trainingClass.teacherId);
    }

    // Validate all scores are within [0, maxScore]
    const maxScoreNum = Number(exam.maxScore);
    for (const grade of grades) {
      this.validateScoreRange(grade.score, maxScoreNum);
    }

    // Perform bulk upsert using transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const upsertPromises = grades.map((grade) =>
        tx.grade.upsert({
          where: {
            examId_studentId: {
              examId,
              studentId: grade.studentId,
            },
          },
          create: {
            examId,
            studentId: grade.studentId,
            score: grade.score,
            gradeLabel: grade.gradeLabel || null,
            remarks: grade.remarks || null,
          },
          update: {
            score: grade.score,
            gradeLabel: grade.gradeLabel || null,
            remarks: grade.remarks || null,
          },
        }),
      );

      const upsertedGrades = await Promise.all(upsertPromises);
      return upsertedGrades;
    });

    // Check for low scores (threshold: 50% of maxScore)
    const lowScoreThreshold = maxScoreNum * 0.5;
    const lowScoreAlerts = grades
      .filter((g) => g.score < lowScoreThreshold)
      .map((g) => ({ studentId: g.studentId, score: g.score }));

    return {
      statusCode: 200,
      message: 'Cập nhật điểm thành công',
      data: {
        upsertedCount: result.length,
        ...(lowScoreAlerts.length > 0 && { lowScoreAlerts }),
      },
    };
  }

  // ===== Helper Methods =====

  private assertBranchAccess(user: AuthUser, branchId: number) {
    const isSuperAdmin = user.roles.includes('ADMIN');
    if (isSuperAdmin) return;

    if (!user.branchIds.includes(branchId)) {
      throw new ForbiddenException('Bạn không có quyền truy cập lớp học ở chi nhánh này');
    }
  }

  private assertTeacherOwnsClass(user: AuthUser, teacherId: number | null) {
    if (teacherId !== user.userId) {
      throw new ForbiddenException('Bạn chỉ có thể thao tác với lớp học do mình phụ trách');
    }
  }

  private validateScoreRange(score: number, maxScore: number) {
    if (score < 0 || score > maxScore) {
      throw new BadRequestException(
        `Điểm số phải nằm trong khoảng [0, ${maxScore}]`,
      );
    }
  }

  /**
   * Validate that adding a new exam with given weightPercent won't exceed 100% total
   * excludeExamId is used when updating an existing exam
   */
  private async validateExamWeights(
    classId: number,
    newWeight: number,
    excludeExamId: number | null,
  ) {
    const exams = await this.prisma.exam.findMany({
      where: {
        classId,
        ...(excludeExamId && { id: { not: excludeExamId } }),
      },
      select: { weightPercent: true },
    });

    const currentTotalWeight = exams.reduce(
      (sum, exam) => sum + (exam.weightPercent ? Number(exam.weightPercent) : 0),
      0,
    );

    const newTotalWeight = currentTotalWeight + newWeight;

    if (newTotalWeight > 100) {
      throw new BadRequestException(
        `Tổng trọng số các bài thi không được vượt quá 100% (hiện tại: ${currentTotalWeight}%, thêm: ${newWeight}%)`,
      );
    }
  }
}
