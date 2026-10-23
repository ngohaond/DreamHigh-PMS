import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

type RequestWithId = Request & { requestId?: string };

export function requestIdMiddleware(request: Request, response: Response, next: NextFunction) {
  const requestWithId = request as RequestWithId;
  const incoming = request.headers['x-request-id'];
  const candidate = typeof incoming === 'string' ? incoming : '';
  const requestId = /^[A-Za-z0-9._-]{1,64}$/.test(candidate) ? candidate : randomUUID();
  requestWithId.requestId = requestId;
  response.setHeader('X-Request-Id', requestId);
  next();
}