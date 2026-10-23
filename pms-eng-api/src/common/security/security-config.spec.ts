import { resolveCorsOrigins, resolveJwtSecret, resolveTrustedProxyHops } from './security-config';

describe('security configuration', () => {
  it('requires a strong JWT secret', () => {
    expect(() => resolveJwtSecret({})).toThrow('JWT_SECRET is required');
    expect(() => resolveJwtSecret({ JWT_SECRET: 'short' })).toThrow('at least 32 characters');
    expect(resolveJwtSecret({ JWT_SECRET: 'test-only-secret-that-is-at-least-32-characters' })).toBe(
      'test-only-secret-that-is-at-least-32-characters',
    );
  });

  it('requires an explicit HTTPS allowlist in production', () => {
    expect(() => resolveCorsOrigins({ NODE_ENV: 'production' })).toThrow('CORS_ORIGINS must be configured');
    expect(() => resolveCorsOrigins({ NODE_ENV: 'production', CORS_ORIGINS: '*' })).toThrow('wildcard');
    expect(() => resolveCorsOrigins({ NODE_ENV: 'production', CORS_ORIGINS: 'http://app.example.com' })).toThrow('HTTPS');
    expect(resolveCorsOrigins({ NODE_ENV: 'production', CORS_ORIGINS: 'https://app.example.com' })).toEqual([
      'https://app.example.com',
    ]);
  });

  it('validates trusted proxy hop configuration', () => {
    expect(resolveTrustedProxyHops({})).toBe(0);
    expect(resolveTrustedProxyHops({ TRUST_PROXY_HOPS: '1' })).toBe(1);
    expect(() => resolveTrustedProxyHops({ TRUST_PROXY_HOPS: 'all' })).toThrow('non-negative integer');
    expect(() => resolveTrustedProxyHops({ TRUST_PROXY_HOPS: '6' })).toThrow('must not exceed 5');
  });
});