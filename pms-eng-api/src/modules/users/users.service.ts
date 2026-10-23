import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { toPublicUser } from '../../common/mappers/to-public-user';

function normalizeUsername(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toLowerCase();
}

const userInclude = {
  userRoles: { include: { role: true } },
  userBranches: { include: { branch: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: number) {
    const user = await this.prisma.systemUser.findUnique({
      where: { id: userId },
      include: userInclude,
    });

    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    return {
      statusCode: 200,
      message: 'Lấy thông tin người dùng thành công',
      data: toPublicUser(user),
      meta: null,
    };
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.systemUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    if (!user.passwordHash) {
      throw new BadRequestException(
        'Tài khoản đăng nhập bằng Google chưa có mật khẩu cục bộ trên hệ thống.',
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new BadRequestException('Mật khẩu cũ không chính xác');
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(dto.newPassword, salt);

    await this.prisma.systemUser.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return {
      statusCode: 200,
      message: 'Đổi mật khẩu thành công',
      data: null,
      meta: null,
    };
  }

  async listRolesForAdmin() {
    return this.prisma.role.findMany({
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Danh sách giáo viên dùng để chọn GV khi xếp lịch / đổi GV.
   * Chỉ trả field công khai, giới hạn theo chi nhánh user được cấp (ADMIN: tất cả).
   */
  async listTeachers(branchIds: number[] | null) {
    const teachers = await this.prisma.systemUser.findMany({
      where: {
        status: 'ACTIVE',
        userRoles: { some: { role: { code: 'TEACHER' } } },
        ...(branchIds ? { userBranches: { some: { branchId: { in: branchIds } } } } : {}),
      },
      include: userInclude,
      orderBy: { fullName: 'asc' },
    });

    return {
      statusCode: 200,
      message: 'Lấy danh sách giáo viên thành công',
      data: teachers.map((teacher) => ({
        id: teacher.id,
        fullName: teacher.fullName,
        email: teacher.email,
        phone: teacher.phone ?? null,
        branchIds: teacher.userBranches.map((ub) => ub.branchId),
      })),
      meta: { total: teachers.length },
    };
  }

  async findAll() {
    const users = await this.prisma.systemUser.findMany({
      include: userInclude,
      orderBy: { id: 'asc' },
    });

    const formattedUsers = users.map((user) => {
      const { passwordHash: _ph, ...rest } = user;
      return toPublicUser(rest);
    });

    return {
      statusCode: 200,
      message: 'Lấy danh sách người dùng thành công',
      data: formattedUsers,
      meta: {
        total: formattedUsers.length,
      },
    };
  }

  async createUser(dto: CreateUserDto) {
    const username = normalizeUsername(dto.username);
    const email = dto.email.trim().toLowerCase();

    const [dupUser, dupEmail] = await Promise.all([
      this.prisma.systemUser.findUnique({ where: { username } }),
      this.prisma.systemUser.findUnique({ where: { email } }),
    ]);
    if (dupUser) throw new ConflictException('Username đã tồn tại');
    if (dupEmail) throw new ConflictException('Email đã được sử dụng');

    const roleRecords = await this.prisma.role.findMany({
      where: { code: { in: dto.roles } },
    });
    if (roleRecords.length !== dto.roles.length) {
      throw new BadRequestException('Một hoặc nhiều mã vai trò không hợp lệ');
    }

    const branches = await this.prisma.branch.findMany({
      where: { id: { in: dto.branchIds } },
    });
    if (branches.length !== dto.branchIds.length) {
      throw new BadRequestException('Một hoặc nhiều chi nhánh không tồn tại');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = await this.prisma.systemUser.create({
      data: {
        username,
        email,
        fullName: dto.fullName.trim(),
        phone: dto.phone?.trim() || null,
        passwordHash,
        status: 'ACTIVE',
        userRoles: {
          create: roleRecords.map((r) => ({ roleId: r.id })),
        },
        userBranches: {
          create: dto.branchIds.map((branchId) => ({ branchId })),
        },
      },
      include: userInclude,
    });

    return {
      statusCode: 201,
      message: 'Tạo tài khoản thành công',
      data: toPublicUser(user),
      meta: null,
    };
  }

  async updateUser(id: number, dto: UpdateUserDto) {
    const existing = await this.prisma.systemUser.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Người dùng không tồn tại');

    if (dto.roles !== undefined) {
      const roleRecords = await this.prisma.role.findMany({
        where: { code: { in: dto.roles } },
      });
      if (roleRecords.length !== dto.roles.length) {
        throw new BadRequestException('Một hoặc nhiều mã vai trò không hợp lệ');
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (roleRecords.length > 0) {
          await tx.userRole.createMany({
            data: roleRecords.map((r) => ({ userId: id, roleId: r.id })),
          });
        }
      });
    }

    if (dto.branchIds !== undefined) {
      const branches = await this.prisma.branch.findMany({
        where: { id: { in: dto.branchIds } },
      });
      if (branches.length !== dto.branchIds.length) {
        throw new BadRequestException('Một hoặc nhiều chi nhánh không tồn tại');
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.userBranch.deleteMany({ where: { userId: id } });
        if (dto.branchIds!.length > 0) {
          await tx.userBranch.createMany({
            data: dto.branchIds!.map((branchId) => ({ userId: id, branchId })),
          });
        }
      });
    }

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      const other = await this.prisma.systemUser.findFirst({
        where: { email, NOT: { id } },
      });
      if (other) throw new ConflictException('Email đã được sử dụng');
    }

    const scalar: {
      email?: string;
      fullName?: string;
      phone?: string | null;
      passwordHash?: string;
      status?: 'ACTIVE' | 'INACTIVE';
    } = {};

    if (dto.email !== undefined) scalar.email = dto.email.trim().toLowerCase();
    if (dto.fullName !== undefined) scalar.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) scalar.phone = dto.phone === null ? null : String(dto.phone).trim() || null;
    if (dto.password) {
      const salt = await bcrypt.genSalt(10);
      scalar.passwordHash = await bcrypt.hash(dto.password, salt);
    }
    if (dto.status !== undefined) {
      if (dto.status !== 'ACTIVE' && dto.status !== 'INACTIVE') {
        throw new BadRequestException('status phải là ACTIVE hoặc INACTIVE');
      }
      scalar.status = dto.status;
    }

    if (Object.keys(scalar).length > 0) {
      await this.prisma.systemUser.update({
        where: { id },
        data: scalar,
      });
    }

    const updated = await this.prisma.systemUser.findUnique({
      where: { id },
      include: userInclude,
    });

    return {
      statusCode: 200,
      message: 'Cập nhật tài khoản thành công',
      data: toPublicUser(updated!),
      meta: null,
    };
  }

  async updateRoles(userId: number, roles: string[]) {
    return this.updateUser(userId, { roles });
  }
}
