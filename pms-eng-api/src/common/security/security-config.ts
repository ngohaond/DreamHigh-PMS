type SecurityEnvironment = {
  NODE_ENV?: string;
  JWT_SECRET?: string;
  CORS_ORIGINS?: string;
  TRUST_PROXY_HOPS?: string;
};

export function resolveJwtSecret(environment: SecurityEnvironment = process.env): string {
  const secret = environment.JWT_SECRET?.trim();
  if (!secret) throw new Error('JWT_SECRET is required');
  if (secret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  return secret;
}

export function resolveCorsOrigins(environment: SecurityEnvironment = process.env): string[] {
  const configured = environment.CORS_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? [];
  if (environment.NODE_ENV === 'production' && configured.length === 0) {
    throw new Error('CORS_ORIGINS must be configured in production');
  }

  const origins = configured.length > 0 ? configured : ['http://localhost:5175', 'http://127.0.0.1:5175'];
  return origins.map((origin) => {
    if (origin === '*') throw new Error('CORS_ORIGINS cannot contain a wildcard');
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Invalid CORS origin: ${origin}`);
    }
    if (parsed.origin !== origin.replace(/\/$/, '')) {
      throw new Error(`CORS entries must be origins without paths: ${origin}`);
    }
    if (environment.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      throw new Error('Production CORS origins must use HTTPS');
    }
    return parsed.origin;
  });
}

export function resolveTrustedProxyHops(environment: SecurityEnvironment = process.env): number {
  const raw = environment.TRUST_PROXY_HOPS?.trim();
  if (!raw) return 0;
  if (!/^\d+$/.test(raw)) throw new Error('TRUST_PROXY_HOPS must be a non-negative integer');
  const hops = Number(raw);
  if (hops > 5) throw new Error('TRUST_PROXY_HOPS must not exceed 5');
  return hops;
}