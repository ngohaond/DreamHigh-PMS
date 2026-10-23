import { BadRequestException } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { AuditInterceptor, redactAuditValue } from './audit.interceptor';
import type { PrismaService } from '../../prisma/prisma.service';

describe('AuditInterceptor', () => {
  const request = (overrides: Record<string, unknown> = {}) => ({
    method: 'POST',
    originalUrl: '/api/students',
    body: {},
    user: { userId: 3 },
    ip: '127.0.0.1',
    headers: {},
    params: {},
    ...overrides,
  });

  it('waits for successful audit persistence and redacts nested sensitive fields', async () => {
    const auditCreate = jest.fn().mockResolvedValue({});
    const interceptor = new AuditInterceptor({ auditLog: { create: auditCreate } } as unknown as PrismaService);
    const response = { statusCode: 201, data: { id: 12 } };
    const context = { switchToHttp: () => ({ getRequest: () => request({
      body: { name: 'A', contact: { email: 'person@example.test', phone: '0900000000' }, metadata: [{ password: 'secret' }] },
    }) }) } as never;

    await expect(firstValueFrom(interceptor.intercept(context, { handle: () => of(response) } as never))).resolves.toBe(response);
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        resource: 'STUDENTS',
        recordId: '12',
        details: expect.objectContaining({
          failed: false,
          payload: {
            name: 'A',
            contact: { email: '[REDACTED]', phone: '[REDACTED]' },
            metadata: [{ password: '[REDACTED]' }],
          },
        }),
      }),
    }));
  });

  it('records a failed mutation without swallowing the original error', async () => {
    const auditCreate = jest.fn().mockResolvedValue({});
    const interceptor = new AuditInterceptor({ auditLog: { create: auditCreate } } as unknown as PrismaService);
    const context = { switchToHttp: () => ({ getRequest: () => request({ originalUrl: '/api/auth/login' }) }) } as never;
    const error = new BadRequestException('invalid');

    await expect(firstValueFrom(interceptor.intercept(context, { handle: () => throwError(() => error) } as never))).rejects.toBe(error);
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'CREATE_FAILED', resource: 'AUTH', details: expect.objectContaining({ failed: true }) }),
    }));
  });

  it('does not duplicate Finance audit records already written transactionally', async () => {
    const auditCreate = jest.fn();
    const interceptor = new AuditInterceptor({ auditLog: { create: auditCreate } } as unknown as PrismaService);
    const context = { switchToHttp: () => ({ getRequest: () => request({ originalUrl: '/api/finance/invoices' }) }) } as never;

    await expect(firstValueFrom(interceptor.intercept(context, { handle: () => of({}) } as never))).resolves.toEqual({});
    expect(auditCreate).not.toHaveBeenCalled();
  });
});

describe('redactAuditValue', () => {
  it('normalizes sensitive keys with underscores and mixed case', () => {
    expect(redactAuditValue({ ACCESS_TOKEN: 'secret', nested: { googleSub: 'oidc', keep: 1 } })).toEqual({
      ACCESS_TOKEN: '[REDACTED]',
      nested: { googleSub: '[REDACTED]', keep: 1 },
    });
  });
});