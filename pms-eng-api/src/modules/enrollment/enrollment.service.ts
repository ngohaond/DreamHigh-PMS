import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type EnrollmentAuthUser = {
  userId: number;
  roles: string[];
  branchIds: number[];
};

type PlacementTestInput = {
  branchId: number;
  programId: number;
  listeningScore: number;
  readingScore: number;
  writingScore: number;
  testDate: string;
  notes?: string;
};

@Injectable()
export class EnrollmentService {
  constructor(private prisma: PrismaService) {}

  async convertLeadToStudent(leadId: number, data: { branchId: number; dob: string; gender?: any }) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Get Lead
      const lead = await tx.lead.findUnique({
        where: { id: leadId },
      });
      if (!lead) throw new NotFoundException('Lead không tồn tại');
      if (lead.status === 'CONVERTED') throw new BadRequestException('Lead này đã được chuyển đổi thành học viên');

      // 2. Create or Find Parent (based on phone)
      let parent = await tx.parent.findFirst({
        where: { phone: lead.phone },
      });

      if (!parent) {
        parent = await tx.parent.create({
          data: {
            fullName: `PH ${lead.fullName}`, // Default parent name
            phone: lead.phone,
            email: lead.email,
          },
        });
      }

      // 3. Create Student
      const studentCount = await tx.student.count();
      const studentCode = `ST${1000 + studentCount + 1}`;

      const student = await tx.student.create({
        data: {
          studentCode,
          fullName: lead.fullName,
          dob: new Date(data.dob),
          gender: data.gender,
          phone: lead.phone,
          email: lead.email,
          parentId: parent.id,
          status: 'ACTIVE',
          statusChangedAt: new Date(),
        },
      });

      // 4. Update Lead status
      await tx.lead.update({
        where: { id: leadId },
        data: {
          status: 'CONVERTED',
          convertedStudentId: student.id,
        },
      });

      return { student, parent };
    });
  }

  async recordPlacementTest(studentId: number, data: PlacementTestInput, user: EnrollmentAuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: studentId },
        include: {
          classEnrollments: {
            include: {
              trainingClass: {
                include: { sessions: { select: { teacherId: true } } },
              },
            },
          },
        },
      });
      if (!student) throw new NotFoundException('Học viên không tồn tại');

      this.assertBranchAccess(user, data.branchId);
      const enrolledBranchIds = student.classEnrollments.map(({ trainingClass }) => trainingClass.branchId);
      if (enrolledBranchIds.length > 0 && !enrolledBranchIds.includes(data.branchId)) {
        throw new ForbiddenException('Học viên không thuộc chi nhánh được chọn');
      }
      this.assertTeacherAssignment(user, data.branchId, student.classEnrollments);

      const program = await tx.program.findUnique({ where: { id: data.programId } });
      if (!program || program.status !== 'ACTIVE') {
        throw new NotFoundException('Chương trình đào tạo không tồn tại hoặc đã ngừng hoạt động');
      }

      const totalScore = data.listeningScore + data.readingScore + data.writingScore;
      const levels = await tx.level.findMany({
        where: {
          programId: data.programId,
          status: 'ACTIVE',
          minPlacementScore: { lte: totalScore },
          maxPlacementScore: { gte: totalScore },
        },
        include: { program: true },
        orderBy: { sortOrder: 'asc' },
        take: 2,
      });
      if (levels.length > 1) {
        throw new BadRequestException('Barem đang bị chồng lấn; cần điều chỉnh cấu hình cấp độ');
      }
      const recommendedLevel = levels[0] ?? null;

      const placementTest = await tx.placementTest.create({
        data: {
          studentId,
          branchId: data.branchId,
          programId: data.programId,
          listeningScore: data.listeningScore,
          readingScore: data.readingScore,
          writingScore: data.writingScore,
          totalScore,
          testDate: new Date(data.testDate),
          recommendedLevelId: recommendedLevel?.id ?? null,
          notes: data.notes ?? null,
        },
        include: { recommendedLevel: { include: { program: true } } },
      });

      return {
        statusCode: 201,
        message: 'Ghi nhận bài kiểm tra xếp lớp thành công',
        data: placementTest,
        meta: null,
      };
    });
  }

  async getPlacementTests(studentId: number, user: EnrollmentAuthUser) {
    const where = user.roles.includes('ADMIN') ? { studentId } : { studentId, branchId: { in: user.branchIds } };
    const placementTests = await this.prisma.placementTest.findMany({
      where,
      include: { recommendedLevel: { include: { program: true } }, program: true },
      orderBy: [{ testDate: 'desc' }, { createdAt: 'desc' }],
    });

    if (user.roles.includes('TEACHER') && placementTests.length > 0) {
      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
        include: {
          classEnrollments: {
            include: {
              trainingClass: {
                include: { sessions: { select: { teacherId: true } } },
              },
            },
          },
        },
      });
      if (!student) throw new NotFoundException('Học viên không tồn tại');
      for (const placementTest of placementTests) {
        this.assertTeacherAssignment(user, placementTest.branchId, student.classEnrollments);
      }
    }

    return {
      statusCode: 200,
      message: 'Lấy lịch sử kiểm tra xếp lớp thành công',
      data: placementTests,
      meta: null,
    };
  }

  private assertBranchAccess(user: EnrollmentAuthUser, branchId: number) {
    if (!user.roles.includes('ADMIN') && !user.branchIds.includes(branchId)) {
      throw new ForbiddenException('Bạn không có quyền ghi nhận placement tại chi nhánh này');
    }
  }

  private assertTeacherAssignment(
    user: EnrollmentAuthUser,
    branchId: number,
    enrollments: { trainingClass: { branchId: number; teacherId: number; sessions: { teacherId: number | null }[] } }[],
  ) {
    if (!user.roles.includes('ADMIN') && user.roles.includes('TEACHER')) {
      const teachesStudentInBranch = enrollments.some(({ trainingClass }) =>
        trainingClass.branchId === branchId &&
        (trainingClass.teacherId === user.userId || trainingClass.sessions.some((session) => session.teacherId === user.userId)),
      );
      if (!teachesStudentInBranch) {
        throw new ForbiddenException('Giáo viên chỉ được ghi nhận placement cho học viên thuộc lớp mình phụ trách');
      }
    }
  }
}
