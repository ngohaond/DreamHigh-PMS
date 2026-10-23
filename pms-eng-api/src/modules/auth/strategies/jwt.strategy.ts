import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { resolveJwtSecret } from '../../../common/security/security-config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(),
    });
  }

  async validate(payload: { sub: number; email?: string; roles?: string[] }) {
    const user = await this.prisma.systemUser.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: { include: { role: true } },
        userBranches: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Token không hợp lệ hoặc người dùng không tồn tại');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tài khoản của bạn đã bị vô hiệu hóa');
    }

    const roles = user.userRoles.map((ur) => ur.role.code);
    const branchIds = user.userBranches.map((ub) => ub.branchId);

    return {
      userId: user.id,
      email: user.email,
      roles,
      branchIds,
    };
  }
}
