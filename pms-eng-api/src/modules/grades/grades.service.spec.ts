import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GradesService } from './grades.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExamDto, BulkUpsertGradesDto } from './dto';

describe('GradesService', () => {
  let service: GradesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    trainingClass: {
      findUnique: jest.fn(),
    },
    exam: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    grade: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockAuthUser = {
    userId: 1,
    email: 'admin@dreamhigh.edu.vn',
    roles: ['ADMIN'],
    branchIds: [1, 2],
  };

  const mockTeacherUser = {
    userId: 10,
    email: 'teacher@dreamhigh.edu.vn',
    roles: ['TEACHER'],
    branchIds: [1],
  };

  const mockClass = {
    id: 1,
    branchId: 1,
    teacherId: 10,
  };

  const mockExam = {
    id: 1,
    classId: 1,
    title: 'Midterm Exam',
    examType: 'midterm',
    scheduledAt: new Date('2024-06-15T09:00:00Z'),
    maxScore: 100,
    weightPercent: 30,
    trainingClass: mockClass,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GradesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<GradesService>(GradesService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listExamsForClass', () => {
    it('4.3-TC-01: should return exams for a class with proper pagination', async () => {
      const classId = 1;
      const query = { limit: 10, offset: 0 };

      mockPrismaService.trainingClass.findUnique.mockResolvedValue(mockClass);
      mockPrismaService.$transaction.mockResolvedValue([[mockExam], 1]);

      const result = await service.listExamsForClass(classId, query, mockAuthUser);

      expect(result.statusCode).toBe(200);
      expect(result.message).toBe('Lấy danh sách bài thi thành công');
      expect(result.data).toEqual([mockExam]);
      expect(result.meta).toEqual({ total: 1, limit: 10, offset: 0 });
      expect(mockPrismaService.trainingClass.findUnique).toHaveBeenCalledWith({
        where: { id: classId },
        select: { id: true, branchId: true, teacherId: true },
      });
    });

    it('should throw NotFoundException if class does not exist', async () => {
      mockPrismaService.trainingClass.findUnique.mockResolvedValue(null);

      await expect(
        service.listExamsForClass(1, {}, mockAuthUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user has no access to branch', async () => {
      const userWithNoBranchAccess = {
        userId: 2,
        roles: ['MANAGER'],
        branchIds: [99],
      };
      mockPrismaService.trainingClass.findUnique.mockResolvedValue(mockClass);

      await expect(
        service.listExamsForClass(1, {}, userWithNoBranchAccess),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if teacher does not own the class', async () => {
      const differentTeacher = {
        userId: 20,
        roles: ['TEACHER'],
        branchIds: [1],
      };
      mockPrismaService.trainingClass.findUnique.mockResolvedValue(mockClass);

      await expect(
        service.listExamsForClass(1, {}, differentTeacher),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should filter by examType when provided', async () => {
      const query = { examType: 'midterm', limit: 10, offset: 0 };
      mockPrismaService.trainingClass.findUnique.mockResolvedValue(mockClass);
      mockPrismaService.$transaction.mockResolvedValue([[mockExam], 1]);

      await service.listExamsForClass(1, query, mockAuthUser);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('createExam', () => {
    const createExamDto: CreateExamDto = {
      classId: 1,
      title: 'Final Exam',
      examType: 'final',
      scheduledAt: '2024-06-20T10:00:00Z',
      maxScore: 100,
      weightPercent: 40,
    };

    it('4.3-TC-02: should create exam successfully with valid data', async () => {
      mockPrismaService.trainingClass.findUnique.mockResolvedValue(mockClass);
      mockPrismaService.exam.findMany.mockResolvedValue([{ weightPercent: 30 }]);
      mockPrismaService.exam.create.mockResolvedValue({
        ...mockExam,
        title: 'Final Exam',
        weightPercent: 40,
      });

      const result = await service.createExam(createExamDto, mockAuthUser);

      expect(result.statusCode).toBe(200);
      expect(result.message).toBe('Tạo bài thi thành công');
      expect(result.data.title).toBe('Final Exam');
      expect(mockPrismaService.exam.create).toHaveBeenCalledWith({
        data: {
          classId: 1,
          title: 'Final Exam',
          examType: 'final',
          scheduledAt: new Date('2024-06-20T10:00:00Z'),
          maxScore: 100,
          weightPercent: 40,
        },
      });
    });

    it('should throw NotFoundException if class does not exist', async () => {
      mockPrismaService.trainingClass.findUnique.mockResolvedValue(null);

      await expect(service.createExam(createExamDto, mockAuthUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user has no access to branch', async () => {
      const userWithNoBranchAccess = {
        userId: 2,
        roles: ['MANAGER'],
        branchIds: [99],
      };
      mockPrismaService.trainingClass.findUnique.mockResolvedValue(mockClass);

      await expect(
        service.createExam(createExamDto, userWithNoBranchAccess),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if teacher does not own the class', async () => {
      const differentTeacher = {
        userId: 20,
        roles: ['TEACHER'],
        branchIds: [1],
      };
      mockPrismaService.trainingClass.findUnique.mockResolvedValue(mockClass);

      await expect(
        service.createExam(createExamDto, differentTeacher),
      ).rejects.toThrow(ForbiddenException);
    });

    it('4.3-TC-03: should throw BadRequestException if total weight exceeds 100%', async () => {
      mockPrismaService.trainingClass.findUnique.mockResolvedValue(mockClass);
      mockPrismaService.exam.findMany.mockResolvedValue([{ weightPercent: 70 }]);

      const dtoWithHighWeight = { ...createExamDto, weightPercent: 40 };

      await expect(service.createExam(dtoWithHighWeight, mockAuthUser)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createExam(dtoWithHighWeight, mockAuthUser)).rejects.toThrow(
        'Tổng trọng số các bài thi không được vượt quá 100%',
      );
    });

    it('should throw BadRequestException if scheduledAt is invalid', async () => {
      const dtoWithInvalidDate = { ...createExamDto, scheduledAt: 'invalid-date' };
      mockPrismaService.trainingClass.findUnique.mockResolvedValue(mockClass);

      await expect(service.createExam(dtoWithInvalidDate, mockAuthUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('bulkUpsertGrades', () => {
    const bulkUpsertDto: BulkUpsertGradesDto = {
      grades: [
        { studentId: 1, score: 85, gradeLabel: 'A' },
        { studentId: 2, score: 40, gradeLabel: 'D', remarks: 'Cần cải thiện' },
      ],
    };

    it('4.3-TC-04: should upsert grades and return low score alerts', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(mockExam);

      const mockUpsertResults = [
        { id: 1, examId: 1, studentId: 1, score: 85 },
        { id: 2, examId: 1, studentId: 2, score: 40 },
      ];

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });

      mockPrismaService.grade.upsert
        .mockResolvedValueOnce(mockUpsertResults[0])
        .mockResolvedValueOnce(mockUpsertResults[1]);

      const result = await service.bulkUpsertGrades(1, bulkUpsertDto, mockAuthUser);

      expect(result.statusCode).toBe(200);
      expect(result.message).toBe('Cập nhật điểm thành công');
      expect(result.data.upsertedCount).toBe(2);
      expect(result.data.lowScoreAlerts).toHaveLength(1);
      expect(result.data.lowScoreAlerts[0]).toEqual({
        studentId: 2,
        score: 40,
      });
    });

    it('should throw NotFoundException if exam does not exist', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(null);

      await expect(
        service.bulkUpsertGrades(1, bulkUpsertDto, mockAuthUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user has no access to branch', async () => {
      const userWithNoBranchAccess = {
        userId: 2,
        roles: ['MANAGER'],
        branchIds: [99],
      };
      mockPrismaService.exam.findUnique.mockResolvedValue(mockExam);

      await expect(
        service.bulkUpsertGrades(1, bulkUpsertDto, userWithNoBranchAccess),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if teacher does not own the class', async () => {
      const differentTeacher = {
        userId: 20,
        roles: ['TEACHER'],
        branchIds: [1],
      };
      mockPrismaService.exam.findUnique.mockResolvedValue(mockExam);

      await expect(
        service.bulkUpsertGrades(1, bulkUpsertDto, differentTeacher),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if score exceeds maxScore', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(mockExam);

      const dtoWithInvalidScore: BulkUpsertGradesDto = {
        grades: [{ studentId: 1, score: 150 }],
      };

      await expect(
        service.bulkUpsertGrades(1, dtoWithInvalidScore, mockAuthUser),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.bulkUpsertGrades(1, dtoWithInvalidScore, mockAuthUser),
      ).rejects.toThrow('Điểm số phải nằm trong khoảng [0, 100]');
    });

    it('should throw BadRequestException if score is negative', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(mockExam);

      const dtoWithNegativeScore: BulkUpsertGradesDto = {
        grades: [{ studentId: 1, score: -10 }],
      };

      await expect(
        service.bulkUpsertGrades(1, dtoWithNegativeScore, mockAuthUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle empty low score alerts when all scores are above threshold', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(mockExam);

      const allHighScoresDto: BulkUpsertGradesDto = {
        grades: [
          { studentId: 1, score: 85 },
          { studentId: 2, score: 90 },
        ],
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });

      mockPrismaService.grade.upsert
        .mockResolvedValueOnce({ id: 1, examId: 1, studentId: 1, score: 85 })
        .mockResolvedValueOnce({ id: 2, examId: 1, studentId: 2, score: 90 });

      const result = await service.bulkUpsertGrades(1, allHighScoresDto, mockAuthUser);

      expect(result.data.lowScoreAlerts).toBeUndefined();
    });
  });
});
