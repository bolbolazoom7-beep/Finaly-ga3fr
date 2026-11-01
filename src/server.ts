import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express, { Request, Response } from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// Parse JSON bodies with up to 25MB for image attachments and docs
app.use(express.json({ limit: '25mb' }));

// ==========================================
// SYSTEM TIME & CAIRO TIMEZONE
// ==========================================
export function getCairoInfo() {
  const now = new Date();
  const optionsDate: Intl.DateTimeFormatOptions = {
    timeZone: 'Africa/Cairo',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  const optionsTime: Intl.DateTimeFormatOptions = {
    timeZone: 'Africa/Cairo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  };

  const arabicDate = new Intl.DateTimeFormat('ar-EG', optionsDate).format(now);
  const arabicTime = new Intl.DateTimeFormat('ar-EG', optionsTime).format(now);
  const englishDate = new Intl.DateTimeFormat('en-US', optionsDate).format(now);
  const englishTime = new Intl.DateTimeFormat('en-US', optionsTime).format(now);

  return {
    timestamp: now.getTime(),
    timezone: 'Africa/Cairo',
    cairoDateArabic: arabicDate,
    cairoTimeArabic: arabicTime,
    cairoDateEnglish: englishDate,
    cairoTimeEnglish: englishTime,
    fullSummary: `التاريخ الفعلي الحالي: ${arabicDate}، الوقت: ${arabicTime} بتوقيت القاهرة (مصر - Africa/Cairo). العام الحالي هو ${now.getFullYear()}.`,
  };
}

// ==========================================
// CONFIGURATION & SECRETS STATE
// ==========================================
let adminAccessCode = process.env['ADMIN_ACCESS_CODE'] || '098765';

// API Keys - Protected on backend only
const envKey = process.env['NOTRACK_API_KEY'] || '';
const isRevokedKey = envKey.includes('8572') || envKey.includes('693c');
const DEFAULT_NOTRACK_KEY =
  envKey && !isRevokedKey
    ? envKey
    : 'sk-notrack-6e8d90cd1a6054e839aa86aa192a0940eb37a3dd2b5b1cbf';
let activeNoTrackKey = DEFAULT_NOTRACK_KEY;
let activeNoTrackBaseUrl = (
  process.env['NOTRACK_BASE_URL'] || 'https://api.notrack.ai/v1'
).replace(/\/+$/, '');
let activeNoTrackModel = process.env['NOTRACK_MODEL'] || 'notrack-uncensored';

// Rate Limiting for Admin Verification
interface RateLimitRecord {
  attempts: number;
  lockedUntil: number;
}
const adminRateLimits = new Map<string, RateLimitRecord>();

function checkAdminRateLimit(ip: string): { allowed: boolean; waitSeconds?: number } {
  const record = adminRateLimits.get(ip);
  if (!record) return { allowed: true };

  const now = Date.now();
  if (record.lockedUntil > now) {
    const waitSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  if (record.lockedUntil <= now && record.attempts >= 5) {
    // Lockout expired, reset attempts
    record.attempts = 0;
    record.lockedUntil = 0;
  }

  return { allowed: true };
}

function recordAdminFailure(ip: string) {
  const now = Date.now();
  let record = adminRateLimits.get(ip);
  if (!record) {
    record = { attempts: 1, lockedUntil: 0 };
    adminRateLimits.set(ip, record);
    return;
  }
  record.attempts += 1;
  if (record.attempts >= 5) {
    // 15 minutes lockout
    record.lockedUntil = now + 15 * 60 * 1000;
  }
}

function resetAdminFailures(ip: string) {
  adminRateLimits.delete(ip);
}

function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 10) return '***';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

function isValidUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ==========================================
// SYSTEM PROMPT BUILDER FOR JA3FAR AI
// ==========================================
interface PromptContext {
  userName?: string;
  userInterests?: string;
  personalNotes?: string;
  preferredLanguage?: 'ar' | 'en';
  preferredDialect?: 'egyptian' | 'saudi' | 'levantine' | 'msa' | 'english';
  assistantName?: string;
  personality?: 'friendly_humorous' | 'professional' | 'concise' | 'creative';
  tone?: 'casual' | 'formal';
  responseLength?: 'concise' | 'medium' | 'detailed';
  formattingStyle?: 'structured' | 'conversational' | 'code_heavy';
  customInstructions?: string;
  memories?: { key: string; value: string }[];
  enableLiveSearch?: boolean;
}

function buildSystemPrompt(context: PromptContext = {}): string {
  const cairoInfo = getCairoInfo();
  const assistantName = context.assistantName || 'جعفر';
  const dialect = context.preferredDialect || 'egyptian';
  const personality = context.personality || 'friendly_humorous';
  const tone = context.tone || 'casual';
  const length = context.responseLength || 'medium';

  let dialectGuideline = '';
  switch (dialect) {
    case 'egyptian':
      dialectGuideline = 'تحدث باللهجة المصرية الطبيعية الذكية والودية (مثل: تمام يا غالي، حاضر من عيوني، مفيش مشكلة، يا باشمهندس، على راسي، إلخ) مع صياغة واضحة وذكية بدون تصنع أو ابتذال، مع الحفاظ على القواعد العلمية والتقنية الصحيحة.';
      break;
    case 'saudi':
      dialectGuideline = 'تحدث باللهجة السعودية الخليجية البيضاء والمهذبة مع الحفاظ على الدقة العلمية.';
      break;
    case 'levantine':
      dialectGuideline = 'تحدث باللهجة الشامية اللطيفة والمحببة مع الدقة والوضوح.';
      break;
    case 'msa':
      dialectGuideline = 'تحدث باللغة العربية الفصحى السليمة والراقية مع صياغة فصيحة ومتقنة.';
      break;
    case 'english':
      dialectGuideline = 'Communicate in clear, natural, and highly articulate English.';
      break;
  }

  let personalityGuideline = '';
  switch (personality) {
    case 'friendly_humorous':
      personalityGuideline = 'كن ودوداً، ذكياً، وخفيف الظل بروح مصرية أصيلة دون مبالغة، واجعل المستخدم يشعر بالراحة والاهتمام.';
      break;
    case 'professional':
      personalityGuideline = 'كن مهنياً، منظماً، موضوعياً، ودقيقاً بأسلوب احترافي رفيع.';
      break;
    case 'concise':
      personalityGuideline = 'كن مباشراً، سريعاً، وركز على الإجابة المفيدة دون مقدمات طويلة أو حشو.';
      break;
    case 'creative':
      personalityGuideline = 'كن مبدعاً وغنياً بالأفكار والمجازات الجميلة والحلول غير التقليدية.';
      break;
  }

  let lengthGuideline = '';
  switch (length) {
    case 'concise':
      lengthGuideline = 'اجعل الردود موجزة ومباشرة وتفي بالغرض بدقة.';
      break;
    case 'detailed':
      lengthGuideline = 'قدم شروحات وافية وشاملة وتفاصيل دقيقة مع أمثلة واضحة وتنسيق منظم.';
      break;
    default:
      lengthGuideline = 'اجعل طول الرد متوازناً، يغطي المطلوب دون إطالة مملة.';
  }

  let userContextDetails = '';
  if (context.userName) {
    userContextDetails += `\n- اسم المستخدم: ${context.userName}`;
  }
  if (context.userInterests) {
    userContextDetails += `\n- اهتمامات المستخدم: ${context.userInterests}`;
  }
  if (context.personalNotes) {
    userContextDetails += `\n- ملاحظات وتفضيلات المستخدم: ${context.personalNotes}`;
  }
  if (context.memories && context.memories.length > 0) {
    userContextDetails += '\n- معلومات محفوظة عن المستخدم بالذاكرة:';
    for (const mem of context.memories) {
      userContextDetails += `\n  * [${mem.key}]: ${mem.value}`;
    }
  }

  let customInstructionText = '';
  if (context.customInstructions && context.customInstructions.trim()) {
    customInstructionText = `\n\nتعليمات خاصة من المستخدم يجب الالتزام بها بدقة:\n${context.customInstructions.trim()}`;
  }

  return `أنت "${assistantName}" (Ja3far AI)، المساعد الذكي المستقل وفائق الخصوصية المبني على تقنيات NoTrack.ai (نموذج notrack-uncensored).
أنت جعفر فقط، ولا تنسب نفسك أو تذكر أي شركة ذكاء اصطناعي أخرى تحت أي ظرف من الظروف.

معلومات الزمان والمكان المؤكدة حالياً:
- ${cairoInfo.fullSummary}
- يجب أن تعتمد على هذا التاريخ والتوقيت في كل إجاباتك التي تتطلب معرفة التاريخ والوقت الحالي (مثال: المباريات الجارية، السنة الحالية، الأعياد والمواسم، آخر التطورات).

شخصيتك وأسلوبك:
- ${dialectGuideline}
- ${personalityGuideline}
- النبرة المطلوبة: ${tone === 'formal' ? 'رسمية وأنيقة' : 'عفوية وودية وغير متكلفة'}.
- تفضيل طول الرد: ${lengthGuideline}
- أنت تفهم بطلاقة العامية المصرية، اللهجات العربية الأخرى، الفصحى، واللغة الإنجليزية، وتجيب وفق لغة وسياق حديث المستخدم.
- إذا سألك المستخدم عن أخبار الرياضة ومباريات اليوم (خاصة الأهلي والزمالك والدوري المصري والإنجليزي ودوري أبطال أوروبا) أو التكنولوجيا أو الأسعار، استخدم أحدث المعلومات الموثوقة والمدققة، واذكر مصادرك أو تواريخ النشر إن وجدت.
- عندما تقدم كوداً برمجياً، نسقه دائماً داخل كتل كود مع تحديد اللغة، واستخدم أفضل الممارسات.
- عندما تحتوي الإجابة على معادلات رياضية، اكتبها بتنسيق LaTeX ($للمعادلات المضمنة$ أو $$للمعادلات المستقلة$$).
- نسق إجاباتك بمهارة باستخدام العناوين، القوائم المنقطة، والجداول المنظمة عند المقارنات.
${userContextDetails}${customInstructionText}
تذكر: أنت جعفر فقط، رفيق ذكي، أمين، عالي الكفاءة، وذو حضور مميز ومريح وفائق الخصوصية.`;
}

// ==========================================
// API ROUTES
// ==========================================

// 1. System Time in Egypt (Africa/Cairo)
app.get('/api/time', (_req: Request, res: Response) => {
  res.json(getCairoInfo());
});

// 2. Health Endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    service: 'Ja3far AI Backend (Powered by NoTrack.ai)',
    activeProvider: 'notrack',
    notrackReady: !!activeNoTrackKey,
    model: activeNoTrackModel,
    cairoTime: getCairoInfo().fullSummary,
  });
});

