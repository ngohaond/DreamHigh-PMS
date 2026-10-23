const baseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';

const checks = [
  { name: 'API health', path: '/api/health', expected: 200 },
  { name: 'database readiness', path: '/api/health/ready', expected: 200 },
  { name: 'fee plans require authentication', path: '/api/finance/fee-plans', expected: 401 },
  { name: 'invoice reads require authentication', path: '/api/finance/invoices/1', expected: 401 },
  { name: 'payment reads require authentication', path: '/api/finance/payments/1', expected: 401 },
  { name: 'receipt download requires authentication', path: '/api/finance/payments/1/receipt.pdf', expected: 401 },
  { name: 'arrears report requires authentication', path: '/api/reports/arrears', expected: 401 },
];

let failed = false;

for (const check of checks) {
  try {
    const response = await fetch(new URL(check.path, baseUrl), { redirect: 'manual' });
    const passed = response.status === check.expected;
    console.log(`${passed ? 'PASS' : 'FAIL'} ${check.name}: HTTP ${response.status}, expected ${check.expected}`);
    failed ||= !passed;
  } catch (error) {
    console.log(`FAIL ${check.name}: ${error.message}`);
    failed = true;
  }
}

try {
  const health = await fetch(new URL('/api/health', baseUrl));
  for (const [header, expected] of [['x-content-type-options', 'nosniff'], ['x-frame-options', 'SAMEORIGIN']]) {
    const actual = health.headers.get(header);
    const passed = actual?.toLowerCase() === expected.toLowerCase();
    console.log(`${passed ? 'PASS' : 'FAIL'} ${header}: ${actual ?? 'missing'}, expected ${expected}`);
    failed ||= !passed;
  }
  const requestId = health.headers.get('x-request-id');
  const requestIdPassed = /^[A-Za-z0-9._-]{1,64}$/.test(requestId ?? '');
  console.log(`${requestIdPassed ? 'PASS' : 'FAIL'} x-request-id: ${requestId ?? 'missing'}`);
  failed ||= !requestIdPassed;
} catch (error) {
  console.log(`FAIL security headers: ${error.message}`);
  failed = true;
}

try {
  const response = await fetch(new URL('/api/auth/register', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `invalid-dto-${Date.now()}@example.test`,
      fullName: 'Invalid DTO Test',
      password: 'ValidPassword123',
      isSuperAdmin: true,
    }),
  });
  const passed = response.status === 400;
  console.log(`${passed ? 'PASS' : 'FAIL'} unknown auth fields rejected: HTTP ${response.status}, expected 400`);
  failed ||= !passed;
} catch (error) {
  console.log(`FAIL strict DTO validation: ${error.message}`);
  failed = true;
}

try {
  const statuses = [];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(new URL('/api/auth/login', baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `rate-limit-${attempt}@example.test`, password: 'IncorrectPassword123' }),
    });
    statuses.push(response.status);
  }
  const passed = statuses.slice(0, 5).every((status) => status === 401) && statuses[5] === 429;
  console.log(`${passed ? 'PASS' : 'FAIL'} login throttling: ${statuses.join(', ')}, expected five 401 then 429`);
  failed ||= !passed;
} catch (error) {
  console.log(`FAIL login throttling: ${error.message}`);
  failed = true;
}

process.exitCode = failed ? 1 : 0;