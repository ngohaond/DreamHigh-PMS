import { requestIdMiddleware } from './request-id.middleware';

describe('requestIdMiddleware', () => {
  it('preserves a valid request ID and returns it to the caller', () => {
    const request = { headers: { 'x-request-id': 'client-request-123' } };
    const response = { setHeader: jest.fn() };
    const next = jest.fn();

    requestIdMiddleware(request as never, response as never, next);

    expect((request as typeof request & { requestId?: string }).requestId).toBe('client-request-123');
    expect(response.setHeader).toHaveBeenCalledWith('X-Request-Id', 'client-request-123');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('replaces invalid request IDs instead of reflecting them', () => {
    const request = { headers: { 'x-request-id': 'bad id\r\nheader' } };
    const response = { setHeader: jest.fn() };
    const next = jest.fn();

    requestIdMiddleware(request as never, response as never, next);

    const requestId = (request as typeof request & { requestId?: string }).requestId;
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.setHeader).toHaveBeenCalledWith('X-Request-Id', requestId);
  });
});