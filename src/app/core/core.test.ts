import test from 'node:test';
import assert from 'node:assert/strict';
import { redactSecrets, classifyError, normalizeError } from './error-handler';
import { validateApiUrl } from './url-validator';
import { parseMarkdown } from './markdown-parser';

test('redactSecrets hides sensitive keys and bearer tokens', () => {
  const secretMsg = 'Error with key sk-notrack-fbdd27780cdb50aa10134a0d069d5f183433217819bf8572 in request';
  const redacted = redactSecrets(secretMsg);
  assert.equal(redacted.includes('fbdd27780cdb50aa10134a0d069d5f183433217819bf8572'), false);
  assert.equal(redacted.includes('***REDACTED***'), true);

  const authHeader = 'Authorization: Bearer secret_token_xyz_123';
  assert.equal(redactSecrets(authHeader).includes('secret_token_xyz_123'), false);
});

test('classifyError maps HTTP codes properly', () => {
  assert.equal(classifyError(401), 'AUTHENTICATION_ERROR');
  assert.equal(classifyError(429), 'RATE_LIMIT');
  assert.equal(classifyError(500), 'PROVIDER_ERROR');
  assert.equal(classifyError(404), 'CONFIGURATION_ERROR');
  assert.equal(classifyError(undefined, 'Network request failed'), 'NETWORK_ERROR');
  assert.equal(classifyError(undefined, 'Connection timed out'), 'TIMEOUT_ERROR');
});

test('normalizeError returns localized messages for Arabic and English', () => {
  const normAr = normalizeError('AUTHENTICATION_ERROR', 'ar');
  assert.equal(normAr.category, 'AUTHENTICATION_ERROR');
  assert.equal(normAr.message.includes('NoTrack.ai'), true);

  const normEn = normalizeError('RATE_LIMIT', 'en');
  assert.equal(normEn.category, 'RATE_LIMIT');
  assert.equal(normEn.message.includes('Rate limit'), true);
});

test('validateApiUrl enforces valid protocols and blocks SSRF targets', () => {
  const validUrl = validateApiUrl('https://api.notrack.ai/v1');
  assert.equal(validUrl.valid, true);
  assert.equal(validUrl.sanitizedUrl, 'https://api.notrack.ai/v1');

  // SSRF tests
  assert.equal(validateApiUrl('http://169.254.169.254/latest/meta-data').valid, false);
  assert.equal(validateApiUrl('http://127.0.0.1:8080').valid, false);
  assert.equal(validateApiUrl('http://localhost:3000').valid, false);
  assert.equal(validateApiUrl('http://192.168.1.1').valid, false);
  assert.equal(validateApiUrl('ftp://example.com').valid, false);
  assert.equal(validateApiUrl('https://user:pass@example.com').valid, false);
});

test('markdown-parser escapes HTML tags and generates styled code blocks', () => {
  const rawWithScript = 'Hello <script>alert(1)</script>';
  const parsed = parseMarkdown(rawWithScript);
  assert.equal(parsed.includes('<script>'), false);
  assert.equal(parsed.includes('&lt;script&gt;'), true);

  const mdWithCode = 'Here is code:\n```typescript\nconst x = 10;\n```';
  const parsedCode = parseMarkdown(mdWithCode);
  assert.equal(parsedCode.includes('typescript'), true);
  assert.equal(parsedCode.includes('copy-code-btn'), true);
});
