import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeCatalogCode, normalizeCatalogName } from './catalog-normalize';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAllBranches() {
    return this.prisma.branch.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { code: 'asc' },
    });
  }

  async findAllPrograms(includeInactive = false) {
    return this.prisma.program.findMany({
      where: includeInactive ? {} : { status: 'ACTIVE' },
      include: { _count: { select: { levels: true } } },
      orderBy: { code: 'asc' },
    });
  }

  async createProgram(data: any) {
    const code = normalizeCatalogCode(data.code);
    const name = normalizeCatalogName(data.name);
    if (!code || !name) throw new BadRequestException('Mã và tên chương trình là bắt buộc');
    const existing = await this.prisma.program.findUnique({ where: { code } });
    if (existing) throw new ConflictException(`Mã chương trình ${code} đã tồn tại`);
    return this.prisma.program.create({
      data: {
        code,
        name,
        description: data.description != null ? normalizeCatalogName(data.description) : null,
        status: data.status ?? 'ACTIVE',
      },
    });
  }

  async updateProgram(id: number, data: any) {
    const row = await this.prisma.program.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Chương trình không tồn tại');
    return this.prisma.program.update({
      where: { id },
      data: {
        ...(data.name != null ? { name: normalizeCatalogName(data.name) } : {}),
        ...(data.description !== undefined
          ? { description: data.description != null ? normalizeCatalogName(data.description) : null }
          : {}),
        ...(data.status != null ? { status: data.status } : {}),
      },
    });
  }

  async softDeleteProgram(id: number) {
    const row = await this.prisma.program.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Chương trình không tồn tại');
    await this.prisma.level.updateMany({
      where: { programId: id },
      data: { status: 'INACTIVE' },
    });
    return this.prisma.program.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  async findAllLevels(programId?: number, includeInactive = false) {
    return this.prisma.level.findMany({
      where: {
        ...(includeInactive ? {} : { status: 'ACTIVE' }),
        ...(programId != null && Number.isFinite(programId) ? { programId } : {}),
      },
      include: { program: true },
      orderBy: [{ programId: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async createLevel(data: any) {
    const code = normalizeCatalogCode(data.code);
    const name = normalizeCatalogName(data.name);
    const programId = Number(data.programId);
    const rawSo = Number(data.sortOrder);
    const sortOrder = Number.isFinite(rawSo) ? rawSo : 0;
    if (!code || !name) throw new BadRequestException('Mã và tên cấp độ là bắt buộc');
    if (!Number.isFinite(programId)) throw new BadRequestException('programId không hợp lệ');
    const placementBounds = this.parsePlacementBounds(data.minPlacementScore, data.maxPlacementScore);
    const existing = await this.prisma.level.findFirst({
      where: { programId, code },
    });
    if (existing) throw new ConflictException(`Mã cấp độ ${code} đã tồn tại trong chương trình này`);
    return this.prisma.level.create({
      data: {
        programId,
        code,
        name,
        sortOrder,
        status: data.status ?? 'ACTIVE',
        ...placementBounds,
      },
    });
  }

  async updateLevel(id: number, data: any) {
    const row = await this.prisma.level.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Cấp độ không tồn tại');
    const placementBounds =
      data.minPlacementScore !== undefined || data.maxPlacementScore !== undefined
        ? this.parsePlacementBounds(data.minPlacementScore, data.maxPlacementScore)
        : {};
    return this.prisma.level.update({
      where: { id },
      data: {
        ...(data.name != null ? { name: normalizeCatalogName(data.name) } : {}),
        ...(data.sortOrder != null ? { sortOrder: Number(data.sortOrder) } : {}),
        ...(data.status != null ? { status: data.status } : {}),
        ...placementBounds,
      },
    });
  }

  private parsePlacementBounds(minimum: unknown, maximum: unknown) {
    if (minimum == null && maximum == null) {
      return { minPlacementScore: null, maxPlacementScore: null };
    }
    if (minimum == null || maximum == null) {
      throw new BadRequestException('Cần cấu hình đồng thời điểm barem tối thiểu và tối đa');
    }

    const minPlacementScore = Number(minimum);
    const maxPlacementScore = Number(maximum);
    if (
      !Number.isFinite(minPlacementScore) ||
      !Number.isFinite(maxPlacementScore) ||
      minPlacementScore < 0 ||
      maxPlacementScore < minPlacementScore
    ) {
      throw new BadRequestException('Khoảng điểm barem không hợp lệ');
    }
    return { minPlacementScore, maxPlacementScore };
  }

  async softDeleteLevel(id: number) {
    const row = await this.prisma.level.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Cấp độ không tồn tại');
    return this.prisma.level.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  async findAllClassTypes(includeInactive = false) {
    return this.prisma.classType.findMany({
      where: includeInactive ? {} : { status: 'ACTIVE' },
      orderBy: { code: 'asc' },
    });
  }

  async createClassType(data: any) {
    const code = normalizeCatalogCode(data.code);
    const name = normalizeCatalogName(data.name);
    if (!code || !name) throw new BadRequestException('Mã và tên loại lớp là bắt buộc');
    const existing = await this.prisma.classType.findUnique({ where: { code } });
    if (existing) throw new ConflictException(`Mã loại lớp ${code} đã tồn tại`);
    return this.prisma.classType.create({
      data: {
        code,
        name,
        description: data.description != null ? normalizeCatalogName(data.description) : null,
        status: data.status ?? 'ACTIVE',
      },
    });
  }

  async updateClassType(id: number, data: any) {
    const row = await this.prisma.classType.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Loại lớp không tồn tại');
    return this.prisma.classType.update({
      where: { id },
      data: {
        ...(data.name != null ? { name: normalizeCatalogName(data.name) } : {}),
        ...(data.description !== undefined
          ? { description: data.description != null ? normalizeCatalogName(data.description) : null }
          : {}),
        ...(data.status != null ? { status: data.status } : {}),
      },
    });
  }

  async softDeleteClassType(id: number) {
    const row = await this.prisma.classType.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Loại lớp không tồn tại');
    return this.prisma.classType.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  async findAllRooms(branchId?: number, includeInactive = false) {
    return this.prisma.room.findMany({
      where: {
        ...(branchId != null && Number.isFinite(branchId) ? { branchId } : {}),
        ...(includeInactive ? {} : { status: { not: 'INACTIVE' } }),
      },
      include: { branch: true },
      orderBy: [{ branchId: 'asc' }, { roomCode: 'asc' }],
    });
  }

  async createRoom(data: any) {
    const roomCode = normalizeCatalogCode(data.roomCode);
    const branchId = Number(data.branchId);
    const capacity = Number(data.capacity);
    if (!roomCode || !Number.isFinite(branchId)) throw new BadRequestException('Mã phòng và cơ sở là bắt buộc');
    if (!Number.isFinite(capacity) || capacity < 1) throw new BadRequestException('Sức chứa phải ≥ 1');
    const existing = await this.prisma.room.findFirst({
      where: { branchId, roomCode },
    });
    if (existing) throw new ConflictException(`Mã phòng ${roomCode} đã tồn tại tại cơ sở này`);
    return this.prisma.room.create({
      data: {
        branchId,
        roomCode,
        name: data.name != null ? normalizeCatalogName(data.name) : null,
        capacity,
        status: data.status ?? 'AVAILABLE',
      },
    });
  }

  async updateRoom(id: number, data: any) {
    const row = await this.prisma.room.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Phòng không tồn tại');
    return this.prisma.room.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name != null ? normalizeCatalogName(data.name) : null } : {}),
        ...(data.capacity != null ? { capacity: Number(data.capacity) } : {}),
        ...(data.status != null ? { status: data.status } : {}),
      },
    });
  }

  async softDeleteRoom(id: number) {
    const row = await this.prisma.room.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Phòng không tồn tại');
    const upcoming = await this.prisma.session.count({
      where: {
        roomId: id,
        startTime: { gte: new Date() },
        status: { not: 'CANCELLED' },
      },
    });
    if (upcoming > 0) {
      throw new BadRequestException('Không thể ngừng sử dụng phòng khi còn buổi học sắp tới chưa hủy.');
    }
    return this.prisma.room.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  async findCourses(query: Record<string, string | undefined>) {
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(query.limit) || 20)));
    const skip = (page - 1) * limit;
    const search = query.search?.trim();
    const rawLevel = query.levelId?.trim();
    const levelId = rawLevel ? Number(rawLevel) : undefined;
    const levelOk = levelId !== undefined && Number.isFinite(levelId);

    const parts: Prisma.CourseWhereInput[] = [];
    if (levelOk) parts.push({ levelId });
    if (search) {
      parts.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    const where = parts.length ? { AND: parts } : {};

    const [items, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        skip,
        take: limit,
        include: { level: { include: { program: true } } },
        orderBy: { id: 'desc' },
      }),
      this.prisma.course.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async createCourse(data: any) {
    const code = normalizeCatalogCode(data.code);
    const name = normalizeCatalogName(data.name);
    const levelId = Number(data.levelId);
    if (!code || !name) throw new BadRequestException('Mã và tên khóa học là bắt buộc');
    if (!Number.isFinite(levelId)) throw new BadRequestException('levelId không hợp lệ');
    const existing = await this.prisma.course.findUnique({ where: { code } });
    if (existing) throw new ConflictException(`Mã khóa học ${code} đã tồn tại`);
    const totalSessions = Number(data.totalSessions);
    if (!Number.isFinite(totalSessions) || totalSessions < 1) throw new BadRequestException('totalSessions phải ≥ 1');

    return this.prisma.course.create({
      data: {
        levelId,
        code,
        name,
        totalSessions,
        durationWeeks: data.durationWeeks != null ? Number(data.durationWeeks) : null,
        tuitionFee: data.tuitionFee != null ? new Prisma.Decimal(String(data.tuitionFee)) : null,
        status: data.status ?? 'ACTIVE',
      },
      include: { level: { include: { program: true } } },
    });
  }

  async updateCourse(id: number, data: any) {
    const row = await this.prisma.course.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Khóa học không tồn tại');
    return this.prisma.course.update({
      where: { id },
      data: {
        ...(data.name != null ? { name: normalizeCatalogName(data.name) } : {}),
        ...(data.levelId != null ? { levelId: Number(data.levelId) } : {}),
        ...(data.totalSessions != null ? { totalSessions: Number(data.totalSessions) } : {}),
        ...(data.durationWeeks !== undefined
          ? { durationWeeks: data.durationWeeks != null ? Number(data.durationWeeks) : null }
          : {}),
        ...(data.tuitionFee !== undefined
          ? { tuitionFee: data.tuitionFee != null ? new Prisma.Decimal(String(data.tuitionFee)) : null }
          : {}),
        ...(data.status != null ? { status: data.status } : {}),
      },
      include: { level: { include: { program: true } } },
    });
  }

  async softDeleteCourse(id: number) {
    const row = await this.prisma.course.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Khóa học không tồn tại');
    const activeClasses = await this.prisma.trainingClass.count({
      where: {
        courseId: id,
        status: { in: ['PLANNED', 'ACTIVE'] },
      },
    });
    if (activeClasses > 0) {
      throw new BadRequestException('Không thể ngừng khóa học khi còn lớp đang/hoạch định đang gắn.');
    }
    return this.prisma.course.update({
      where: { id },
      data: { status: 'INACTIVE' },
      include: { level: { include: { program: true } } },
    });
  }
}
