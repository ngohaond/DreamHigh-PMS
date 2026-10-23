import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Public liveness probe cho Render / load balancer (không JWT). */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  check() {
    return { status: 'ok' };
  }

  @Get('ready')
  async readiness() {
    try {
      await this.prisma.$queryRaw(Prisma.sql`SELECT 1`);
      return { status: 'ready', dependencies: { database: 'ok' } };
    } catch {
      throw new ServiceUnavailableException('Database readiness check failed');
    }
  }
}
