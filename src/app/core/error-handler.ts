import { ErrorCategory, AppLanguage } from './types';

export interface NormalizedError {
  category: ErrorCategory;
  message: string;
  recoveryAction: string;
  statusCode?: number;
}

/**
 * Redacts potential secret tokens and API keys from error messages or logs.
 */
export function redactSecrets(text: string): string {
  if (!text) return '';
  // Redact sk-notrack, sk-, bearer tokens, authorization strings
  return text
    .replace(/(sk-notrack-[a-zA-Z0-9_-]{6})[a-zA-Z0-9_-]+/gi, '$1***REDACTED***')
    .replace(/(Bearer\s+)[a-zA-Z0-9._-]+/gi, '$1***REDACTED***')
    .replace(/(apiKey["']?\s*[:=]\s*["']?)[a-zA-Z0-9_-]+/gi, '$1***REDACTED***');
}

/**
 * Classifies HTTP status or error payload into structured category.
 */
export function classifyError(status?: number, rawError?: string): ErrorCategory {
  if (status === 402 || (rawError && /402|credit|رصيد|no_credit|شحن|payment/i.test(rawError))) {
    return 'QUOTA_OR_BILLING_ERROR';
  }
  if (status === 401 || (rawError && /401|revoked|auth|unauthorized|مفتاح غير صالح|غير مصرح/i.test(rawError))) {
    return 'AUTHENTICATION_ERROR';
  }
  if (status === 429 || (rawError && /429|rate limit|تجاوز حد|الانتظار/i.test(rawError))) {
    return 'RATE_LIMIT';
  }
  if (status === 404 || (rawError && /404|not found|غير موجود/i.test(rawError))) {
    return 'CONFIGURATION_ERROR';
  }
  if (status === 400 || (rawError && /400|قائمة الرسائل مطلوبة/i.test(rawError))) {
    return 'VALIDATION_ERROR';
  }
  if (status === 403) return 'AUTHORIZATION_ERROR';
  if ((status && status >= 500 && status < 600) || (rawError && /500|502|503|504|خادم|خوادم|provider/i.test(rawError))) {
    return 'PROVIDER_ERROR';
  }
  if (rawError && /network|failed to fetch|econnrefused|aborted|تعذر الوصول/i.test(rawError)) {
    return 'NETWORK_ERROR';
  }
  if (rawError && /timeout|timed out|مهلة/i.test(rawError)) {
    return 'TIMEOUT_ERROR';
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Provides user-friendly, localized error and recovery messages.
 */
export function normalizeError(
  category: ErrorCategory,
  lang: AppLanguage = 'ar',
  status?: number
): NormalizedError {
  const isAr = lang === 'ar';

  switch (category) {
    case 'AUTHENTICATION_ERROR':
      return {
        category,
        statusCode: status || 401,
        message: isAr
          ? 'فشل التحقق من مفتاح API لـ NoTrack.ai (غير صالح أو منتهي الصلاحية).'
          : 'Failed to authenticate with NoTrack.ai API key (invalid or expired).',
        recoveryAction: isAr
          ? 'يرجى مراجعة وتحديث مفتاح NoTrack API في الإعدادات.'
          : 'Please check and update your NoTrack API key in Settings.',
      };

    case 'RATE_LIMIT':
      return {
        category,
        statusCode: status || 429,
        message: isAr
          ? 'تم تجاوز حد الطلبات المسموح به مؤقتاً.'
          : 'Rate limit reached. Please pause briefly.',
        recoveryAction: isAr
          ? 'يرجى الانتظار بضع ثوانٍ قبل إرسال الرسالة التالية.'
          : 'Please wait a few seconds before trying again.',
      };

    case 'QUOTA_OR_BILLING_ERROR':
      return {
        category,
        statusCode: status || 402,
        message: isAr
          ? 'رصيد حساب NoTrack غير كافٍ أو انتهت حصة الاستخدام.'
          : 'NoTrack account quota exceeded or insufficient credits.',
        recoveryAction: isAr
          ? 'يرجى التحقق من شحن الرصيد في حساب NoTrack الخاص بك.'
          : 'Please verify your credits in your NoTrack account dashboard.',
      };

    case 'CONFIGURATION_ERROR':
      return {
        category,
        statusCode: status || 404,
        message: isAr
          ? 'إعدادات الاتصال أو النموذج غير صحيحة.'
          : 'Configuration or model ID is invalid.',
        recoveryAction: isAr
          ? 'تأكد من عنوان URL واسم النموذج في الإعدادات.'
          : 'Check the endpoint URL and model ID in Settings.',
      };

    case 'NETWORK_ERROR':
    case 'TIMEOUT_ERROR':
      return {
        category,
        statusCode: status,
        message: isAr
          ? 'تعذر الوصول إلى مزود الذكاء الاصطناعي (انقطاع الاتصال أو تجاوز وقت الانتظار).'
          : 'Could not reach NoTrack AI provider (network disconnect or timeout).',
        recoveryAction: isAr
          ? 'تحقق من اتصال الإنترنت، واضغط زر إعادة المحاولة.'
          : 'Check your internet connection and click retry.',
      };

    case 'PROVIDER_ERROR':
      return {
        category,
        statusCode: status || 500,
        message: isAr
          ? 'واجه خادم NoTrack.ai خطأ داخلياً أثناء معالجة الطلب.'
          : 'NoTrack.ai server encountered an internal error.',
        recoveryAction: isAr
          ? 'الخدمة قد تكون تحت ضغط مؤقت، أعد المحاولة بعد لحظات.'
          : 'The service might be under temporary load. Try again shortly.',
      };

    default:
      return {
        category: 'UNKNOWN_ERROR',
        statusCode: status,
        message: isAr
          ? 'حدث خطأ غير متوقع أثناء معالجة المحادثة.'
          : 'An unexpected error occurred during conversation processing.',
        recoveryAction: isAr
          ? 'يمكنك إعادة إرسال الرسالة أو فحص التشخيص في الإعدادات.'
          : 'You can retry sending or check Diagnostics in Settings.',
      };
  }
}
