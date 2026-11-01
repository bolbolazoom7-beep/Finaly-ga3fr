import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ChatState } from '../services/chat-state';
import { NoTrackClient } from '../services/notrack';
import { DiagnosticResult } from '../core/types';

@Component({
  selector: 'app-diagnostics-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    @if (isOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      >
        <!-- Accessible Backdrop Button -->
        <button
          type="button"
          class="fixed inset-0 w-full h-full bg-black/70 backdrop-blur-xs border-0 cursor-default"
          (click)="dismiss.emit()"
          [attr.aria-label]="chatState.language() === 'ar' ? 'إغلاق نافذة التشخيص' : 'Close diagnostics modal'"
        ></button>

        <div
          class="relative w-full max-w-lg border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 transition-colors"
          [class]="chatState.theme() === 'dark'
            ? 'bg-[#181820] border-white/10 text-[#E6E4EC]'
            : 'bg-[#FFFFFF] border-black/10 text-stone-900'"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-3.5 border-b border-white/5 dark:border-white/5 light:border-black/5">
            <div class="flex items-center gap-2">
              <mat-icon class="text-[#8BCFC2]">troubleshoot</mat-icon>
              <h2 class="font-ruqaa text-xl font-bold text-inherit">
                {{ chatState.language() === 'ar' ? 'تشخيص نظام جعفر' : 'Ja3far System Diagnostics' }}
              </h2>
            </div>
            <button
              type="button"
              (click)="dismiss.emit()"
              class="p-1 rounded-lg text-[#A6A2B3] hover:text-white dark:hover:text-white light:hover:text-stone-900 hover:bg-white/5 cursor-pointer"
              [attr.aria-label]="chatState.language() === 'ar' ? 'إغلاق' : 'Close'"
            >
              <mat-icon style="font-size: 20px;">close</mat-icon>
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-xs">
            <!-- Summary Status -->
            <div class="p-3.5 rounded-xl border border-white/5 dark:border-white/5 light:border-black/5 space-y-2.5 bg-white/5 dark:bg-white/5 light:bg-black/5">
              <div class="flex items-center justify-between pb-2 border-b border-white/5 dark:border-white/5 light:border-black/5">
                <span class="text-[#A6A2B3] dark:text-[#A6A2B3] light:text-stone-600">{{ chatState.language() === 'ar' ? 'حالة الواجهة (Frontend)' : 'Frontend App' }}</span>
                <span class="flex items-center gap-1 text-[#8BCFC2] font-semibold">
                  <span class="w-2 h-2 rounded-full bg-[#8BCFC2]"></span>
                  <span>متصل (Angular v21 Zoneless)</span>
                </span>
              </div>

              <div class="flex items-center justify-between pb-2 border-b border-white/5 dark:border-white/5 light:border-black/5">
                <span class="text-[#A6A2B3] dark:text-[#A6A2B3] light:text-stone-600">{{ chatState.language() === 'ar' ? 'الخادم الداخلي (Express Backend)' : 'Backend Server' }}</span>
                <span class="flex items-center gap-1 text-[#8BCFC2] font-semibold">
                  <span class="w-2 h-2 rounded-full bg-[#8BCFC2]"></span>
                  <span>يعمل بـ Node.js SSR</span>
                </span>
              </div>

              <div class="flex items-center justify-between pb-2 border-b border-white/5 dark:border-white/5 light:border-black/5">
                <span class="text-[#A6A2B3] dark:text-[#A6A2B3] light:text-stone-600">{{ chatState.language() === 'ar' ? 'محرك الذكاء الاصطناعي (AI Engine)' : 'AI Engine' }}</span>
                <span class="flex items-center gap-1 font-semibold" [class]="status()?.notrackOk ? 'text-[#8BCFC2]' : 'text-amber-400'">
                  <span class="w-2 h-2 rounded-full" [class]="status()?.notrackOk ? 'bg-[#8BCFC2]' : 'bg-amber-400'"></span>
                  <span>{{ status()?.notrackOk ? 'متصل وجاهز للخدمة' : 'قيد الفحص / غير مؤكد' }}</span>
                </span>
              </div>

              <div class="flex items-center justify-between">
                <span class="text-[#A6A2B3] dark:text-[#A6A2B3] light:text-stone-600">{{ chatState.language() === 'ar' ? 'زمن الاستجابة (Latency)' : 'Latency' }}</span>
                <span class="font-mono text-inherit font-bold">
                  {{ status()?.latencyMs ? status()?.latencyMs + ' ms' : '---' }}
                </span>
              </div>
            </div>

            <!-- Cairo System Time -->
            @if (chatState.cairoTime(); as time) {
              <div class="p-3 rounded-xl border border-white/5 dark:border-white/5 light:border-black/5 bg-[#8BCFC2]/10 text-xs text-[#8BCFC2] space-y-1">
                <span class="font-bold flex items-center gap-1">
                  <mat-icon style="font-size: 15px;">schedule</mat-icon>
                  <span>{{ chatState.language() === 'ar' ? 'توقيت وتاريخ مصر المعتمد:' : 'Egyptian Standard Time:' }}</span>
                </span>
                <p class="font-mono text-[11px] leading-relaxed">{{ time.fullSummary }}</p>
              </div>
            }

            <!-- Sanitized Report Details -->
            <div class="p-3 rounded-xl border border-white/5 dark:border-white/5 light:border-black/5 bg-black/20">
              <div class="flex items-center justify-between mb-2">
                <span class="font-mono text-[11px] text-[#A6A2B3]">تقرير الحالة الفنية المباشر:</span>
                <button
                  type="button"
                  (click)="copyReport()"
                  class="text-[11px] text-[#A994F7] hover:underline cursor-pointer"
                >
                  {{ copied() ? 'تم النسخ!' : 'نسخ التقرير' }}
                </button>
              </div>
              <pre class="font-mono text-[10px] text-[#A6A2B3] overflow-x-auto p-2 bg-black/40 rounded-lg leading-relaxed">{{ diagnosticReport() }}</pre>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between px-5 py-3 border-t border-white/5 dark:border-white/5 light:border-black/5 bg-white/[0.02]">
            <button
              type="button"
              (click)="retest()"
              [disabled]="testing()"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-inherit font-medium text-xs border border-white/10 transition-all cursor-pointer disabled:opacity-50"
            >
              <mat-icon style="font-size: 15px;" [class.animate-spin]="testing()">refresh</mat-icon>
              <span>{{ chatState.language() === 'ar' ? 'إعادة الفحص' : 'Re-check' }}</span>
            </button>

            <button
              type="button"
              (click)="dismiss.emit()"
              class="px-4 py-1.5 rounded-xl bg-[#A994F7] hover:bg-[#BDB0F9] text-[#111116] font-bold text-xs transition-all cursor-pointer"
            >
              {{ chatState.language() === 'ar' ? 'إغلاق' : 'Close' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class DiagnosticsModal implements OnInit {
  chatState = inject(ChatState);
  notrack = inject(NoTrackClient);

  isOpen = input<boolean>(false);
  dismiss = output<void>();

  status = signal<DiagnosticResult | null>(null);
  testing = signal<boolean>(false);
  copied = signal<boolean>(false);

  ngOnInit() {
    this.retest();
  }

  async retest() {
    this.testing.set(true);
    try {
      const res = await this.notrack.testConnection();
      this.status.set(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.status.set({
        frontendOk: true,
        backendOk: true,
        notrackOk: false,
        statusMessage: msg,
        timestamp: Date.now(),
        activeModel: this.chatState.config().model,
        version: '2.0.0-ja3far',
      });
    } finally {
      this.testing.set(false);
    }
  }

  diagnosticReport(): string {
    const s = this.status();
    const cfg = this.chatState.config();
    const time = this.chatState.cairoTime();
    return JSON.stringify(
      {
        product: 'Ja3far AI (جعفر)',
        version: '2.0.0',
        environment: 'Node.js Express SSR',
        clientZoneless: true,
        cairoTime: time?.fullSummary,
        activeModel: cfg.model,
        keyConfigured: !!cfg.apiKeyMasked,
        latencyMs: s?.latencyMs,
        providerOk: s?.notrackOk,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
  }

  async copyReport() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(this.diagnosticReport());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    }
  }
}
