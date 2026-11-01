import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Attachment, DiagnosticResult, NoTrackConfig, SourceCitation } from '../core/types';

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onSources?: (sources: SourceCitation[]) => void;
  onComplete: () => void;
  onError: (error: string, statusCode?: number) => void;
}

interface ServerConfigResponse {
  provider?: 'notrack';
  baseUrl?: string;
  model?: string;
  apiKeyMasked?: string;
  isConfigured?: boolean;
}

interface ServerDiagnosticsResponse {
  success?: boolean;
  provider?: string;
  message?: string;
  activeModel?: string;
  latencyMs?: number;
  availableModels?: string[];
  reply?: string;
}

export interface CairoTimeResponse {
  timestamp: number;
  timezone: string;
  cairoDateArabic: string;
  cairoTimeArabic: string;
  cairoDateEnglish: string;
  cairoTimeEnglish: string;
  fullSummary: string;
}

@Injectable({
  providedIn: 'root',
})
export class NoTrackClient {
  private http = inject(HttpClient);

  async getConfig(): Promise<NoTrackConfig> {
    try {
      const res = await firstValueFrom(
        this.http.get<ServerConfigResponse>('/api/config')
      );
      return {
        provider: 'notrack',
        baseUrl: res.baseUrl || 'https://api.notrack.ai/v1',
        model: res.model || 'notrack-uncensored',
        apiKeyMasked: res.apiKeyMasked || '',
        isCustomConfigured: !!res.apiKeyMasked,
        status: res.isConfigured ? 'connected' : 'not_configured',
      };
    } catch {
      return {
        provider: 'notrack',
        baseUrl: 'https://api.notrack.ai/v1',
        model: 'notrack-uncensored',
        apiKeyMasked: '',
        isCustomConfigured: false,
        status: 'error',
      };
    }
  }

  async getCairoTime(): Promise<CairoTimeResponse | null> {
    try {
      return await firstValueFrom(
        this.http.get<CairoTimeResponse>('/api/time')
      );
    } catch {
      return null;
    }
  }

  // Admin APIs
  async verifyAdmin(code: string): Promise<{ success: boolean; error?: string; locked?: boolean; waitSeconds?: number }> {
    try {
      return await firstValueFrom(
        this.http.post<{ success: boolean; error?: string; locked?: boolean; waitSeconds?: number }>(
          '/api/admin/verify',
          { code }
        )
      );
    } catch (err: unknown) {
      const e = err as { error?: { error?: string; locked?: boolean; waitSeconds?: number } };
      return {
        success: false,
        error: e.error?.error || 'رمز الدخول غير صحيح أو حدث خطأ بالشبكة.',
        locked: !!e.error?.locked,
        waitSeconds: e.error?.waitSeconds,
      };
    }
  }

  async changeAdminCode(currentCode: string, newCode: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      return await firstValueFrom(
        this.http.post<{ success: boolean; message?: string }>(
          '/api/admin/change-code',
          { currentCode, newCode }
        )
      );
    } catch (err: unknown) {
      const e = err as { error?: { error?: string } };
      return {
        success: false,
        error: e.error?.error || 'فشل تغيير رمز الدخول الإداري.',
      };
    }
  }

  async getAdminConfig(adminCode: string): Promise<Record<string, unknown>> {
    return firstValueFrom(
      this.http.get<Record<string, unknown>>('/api/admin/config', {
        headers: { 'x-admin-code': adminCode },
      })
    );
  }

  async updateAdminKeys(adminCode: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return firstValueFrom(
      this.http.post<Record<string, unknown>>('/api/admin/update-keys', payload, {
        headers: { 'x-admin-code': adminCode },
      })
    );
  }

  async testConnection(provider = 'notrack'): Promise<DiagnosticResult> {
    const startTime = Date.now();
    try {
      const res = await firstValueFrom(
        this.http.post<ServerDiagnosticsResponse>(
          '/api/diagnostics/test-connection',
          { provider }
        )
      );
      return {
        frontendOk: true,
        backendOk: true,
        notrackOk: res.success ?? true,
        latencyMs: res.latencyMs || Date.now() - startTime,
        statusMessage: res.message || 'تم التحقق من الاتصال بنجاح',
        activeModel: res.activeModel || 'notrack-uncensored',
        timestamp: Date.now(),
        version: '2.0.0-ja3far',
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const errorObj = err as {
        status?: number;
        error?: { message?: string; errorCategory?: import('../core/types').ErrorCategory };
        message?: string;
      };
      const errorMsg =
        errorObj.error?.message || errorObj.message || 'فشل الاتصال بمزود NoTrack.ai';
      return {
        frontendOk: true,
        backendOk: errorObj.status !== 0 && errorObj.status !== 504,
        notrackOk: false,
        latencyMs,
        statusMessage: errorMsg,
        category: errorObj.error?.errorCategory || 'NETWORK_ERROR',
        activeModel: 'notrack-uncensored',
        timestamp: Date.now(),
        version: '2.0.0-ja3far',
      };
    }
  }

  async streamChat(
    messages: { role: string; content: string }[],
    options: {
      context?: Record<string, unknown>;
      attachments?: Attachment[];
      enableSearch?: boolean;
    },
    callbacks: StreamCallbacks,
    abortSignal?: AbortSignal
  ): Promise<void> {
    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          context: options.context || {},
          attachments: options.attachments || [],
          enableSearch: options.enableSearch ?? true,
        }),
        signal: abortSignal,
      });

      if (!response.ok) {
        let errDetail = 'خطأ في استجابة الخادم';
        let statusCode = response.status;
        try {
          const json = await response.json();
          errDetail = json.error || json.message || errDetail;
          if (json.statusCode) statusCode = json.statusCode;
        } catch {
          // ignore
        }
        callbacks.onError(errDetail, statusCode);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        callbacks.onError('تعذر قراءة تدفق البيانات');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const payload = trimmed.slice(6).trim();

          if (payload === '[DONE]') {
            callbacks.onComplete();
            return;
          }

          if (payload.startsWith('[ERROR]')) {
            callbacks.onError(payload.slice(7).trim());
            return;
          }

          try {
            const parsed = JSON.parse(payload);
            // Check for grounding sources
            if (Array.isArray(parsed.sources) && callbacks.onSources) {
              callbacks.onSources(parsed.sources);
            }
            // Check for streamed token
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              callbacks.onToken(content);
            }
          } catch {
            // Ignore partial SSE tokens
          }
        }
      }

      callbacks.onComplete();
    } catch (err: unknown) {
      if (abortSignal?.aborted) {
        callbacks.onComplete();
        return;
      }
      const message = err instanceof Error ? err.message : 'انقطع الاتصال بالخادم';
      callbacks.onError(message);
    }
  }
}
