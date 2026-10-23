import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type ErrorResponse = {
  status(code: number): ErrorResponse;
  json(body: Record<string, unknown>): void;
};

type RequestWithId = { requestId?: string };

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter<Prisma.PrismaClientKnownRequestError> {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<ErrorResponse>();
    const request = context.getRequest<RequestWithId>();
    const mapping: Record<string, { statusCode: number; message: string }> = {
      P2002: { statusCode: HttpStatus.CONFLICT, message: 'A record with these values already exists.' },
      P2025: { statusCode: HttpStatus.NOT_FOUND, message: 'The requested record was not found.' },
      P2003: { statusCode: HttpStatus.BAD_REQUEST, message: 'A related record is invalid.' },
    };
    const result = mapping[exception.code] ?? {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'A database operation could not be completed.',
    };

    response.status(result.statusCode).json({
      statusCode: result.statusCode,
      message: result.message,
      error: 'DatabaseError',
      requestId: request.requestId ?? null,
    });
  }
}