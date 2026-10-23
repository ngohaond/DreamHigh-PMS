import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError, concatMap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

const REDACTED = '[REDACTED]';
const SENSITIVE_KEYS = new Set([
  'password', 'passwordhash', 'oldpassword', 'newpassword', 'token', 'accesstoken',
  'refreshtoken', 'authorization', 'cookie', 'secret', 'clientsecret', 'googlesub',
  'email', 'phone', 'dob', 'idnumber', 'address',
]);

function normalizedKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function redactAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAuditValue);
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
    key,
    SENSITIVE_KEYS.has(normalizedKey(key)) ? REDACTED : redactAuditValue(nested),
  ]));
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, originalUrl, url, body, user, ip, requestId } = request;
    const requestUrl = originalUrl ?? url ?? '';

    // Finance mutations write their audit row in the same transaction as the business change.
    if (requestUrl.startsWith('/api/finance/')) {
      return next.handle();
    }

    // Only log modifying actions (POST, PATCH, DELETE)
    const monitoredMethods = ['POST', 'PATCH', 'DELETE'];
    if (!monitoredMethods.includes(method)) {
      return next.handle();
    }

    const writeAudit = async (response: unknown, failed: boolean) => {
      try {
        const parts = requestUrl.split('?')[0].split('/').filter(Boolean);
        const resource = parts[1] || 'unknown';
        const actionMap: Record<string, string> = {
          POST: 'CREATE',
          PATCH: 'UPDATE',
          DELETE: 'DELETE',
        };
        const responseData = response && typeof response === 'object' && 'data' in response
          ? (response as { data?: { id?: unknown } }).data
          : undefined;
        const routeId = request.params && typeof request.params.id === 'string' ? request.params.id : null;
        const responseId = responseData?.id;

        await this.prisma.auditLog.create({
          data: {
            userId: user?.userId || null,
            action: failed ? `${actionMap[method] ?? method}_FAILED` : actionMap[method] ?? method,
            resource: resource.toUpperCase(),
            recordId: routeId ?? (responseId === undefined ? null : String(responseId)),
            ipAddress: ip ?? request.ip ?? null,
            details: {
              payload: redactAuditValue(body ?? {}) as object,
              failed,
              requestId: requestId ?? null,
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch (error) {
        this.logger.error('Failed to persist audit event');
      }
    };

    return next.handle().pipe(
      concatMap(async (response) => {
        await writeAudit(response, false);
        return response;
      }),
      catchError(async (error: unknown) => {
        await writeAudit(null, true);
        throw error;
      }),
    );
  }
}
