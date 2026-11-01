export interface UrlValidationResult {
  valid: boolean;
  error?: string;
  sanitizedUrl?: string;
}

const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/, // Link-local and cloud metadata
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

/**
 * Validates a user-supplied API Base URL to prevent SSRF vulnerabilities.
 */
export function validateApiUrl(rawUrl: string, allowLocalhostForDev = false): UrlValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'عنوان URL مطلوب وغير صالح.' };
  }

  const trimmed = rawUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'صيغة عنوان URL غير صحيحة.' };
  }

  // Scheme validation: must be http or https
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, error: 'يجب أن يبدأ الرابط بـ https:// أو http://' };
  }

  // Reject embedded credentials in URL
  if (parsed.username || parsed.password) {
    return { valid: false, error: 'غير مسموح بتضمين بيانات اعتماد داخل عنوان URL.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // If in dev and allowLocalhost is enabled, permit localhost
  if (allowLocalhostForDev && (hostname === 'localhost' || hostname === '127.0.0.1')) {
    return {
      valid: true,
      sanitizedUrl: parsed.origin + parsed.pathname.replace(/\/+$/, ''),
    };
  }

  // SSRF Protection: check against private/internal IP ranges
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return {
        valid: false,
        error: 'غير مسموح بالاتصال بعناوين شبكة محلية أو خوادم داخلية (حماية SSRF).',
      };
    }
  }

  // Remove trailing slashes from sanitized URL
  const sanitized = parsed.origin + parsed.pathname.replace(/\/+$/, '');

  return {
    valid: true,
    sanitizedUrl: sanitized,
  };
}