// 3. Public Masked Config
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    provider: 'notrack',
    baseUrl: activeNoTrackBaseUrl,
    model: activeNoTrackModel,
    apiKeyMasked: maskKey(activeNoTrackKey),
    isConfigured: !!activeNoTrackKey,
  });
});

// 4. Admin Authentication
app.post('/api/admin/verify', (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const { code } = req.body;

  const rateCheck = checkAdminRateLimit(ip);
  if (!rateCheck.allowed) {
    res.status(429).json({
      success: false,
      error: `تم قفل محاولات الدخول مؤقتاً بسبب تكرار الرمز الخاطئ. يرجى الانتظار ${rateCheck.waitSeconds} ثانية.`,
      locked: true,
      waitSeconds: rateCheck.waitSeconds,
    });
    return;
  }

  if (typeof code !== 'string' || code.trim() !== adminAccessCode) {
    recordAdminFailure(ip);
    res.status(401).json({
      success: false,
      error: 'رمز الوصول غير صحيح. يرجى التأكد والمحاولة مجدداً.',
    });
    return;
  }

  resetAdminFailures(ip);
  res.json({
    success: true,
    message: 'تم التحقق بنجاح من صلاحيات الإدارة.',
  });
});

// 5. Admin Change Access Code
app.post('/api/admin/change-code', (req: Request, res: Response) => {
  const { currentCode, newCode } = req.body;

  if (currentCode !== adminAccessCode) {
    res.status(401).json({ success: false, error: 'رمز الوصول الحالي غير صحيح.' });
    return;
  }

  if (!newCode || typeof newCode !== 'string' || newCode.trim().length < 6) {
    res.status(400).json({
      success: false,
      error: 'الرمز الجديد يجب أن يتكون من 6 خانات على الأقل.',
    });
    return;
  }

  adminAccessCode = newCode.trim();
  res.json({
    success: true,
    message: 'تم تغيير رمز الوصول الإداري بنجاح.',
  });
});

