import {
  ChangeDetectionStrategy,
  Component,
  input,
  signal,
  inject,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ChatMessage } from '../core/types';
import { parseMarkdown } from '../core/markdown-parser';
import { ChatState } from '../services/chat-state';

@Component({
  selector: 'app-message-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    <div
      class="group w-full max-w-4xl mx-auto px-3 sm:px-4 py-2.5 flex gap-2.5 sm:gap-3 transition-colors"
      [class]="message().role === 'user' ? 'justify-end' : 'justify-start'"
    >
      <!-- Assistant Avatar -->
      @if (message().role === 'assistant') {
        <div
          class="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-[#A994F7] to-[#8BCFC2] p-[1px] flex items-center justify-center shadow-sm"
        >
          <div class="w-full h-full bg-[#181820] dark:bg-[#181820] light:bg-[#FFFFFF] rounded-[11px] flex items-center justify-center">
            <span class="font-ruqaa text-[#A994F7] dark:text-[#A994F7] light:text-[#7C5CE6] font-bold text-sm select-none">ج</span>
          </div>
        </div>
      }

      <div
        class="flex flex-col gap-1.5 max-w-[88%] sm:max-w-[82%]"
        [class]="message().role === 'user' ? 'items-end' : 'items-start'"
      >
        <!-- User Bubble or Assistant Content -->
        @if (message().role === 'user') {
          <!-- Display User Attachments if any -->
          @if (message().attachments && message().attachments!.length > 0) {
            <div class="flex flex-wrap gap-2 mb-1 justify-end">
              @for (att of message().attachments!; track att.id) {
                @if (att.type === 'image') {
                  <div class="relative rounded-xl overflow-hidden border border-white/20 dark:border-white/20 light:border-black/10 shadow-sm max-w-[220px]">
                    <img [src]="att.dataUrl" [alt]="att.name" class="w-full h-auto max-h-48 object-cover" referrerpolicy="no-referrer" />
                    <span class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] bg-black/70 text-white truncate max-w-[150px]">
                      {{ att.name }}
                    </span>
                  </div>
                } @else {
                  <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 dark:bg-white/10 light:bg-black/5 border border-white/10 dark:border-white/10 light:border-black/10 text-xs">
                    <mat-icon style="font-size: 16px; width: 16px; height: 16px;" class="text-[#8BCFC2]">description</mat-icon>
                    <span class="truncate max-w-[150px] font-mono">{{ att.name }}</span>
                  </div>
                }
              }
            </div>
          }

          @if (isEditing()) {
            <div class="w-full min-w-[280px] flex flex-col gap-2 p-3 bg-[#181820] dark:bg-[#181820] light:bg-white rounded-2xl border border-[#A994F7]/40 shadow-sm">
              <textarea
                [formControl]="editControl"
                rows="2"
                class="w-full bg-transparent text-sm text-[#E6E4EC] dark:text-[#E6E4EC] light:text-stone-900 focus:outline-none resize-none leading-relaxed"
                [attr.aria-label]="chatState.language() === 'ar' ? 'تعديل الرسالة' : 'Edit message'"
              ></textarea>
              <div class="flex items-center justify-end gap-2 text-xs">
                <button
                  type="button"
                  (click)="cancelEdit()"
                  class="px-2.5 py-1 rounded-lg text-[#A6A2B3] hover:bg-white/5 transition-colors cursor-pointer"
                >
                  {{ chatState.language() === 'ar' ? 'إلغاء' : 'Cancel' }}
                </button>
                <button
                  type="button"
                  (click)="saveEdit()"
                  class="px-3 py-1 rounded-lg bg-[#A994F7] text-[#111116] font-medium hover:bg-[#BDB0F9] transition-colors cursor-pointer"
                >
                  {{ chatState.language() === 'ar' ? 'حفظ وإرسال' : 'Save & Send' }}
                </button>
              </div>
            </div>
          } @else {
            <div
              class="px-4 py-2.5 rounded-2xl text-sm md:text-base leading-relaxed break-words shadow-xs border transition-colors select-none"
              [class]="chatState.theme() === 'dark' 
                ? 'bg-[#1E1B2E] border-[#A994F7]/30 text-[#E6E4EC]' 
                : 'bg-[#7C5CE6] border-[#7C5CE6] text-white'"
            >
              {{ message().content }}
            </div>
          }
        } @else {
          <!-- Assistant Message Body -->
          <div
            class="px-4 py-3.5 rounded-2xl border shadow-sm w-full overflow-hidden transition-colors"
            [class]="chatState.theme() === 'dark'
              ? 'bg-[#181820] border-white/5 text-[#E6E4EC]'
              : 'bg-[#FFFFFF] border-black/10 text-stone-900'"
          >
            @if (message().status === 'error') {
              <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 dark:text-rose-300 light:text-rose-700 text-xs md:text-sm flex flex-col gap-1.5">
                <div class="flex items-center gap-1.5 font-medium">
                  <mat-icon style="font-size: 16px; width: 16px; height: 16px;">error_outline</mat-icon>
                  <span>{{ getCategoryLabel(message().errorCategory) }}</span>
                </div>
                <p class="leading-relaxed opacity-90 whitespace-pre-line select-text font-sans">{{ message().errorMessage }}</p>
                <div class="mt-1">
                  <button
                    type="button"
                    (click)="retry()"
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 dark:text-rose-100 light:text-rose-900 text-xs transition-colors cursor-pointer"
                  >
                    <mat-icon style="font-size: 14px; width: 14px; height: 14px;">replay</mat-icon>
                    <span>{{ chatState.language() === 'ar' ? 'إعادة المحاولة' : 'Retry' }}</span>
                  </button>
                </div>
              </div>
            } @else {
              @if (message().content.length === 0 && message().status === 'streaming') {
                <div class="flex items-center gap-1.5 py-1 text-[#A994F7]">
                  <span class="w-2 h-2 rounded-full bg-[#A994F7] animate-pulse"></span>
                  <span class="w-2 h-2 rounded-full bg-[#8BCFC2] animate-pulse delay-150"></span>
                  <span class="w-2 h-2 rounded-full bg-[#A994F7] animate-pulse delay-300"></span>
                  <span class="text-xs text-[#A6A2B3] dark:text-[#A6A2B3] light:text-stone-500 font-sans mr-2">
                    {{ chatState.language() === 'ar' ? 'جعفر يكتب الآن...' : 'Ja3far is responding...' }}
                  </span>
                </div>
              } @else {
                <div
                  class="markdown-content prose-invert max-w-none break-words"
                  [innerHTML]="renderedHtml()"
                  (click)="handleContentClick($event)"
                  (keydown.enter)="handleContentClick($event)"
                  tabindex="0"
                  role="region"
                  [attr.aria-label]="chatState.language() === 'ar' ? 'محتوى الرسالة' : 'Message content'"
                ></div>

                <!-- Verified Live Sources Citation Box -->
                @if (message().sources && message().sources!.length > 0) {
                  <div class="mt-3 pt-2.5 border-t border-white/5 dark:border-white/5 light:border-black/5">
                    <div class="flex items-center gap-1 text-[11px] font-semibold text-[#8BCFC2] dark:text-[#8BCFC2] light:text-teal-700 mb-1.5">
                      <mat-icon style="font-size: 14px; width: 14px; height: 14px;">verified</mat-icon>
                      <span>{{ chatState.language() === 'ar' ? 'المصادر والتحقق المباشر من الإنترنت:' : 'Verified Sources:' }}</span>
                    </div>
                    <div class="flex flex-wrap gap-1.5">
                      @for (src of message().sources!; track src.url) {
                        <a
                          [href]="src.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 dark:bg-white/5 light:bg-black/5 hover:bg-[#8BCFC2]/15 border border-white/5 hover:border-[#8BCFC2]/30 text-[11px] text-[#A6A2B3] dark:text-[#A6A2B3] light:text-stone-700 hover:text-white transition-all max-w-xs truncate"
                          [attr.title]="src.title"
                        >
                          <mat-icon style="font-size: 12px; width: 12px; height: 12px;" class="text-[#8BCFC2]">link</mat-icon>
                          <span class="truncate">{{ src.title || src.url }}</span>
                        </a>
                      }
                    </div>
                  </div>
                }
              }
            }
          </div>
        }

        <!-- Actions Row -->
        <div
          class="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity text-xs text-[#A6A2B3] dark:text-[#A6A2B3] light:text-stone-600 px-1"
        >
          @if (message().role === 'user') {
            @if (!isEditing()) {
              <button
                type="button"
                (click)="startEdit()"
                class="p-1 rounded hover:text-white dark:hover:text-white light:hover:text-stone-900 hover:bg-white/5 transition-colors cursor-pointer"
                [attr.title]="chatState.language() === 'ar' ? 'تعديل' : 'Edit'"
                [attr.aria-label]="chatState.language() === 'ar' ? 'تعديل الرسالة' : 'Edit message'"
              >
                <mat-icon style="font-size: 14px; width: 14px; height: 14px;">edit</mat-icon>
              </button>
            }
          } @else {
            <!-- Copy Button -->
            <button
              type="button"
              (click)="copyMessage()"
              class="inline-flex items-center gap-1 p-1 rounded hover:text-white dark:hover:text-white light:hover:text-stone-900 hover:bg-white/5 transition-colors cursor-pointer"
              [attr.title]="chatState.language() === 'ar' ? 'نسخ الإجابة' : 'Copy answer'"
              [attr.aria-label]="chatState.language() === 'ar' ? 'نسخ الإجابة' : 'Copy answer'"
            >
              <mat-icon style="font-size: 14px; width: 14px; height: 14px;">
                {{ isCopied() ? 'check' : 'content_copy' }}
              </mat-icon>
              @if (isCopied()) {
                <span class="text-[10px] text-[#8BCFC2]">
                  {{ chatState.language() === 'ar' ? 'تم النسخ' : 'Copied' }}
                </span>
              }
            </button>

            @if (message().status === 'complete') {
              <button
                type="button"
                (click)="regenerate()"
                class="inline-flex items-center gap-1 p-1 rounded hover:text-white dark:hover:text-white light:hover:text-stone-900 hover:bg-white/5 transition-colors cursor-pointer"
                [attr.title]="chatState.language() === 'ar' ? 'إعادة التوليد' : 'Regenerate'"
                [attr.aria-label]="chatState.language() === 'ar' ? 'إعادة التوليد' : 'Regenerate'"
              >
                <mat-icon style="font-size: 14px; width: 14px; height: 14px;">refresh</mat-icon>
              </button>
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class MessageItem {
  chatState = inject(ChatState);
  message = input.required<ChatMessage>();

  isEditing = signal<boolean>(false);
  isCopied = signal<boolean>(false);
  editControl = new FormControl<string>('', { nonNullable: true });

  renderedHtml(): string {
    return parseMarkdown(this.message().content);
  }

  startEdit() {
    this.editControl.setValue(this.message().content);
    this.isEditing.set(true);
  }

  cancelEdit() {
    this.isEditing.set(false);
  }

  saveEdit() {
    const val = this.editControl.value.trim();
    if (!val) return;
    this.isEditing.set(false);
    this.chatState.editAndResend(this.message().id, val);
  }

  retry() {
    this.chatState.regenerateResponse(this.message().id);
  }

  regenerate() {
    this.chatState.regenerateResponse(this.message().id);
  }

  async copyMessage() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(this.message().content);
      this.isCopied.set(true);
      setTimeout(() => this.isCopied.set(false), 2000);
    }
  }

  handleContentClick(event: Event) {
    const target = (event.target as HTMLElement).closest('.copy-code-btn') as HTMLElement;
    if (target) {
      const code = target.getAttribute('data-code');
      if (code && typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(decodeURIComponent(code));
        const span = target.querySelector('span:last-child');
        if (span) {
          const prev = span.textContent;
          span.textContent = this.chatState.language() === 'ar' ? 'تم!' : 'Done!';
          setTimeout(() => {
            span.textContent = prev;
          }, 1500);
        }
      }
    }
  }

  getCategoryLabel(category?: string): string {
    const isAr = this.chatState.language() === 'ar';
    switch (category) {
      case 'QUOTA_OR_BILLING_ERROR':
        return isAr ? 'رصيد NoTrack.ai منتهٍ (402)' : 'NoTrack Insufficient Credits (402)';
      case 'AUTHENTICATION_ERROR':
        return isAr ? 'مفتاح NoTrack غير صالح (401)' : 'Invalid NoTrack Key (401)';
      case 'RATE_LIMIT':
        return isAr ? 'تجاوز حد الاستخدام (429)' : 'Rate Limit Exceeded (429)';
      case 'CONFIGURATION_ERROR':
        return isAr ? 'خطأ في إعدادات النموذج (404)' : 'Configuration Error (404)';
      case 'NETWORK_ERROR':
      case 'TIMEOUT_ERROR':
        return isAr ? 'انقطاع الاتصال بالشبكة' : 'Network / Timeout Error';
      case 'PROVIDER_ERROR':
        return isAr ? 'خطأ من خادم المزود' : 'Provider Error';
      default:
        return isAr ? 'تنبيه في الاتصال' : 'Connection Alert';
    }
  }
}
