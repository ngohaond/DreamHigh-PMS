import { ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('keeps liveness independent of database availability', () => {
    const controller = new HealthController({} as PrismaService);
    expect(controller.check()).toEqual({ status: 'ok' });
  });

  it('reports ready when the database responds', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const controller = new HealthController(prisma as unknown as PrismaService);

    await expect(controller.readiness()).resolves.toEqual({
      status: 'ready',
      dependencies: { database: 'ok' },
    });
  });

  it('returns a safe unavailable response when the database check fails', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('secret connection details')) };
    const controller = new HealthController(prisma as unknown as PrismaService);

    await expect(controller.readiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(controller.readiness()).rejects.toThrow('Database readiness check failed');
  });
});