// 6. Admin Get Full API Configuration Status
app.get('/api/admin/config', (req: Request, res: Response) => {
  const authHeader = req.headers['x-admin-code'];
  if (authHeader !== adminAccessCode) {
    res.status(401).json({ error: 'غير مصرح بالوصول إلى لوحة الإدارة.' });
    return;
  }

  res.json({
    provider: 'notrack',
    notrack: {
      hasKey: !!activeNoTrackKey,
      maskedKey: maskKey(activeNoTrackKey),
      baseUrl: activeNoTrackBaseUrl,
      model: activeNoTrackModel,
    },
  });
});

// 7. Admin Update API Keys
app.post('/api/admin/update-keys', (req: Request, res: Response) => {
  const authHeader = req.headers['x-admin-code'];
  if (authHeader !== adminAccessCode) {
    res.status(401).json({ error: 'غير مصرح بالوصول.' });
    return;
  }

  const { notrackKey, notrackBaseUrl, notrackModel } = req.body;

  if (typeof notrackKey === 'string' && notrackKey.trim()) {
    activeNoTrackKey = notrackKey.trim();
  }
  if (typeof notrackBaseUrl === 'string' && notrackBaseUrl.trim()) {
    if (!isValidUrl(notrackBaseUrl)) {
      res.status(400).json({ error: 'عنوان رابط NoTrack غير صالح أو محظور أمنياً.' });
      return;
    }
    activeNoTrackBaseUrl = notrackBaseUrl.trim().replace(/\/+$/, '');
  }
  if (typeof notrackModel === 'string' && notrackModel.trim()) {
    activeNoTrackModel = notrackModel.trim();
  }

  res.json({
    success: true,
    message: 'تم تحديث تكوين NoTrack بنجاح.',
    activeProvider: 'notrack',
    notrackMasked: maskKey(activeNoTrackKey),
    model: activeNoTrackModel,
  });
});

