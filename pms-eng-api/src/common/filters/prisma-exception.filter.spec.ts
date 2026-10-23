import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

describe('PrismaExceptionFilter', () => {
  function run(code: string) {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const context = {
      switchToHttp: () => ({
        getResponse: () => ({ status, json }),
        getRequest: () => ({ requestId: 'trace-123' }),
      }),
    };
    const error = new Prisma.PrismaClientKnownRequestError('sensitive database details', {
      code,
      clientVersion: 'test',
    });
    new PrismaExceptionFilter().catch(error, context as never);
    return { status, json };
  }

  it.each([
    ['P2002', 409, 'A record with these values already exists.'],
    ['P2025', 404, 'The requested record was not found.'],
    ['P2003', 400, 'A related record is invalid.'],
    ['P2010', 500, 'A database operation could not be completed.'],
  ])('maps %s to a safe HTTP response', (code, statusCode, message) => {
    const result = run(code);
    expect(result.status).toHaveBeenCalledWith(statusCode);
    expect(result.json).toHaveBeenCalledWith({
      statusCode,
      message,
      error: 'DatabaseError',
      requestId: 'trace-123',
    });
    expect(JSON.stringify(result.json.mock.calls[0][0])).not.toContain('sensitive database details');
  });
});