// 8. Test API Connection (for diagnostics and admin validation)
app.post('/api/diagnostics/test-connection', async (_req: Request, res: Response) => {
  const startTime = Date.now();

  if (!activeNoTrackKey) {
    res.status(400).json({
      success: false,
      provider: 'notrack',
      message: 'مفتاح NoTrack API غير مهيأ.',
    });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const targetUrl = `${activeNoTrackBaseUrl}/models`;
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${activeNoTrackKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({
        success: false,
        provider: 'notrack',
        statusCode: response.status,
        latencyMs,
        message: `خطأ من NoTrack (${response.status}): ${errText.slice(0, 100)}`,
      });
      return;
    }

    const data = await response.json();
    const modelsList = Array.isArray(data?.data)
      ? data.data.map((m: { id: string }) => m.id)
      : [activeNoTrackModel];

    // Verify account credit with a fast completion ping
    let creditStatus = 'ok';
    let topUpUrl: string | undefined = undefined;
    try {
      const pingController = new AbortController();
      const pingTimeout = setTimeout(() => pingController.abort(), 8000);
      const pingRes = await fetch(`${activeNoTrackBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeNoTrackKey}`,
        },
        body: JSON.stringify({
          model: activeNoTrackModel,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
          stream: false,
        }),
        signal: pingController.signal,
      });
      clearTimeout(pingTimeout);

      if (!pingRes.ok) {
        const pingText = await pingRes.text();
        if (pingRes.status === 402) {
          creditStatus = 'no_credit';
          try {
            const pJson = JSON.parse(pingText);
            topUpUrl = pJson.top_up?.url;
          } catch {
            // ignore JSON parse error
          }
        }
      }
    } catch {
      // non-blocking
    }

    let statusMsg = `تم التحقق بنجاح من اتصال NoTrack.ai (${activeNoTrackModel})!`;
    const isSuccess = creditStatus === 'ok';
    if (creditStatus === 'no_credit') {
      statusMsg = `المفتاح صالح ومتصل بنجاح، ولكن رصيد حساب NoTrack.ai منتهٍ (402 No Credit). يرجى شحن الرصيد لتوليد الإجابات.`;
    }

    res.json({
      success: isSuccess,
      provider: 'notrack',
      statusCode: creditStatus === 'no_credit' ? 402 : 200,
      latencyMs,
      endpoint: activeNoTrackBaseUrl,
      activeModel: activeNoTrackModel,
      availableModels: modelsList,
      creditStatus,
      topUpUrl,
      message: statusMsg,
    });
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({
      success: false,
      provider: 'notrack',
      statusCode: 502,
      latencyMs,
      message: `فشل الاتصال بـ NoTrack: ${msg}`,
    });
  }
});

// Helper to construct a human-friendly Arabic error message from NoTrack responses
function parseNoTrackError(status: number, errText: string): string {
  let detail = errText;
  let errorType = '';
  let topUpUrl = '';
  try {
    const json = JSON.parse(errText);
    if (json.error?.message) detail = json.error.message;
    if (json.error?.type) errorType = json.error.type;
    if (json.top_up?.url) topUpUrl = json.top_up.url;
  } catch {
    // raw text
  }

  if (status === 402 || errorType === 'no_credit' || /no credit/i.test(detail)) {
    let msg = 'رصيد حساب NoTrack.ai منتهٍ (رمز الخطأ 402: No credit left).';
    if (topUpUrl) {
      msg += `\nيمكنك شحن الرصيد مباشرة من الرابط التالي:\n${topUpUrl}`;
    } else {
      msg += `\nتفاصيل المزود: ${detail}`;
    }
    msg += '\nكما يمكنك تحديث مفتاح API بمفتاح آخر نشط من خلال أيقونة الإعدادات (لوحة الإدارة).';
    return msg;
  }

  if (status === 401 || errorType === 'key_revoked' || /revoked|invalid api key/i.test(detail)) {
    return `مفتاح NoTrack.ai غير مصرح به أو تم إلغاؤه (رمز الخطأ 401).\nتفاصيل: ${detail}\nيرجى التحقق من المفتاح في إعدادات الإدارة.`;
  }

  if (status === 429) {
    return 'تم تجاوز حد الطلبات في NoTrack.ai (رمز الخطأ 429: Rate Limit).\nيرجى الانتظار دقيقة والمحاولة مجدداً.';
  }

  if (status === 404) {
    return `النموذج المطلوب (${activeNoTrackModel}) غير موجود على خادم NoTrack.ai (رمز الخطأ 404).`;
  }

  return `استجاب مزود NoTrack.ai برمز خطأ (${status}):\n${detail}`;
}

// ==========================================
// 9. CHAT COMPLETION & STREAMING ENDPOINT
// ==========================================
app.post('/api/chat/stream', async (req: Request, res: Response) => {
  const {
    messages,
    context = {},
    attachments = [],
  } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'قائمة الرسائل مطلوبة.' });
    return;
  }

  if (!activeNoTrackKey) {
    res.status(401).json({
      errorCategory: 'AUTHENTICATION_ERROR',
      error: 'مفتاح NoTrack.ai غير مهيأ. يرجى إدخال مفتاح API في الإعدادات.',
    });
    return;
  }

  const systemInstruction = buildSystemPrompt(context);
  const abortController = new AbortController();

  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  const apiMessages: Record<string, unknown>[] = [
    { role: 'system', content: systemInstruction },
  ];

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const isLast = i === messages.length - 1;

    if (isLast && m.role === 'user' && Array.isArray(attachments) && attachments.length > 0) {
      const parts: Record<string, unknown>[] = [{ type: 'text', text: m.content || '' }];
      for (const att of attachments) {
        if (att.dataUrl) {
          parts.push({
            type: 'image_url',
            image_url: { url: att.dataUrl },
          });
        }
      }
      apiMessages.push({ role: m.role, content: parts });
    } else {
      apiMessages.push({ role: m.role, content: m.content });
    }
  }

  try {
    const response = await fetch(`${activeNoTrackBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeNoTrackKey}`,
      },
      body: JSON.stringify({
        model: activeNoTrackModel,
        messages: apiMessages,
        stream: true,
      }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      const friendlyError = parseNoTrackError(response.status, errText);
      res.status(response.status).json({
        error: friendlyError,
        statusCode: response.status,
        provider: 'notrack',
        model: activeNoTrackModel,
        raw: errText,
      });
      return;
    }

    if (!response.body) {
      res.status(502).json({ error: 'لم يُرجع خادم NoTrack.ai أية بيانات متدفقة.' });
      return;
    }

    // Set Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      if (abortController.signal.aborted) break;
      res.write(chunk);
    }
    res.end();
  } catch (err: unknown) {
    if (abortController.signal.aborted) {
      res.end();
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) {
      res.status(500).json({ error: `فشل الاتصال بـ NoTrack.ai: ${message}` });
    } else {
      res.write(`data: [ERROR] ${message}\n\n`);
      res.end();
    }
  }
});

// Non-streaming chat endpoint
app.post('/api/chat', async (req: Request, res: Response) => {
  const { messages, context = {} } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'قائمة الرسائل مطلوبة.' });
    return;
  }

  if (!activeNoTrackKey) {
    res.status(401).json({
      errorCategory: 'AUTHENTICATION_ERROR',
      error: 'مفتاح NoTrack.ai غير مهيأ.',
    });
    return;
  }

  const systemInstruction = buildSystemPrompt(context);
  const apiMessages = [
    { role: 'system', content: systemInstruction },
    ...messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  try {
    const response = await fetch(`${activeNoTrackBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeNoTrackKey}`,
      },
      body: JSON.stringify({
        model: activeNoTrackModel,
        messages: apiMessages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      const friendlyError = parseNoTrackError(response.status, errText);
      res.status(response.status).json({
        error: friendlyError,
        statusCode: response.status,
        provider: 'notrack',
        model: activeNoTrackModel,
        raw: errText,
      });
      return;
    }

    const data = await response.json();
    res.json({
      id: data.id || `msg_${Date.now()}`,
      role: 'assistant',
      content: data.choices?.[0]?.message?.content || '',
      model: data.model || activeNoTrackModel,
      usage: data.usage,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `فشل الاتصال بـ NoTrack.ai: ${message}` });
  }
});

// ==========================================
// STATIC FILES & SSR CATCH-ALL
// ==========================================
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }
    console.log(`Ja3far AI server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
