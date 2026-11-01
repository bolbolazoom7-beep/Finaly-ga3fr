import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ChatState } from '../services/chat-state';

@Component({
  selector: 'app-history-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    <!-- Backdrop for all viewports when drawer is open -->
    @if (isOpen()) {
      <button
        type="button"
        class="fixed inset-0 w-full h-full bg-black/60 backdrop-blur-xs z-40 border-0 cursor-default"
        (click)="dismiss.emit()"
        [attr.aria-label]="chatState.language() === 'ar' ? 'إغلاق القائمة الجانبية' : 'Close side menu'"
      ></button>
    }

    <!-- Drawer container -->
    <aside
      class="fixed top-0 bottom-0 z-50 flex flex-col w-72 sm:w-80 shadow-2xl transition-transform duration-300 ease-in-out border"
      [class]="chatState.theme() === 'dark'
        ? 'bg-[#16161D] border-white/10 text-[#E6E4EC]'
        : 'bg-[#FAF8F5] border-black/10 text-stone-900'"
      [class]="
        chatState.language() === 'ar'
          ? (isOpen() ? 'right-0 translate-x-0' : 'right-0 translate-x-full')
          : (isOpen() ? 'left-0 translate-x-0' : 'left-0 -translate-x-full')
      "
    >
      <!-- Drawer Header with Tab Navigation -->
      <div class="flex items-center justify-between p-4 border-b border-white/5 dark:border-white/5 light:border-black/5">
        <div class="flex items-center gap-1.5">
          <div class="w-6 h-6 rounded-md bg-[#A994F7]/20 flex items-center justify-center text-[#A994F7]">
            <mat-icon style="font-size: 15px;">forum</mat-icon>
          </div>
          <span class="font-ruqaa text-lg text-[#A994F7] font-bold">
            {{ chatState.language() === 'ar' ? 'محادثات جعفر' : 'Ja3far Chats' }}
          </span>
        </div>
        <button
          type="button"
          (click)="dismiss.emit()"
          class="p-1.5 rounded-lg text-[#A6A2B3] hover:text-white dark:hover:text-white light:hover:text-stone-900 hover:bg-white/5 cursor-pointer"
          [attr.aria-label]="chatState.language() === 'ar' ? 'إغلاق' : 'Close'"
        >
          <mat-icon style="font-size: 18px;">close</mat-icon>
        </button>
      </div>

      <!-- Navigation Tabs: Active Chats vs Hidden Chats -->
      <div class="px-3 pt-3">
        <div class="grid grid-cols-2 p-1 rounded-xl bg-white/5 dark:bg-white/5 light:bg-black/5 text-xs font-medium">
          <button
            type="button"
            (click)="activeTab.set('active')"
            class="py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
            [class]="activeTab() === 'active'
              ? 'bg-[#A994F7] text-[#111116] shadow-xs'
              : 'text-[#A6A2B3] dark:text-[#A6A2B3] light:text-stone-600 hover:text-white dark:hover:text-white light:hover:text-stone-900'"
          >
            <mat-icon style="font-size: 14px;">chat_bubble</mat-icon>
            <span>{{ chatState.language() === 'ar' ? 'المحادثات' : 'Chats' }}</span>
            <span class="text-[10px] opacity-75">({{ chatState.visibleConversations().length }})</span>
          </button>

          <button
            type="button"
            (click)="activeTab.set('hidden')"
            class="py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
            [class]="activeTab() === 'hidden'
              ? 'bg-[#A994F7] text-[#111116] shadow-xs'
              : 'text-[#A6A2B3] dark:text-[#A6A2B3] light:text-stone-600 hover:text-white dark:hover:text-white light:hover:text-stone-900'"
          >
            <mat-icon style="font-size: 14px;">visibility_off</mat-icon>
            <span>{{ chatState.language() === 'ar' ? 'المخفية' : 'Hidden' }}</span>
            <span class="text-[10px] opacity-75">({{ chatState.hiddenConversations().length }})</span>
          </button>
        </div>
      </div>

      @if (activeTab() === 'active') {
        <!-- New Chat Button -->
        <div class="p-3">
          <button
            type="button"
            (click)="onNewChat()"
            class="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#A994F7]/20 to-[#8BCFC2]/20 hover:from-[#A994F7]/30 hover:to-[#8BCFC2]/30 text-inherit font-medium text-xs border border-[#A994F7]/30 transition-all cursor-pointer shadow-sm active:scale-[0.98]"
          >
            <mat-icon style="font-size: 16px;">add</mat-icon>
            <span>{{ chatState.language() === 'ar' ? 'محادثة جديدة' : 'New Conversation' }}</span>
          </button>
        </div>

        <!-- Search Input with Clear Button -->
        <div class="px-3 pb-2 space-y-1.5">
          <div class="relative flex items-center">
            <input
              [formControl]="searchControl"
              (input)="onSearchChange()"
              type="text"
              [placeholder]="chatState.language() === 'ar' ? 'بحث في المحادثات...' : 'Search conversations...'"
              class="w-full bg-[#1B1B23] dark:bg-[#1B1B23] light:bg-white border border-white/5 dark:border-white/5 light:border-black/10 rounded-xl py-1.5 px-8 text-xs focus:outline-none focus:border-[#A994F7]/50"
              [attr.aria-label]="chatState.language() === 'ar' ? 'بحث في المحادثات' : 'Search conversations'"
            />
            <mat-icon
              class="absolute text-[#A6A2B3] pointer-events-none"
              [class]="chatState.language() === 'ar' ? 'right-2.5' : 'left-2.5'"
              style="font-size: 15px;"
            >
              search
            </mat-icon>

            @if (searchControl.value.trim()) {
              <button
                type="button"
                (click)="clearSearch()"
                class="absolute p-0.5 rounded-md text-[#A6A2B3] hover:text-white dark:hover:text-white light:hover:text-stone-900 hover:bg-white/10 cursor-pointer"
                [class]="chatState.language() === 'ar' ? 'left-2' : 'right-2'"
                [attr.title]="chatState.language() === 'ar' ? 'مسح البحث' : 'Clear search'"
                [attr.aria-label]="chatState.language() === 'ar' ? 'مسح البحث' : 'Clear search'"
              >
                <mat-icon style="font-size: 15px; width: 15px; height: 15px;">close</mat-icon>
              </button>
            }
          </div>

          @if (searchControl.value.trim()) {
            <div class="flex items-center justify-between px-1 text-[11px] text-[#A6A2B3]">
              <span class="truncate">
                {{ chatState.language() === 'ar' ? 'تصفية:' : 'Filter:' }}
                <span class="text-[#A994F7] font-semibold">"{{ searchControl.value.trim() }}"</span>
              </span>
              <button
                type="button"
                (click)="clearSearch()"
                class="text-[#8BCFC2] hover:underline cursor-pointer shrink-0 font-medium"
              >
                {{ chatState.language() === 'ar' ? 'مسح البحث' : 'Clear' }}
              </button>
            </div>
          }
        </div>

        <!-- Conversations List -->
        <div class="flex-1 overflow-y-auto px-2 py-1 space-y-1">
          @if (chatState.visibleConversations().length === 0) {
            <div class="py-10 text-center text-xs text-[#A6A2B3] space-y-2">
              @if (searchControl.value.trim()) {
                <p>{{ chatState.language() === 'ar' ? 'لا توجد محادثات تطابق هذا البحث' : 'No chats match this search' }}</p>
                <button
                  type="button"
                  (click)="clearSearch()"
                  class="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[#8BCFC2] font-medium text-[11px] border border-white/5 cursor-pointer"
                >
                  <mat-icon style="font-size: 13px;">clear_all</mat-icon>
                  <span>{{ chatState.language() === 'ar' ? 'مسح البحث وعرض الكل' : 'Clear search & show all' }}</span>
                </button>
              } @else {
                <p>{{ chatState.language() === 'ar' ? 'لا توجد محادثات سابقة' : 'No previous chats' }}</p>
              }
            </div>
          } @else {
            @for (conv of chatState.visibleConversations(); track conv.id) {
              <div
                class="group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all border"
                [class]="
                  conv.id === chatState.currentConversationId()
                    ? (chatState.theme() === 'dark' ? 'bg-[#1B1B23] text-white border-[#A994F7]/40 shadow-xs' : 'bg-white text-stone-900 border-[#7C5CE6] shadow-sm font-semibold')
                    : 'text-[#A6A2B3] dark:text-[#A6A2B3] light:text-stone-700 hover:bg-white/5 dark:hover:bg-white/5 light:hover:bg-black/5 border-transparent'
                "
              >
                <button
                  type="button"
                  class="flex items-center gap-2 overflow-hidden flex-1 text-right bg-transparent border-0 cursor-pointer p-0 text-inherit focus:outline-none"
                  (click)="selectChat(conv.id)"
                >
                  <mat-icon style="font-size: 15px; width: 15px; height: 15px;" class="shrink-0 text-[#A994F7]/80">
                    chat_bubble_outline
                  </mat-icon>
                  <span class="truncate">{{ conv.title }}</span>
                </button>

                <!-- Actions: Hide & Delete -->
                <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    (click)="hideChat($event, conv.id)"
                    class="p-1 rounded text-[#A6A2B3] hover:text-[#A994F7] hover:bg-white/10 transition-colors"
                    [attr.title]="chatState.language() === 'ar' ? 'إخفاء هذه المحادثة' : 'Hide this chat'"
                  >
                    <mat-icon style="font-size: 14px; width: 14px; height: 14px;">visibility_off</mat-icon>
                  </button>
                  <button
                    type="button"
                    (click)="deleteChat($event, conv.id)"
                    class="p-1 rounded text-[#A6A2B3] hover:text-rose-400 hover:bg-white/10 transition-colors"
                    [attr.title]="chatState.language() === 'ar' ? 'حذف' : 'Delete'"
                  >
                    <mat-icon style="font-size: 14px; width: 14px; height: 14px;">delete_outline</mat-icon>
                  </button>
                </div>
              </div>
            }
          }
        </div>
      } @else {
        <!-- HIDDEN CHATS TAB -->
        <div class="flex-1 overflow-y-auto p-3 flex flex-col justify-between">
          @if (!chatState.hiddenChatsUnlocked()) {
            <!-- PIN Lock Screen -->
            <div class="py-8 flex flex-col items-center text-center space-y-4">
              <div class="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                <mat-icon style="font-size: 24px;">lock</mat-icon>
              </div>
              <div>
                <h4 class="font-bold text-sm text-inherit">
                  {{ chatState.language() === 'ar' ? 'المحادثات المخفية محمية' : 'Hidden Chats are Locked' }}
                </h4>
                <p class="text-[11px] text-[#A6A2B3] mt-1 max-w-[220px]">
                  {{ chatState.language() === 'ar' ? 'أدخل رمز القفل لفتح المحادثات المخفية (الرمز الافتراضي: 1234)' : 'Enter PIN to unlock hidden chats (Default: 1234)' }}
                </p>
              </div>

              <div class="w-full max-w-[200px] space-y-2">
                <input
                  [formControl]="pinInputControl"
                  type="password"
                  maxlength="8"
                  placeholder="رمز القفل (PIN)"
                  class="w-full text-center tracking-widest bg-[#1B1B23] dark:bg-[#1B1B23] light:bg-white border border-white/10 dark:border-white/10 light:border-black/10 rounded-xl py-2 px-3 text-sm font-mono focus:outline-none focus:border-[#A994F7]"
                  (keydown.enter)="unlockHidden()"
                />
                @if (pinError()) {
                  <p class="text-[11px] text-rose-400 font-medium">{{ pinError() }}</p>
                }
                <button
                  type="button"
                  (click)="unlockHidden()"
                  class="w-full py-2 rounded-xl bg-[#A994F7] text-[#111116] font-medium text-xs shadow-xs hover:bg-[#BDB0F9] transition-all cursor-pointer"
                >
                  {{ chatState.language() === 'ar' ? 'فتح المحادثات المخفية' : 'Unlock' }}
                </button>
              </div>
            </div>
          } @else {
            <!-- Unlocked Hidden Chats List -->
            <div class="space-y-3">
              <div class="flex items-center justify-between pb-2 border-b border-white/5 dark:border-white/5 light:border-black/5">
                <span class="text-xs font-semibold text-amber-400 flex items-center gap-1">
                  <mat-icon style="font-size: 14px;">lock_open</mat-icon>
                  <span>{{ chatState.language() === 'ar' ? 'المحادثات المخفية مفتوحة' : 'Unlocked' }}</span>
                </span>
                <button
                  type="button"
                  (click)="chatState.lockHiddenChats()"
                  class="px-2 py-1 rounded-lg text-[11px] bg-rose-500/15 text-rose-300 dark:text-rose-300 light:text-rose-700 hover:bg-rose-500/25 transition-colors cursor-pointer"
                >
                  {{ chatState.language() === 'ar' ? 'قفل الآن' : 'Lock Now' }}
                </button>
              </div>

              @if (chatState.hiddenConversations().length === 0) {
                <div class="py-10 text-center text-xs text-[#A6A2B3]">
                  {{ chatState.language() === 'ar' ? 'لا توجد محادثات مخفية حالياً' : 'No hidden chats' }}
                </div>
              } @else {
                <div class="space-y-1">
                  @for (conv of chatState.hiddenConversations(); track conv.id) {
                    <div
                      class="group flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all border"
                      [class]="
                        conv.id === chatState.currentConversationId()
                          ? 'bg-[#1B1B23] text-white border-amber-400/40 shadow-xs'
                          : 'text-[#A6A2B3] hover:bg-white/5 border-transparent'
                      "
                    >
                      <button
                        type="button"
                        class="flex items-center gap-2 overflow-hidden flex-1 text-right bg-transparent border-0 cursor-pointer p-0 text-inherit focus:outline-none"
                        (click)="selectChat(conv.id)"
                      >
                        <mat-icon style="font-size: 15px; width: 15px; height: 15px;" class="shrink-0 text-amber-400">
                          visibility_off
                        </mat-icon>
                        <span class="truncate">{{ conv.title }}</span>
                      </button>

                      <div class="flex items-center gap-1">
                        <button
                          type="button"
                          (click)="unhideChat($event, conv.id)"
                          class="p-1 rounded text-[#A6A2B3] hover:text-[#8BCFC2] hover:bg-white/10 transition-colors"
                          [attr.title]="chatState.language() === 'ar' ? 'استعادة للمحادثات العادية' : 'Unhide'"
                        >
                          <mat-icon style="font-size: 14px; width: 14px; height: 14px;">visibility</mat-icon>
                        </button>
                        <button
                          type="button"
                          (click)="deleteChat($event, conv.id)"
                          class="p-1 rounded text-[#A6A2B3] hover:text-rose-400 hover:bg-white/10 transition-colors"
                          [attr.title]="chatState.language() === 'ar' ? 'حذف' : 'Delete'"
                        >
                          <mat-icon style="font-size: 14px; width: 14px; height: 14px;">delete_outline</mat-icon>
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }

          <!-- Privacy Clarification Note -->
          <div class="p-2.5 rounded-xl bg-white/5 dark:bg-white/5 light:bg-black/5 text-[10px] text-[#A6A2B3] leading-relaxed">
            <span class="font-medium text-[#A994F7]">ℹ️ ملاحظة:</span>
            <span>إخفاء المحادثات يحجبها برمز سري على جهازك ولا يظهرها للآخرين. لا يدعي النظام تشفيراً عسكرياً، بل خصوصية محلية آمنة.</span>
          </div>
        </div>
      }

      <!-- Drawer Footer -->
      <div class="p-3 border-t border-white/5 dark:border-white/5 light:border-black/5 flex flex-col gap-2 text-xs text-[#A6A2B3]">
        <div class="flex items-center justify-between">
          <button
            type="button"
            (click)="exportData()"
            class="inline-flex items-center gap-1 hover:text-white dark:hover:text-white light:hover:text-stone-900 transition-colors cursor-pointer"
            [attr.title]="chatState.language() === 'ar' ? 'تصدير نسخة احتياطية' : 'Export backup'"
          >
            <mat-icon style="font-size: 15px;">download</mat-icon>
            <span>{{ chatState.language() === 'ar' ? 'تصدير' : 'Export' }}</span>
          </button>

          <button
            type="button"
            (click)="clearAll()"
            class="inline-flex items-center gap-1 text-rose-400/80 hover:text-rose-400 transition-colors cursor-pointer"
            [attr.title]="chatState.language() === 'ar' ? 'مسح كل المحادثات' : 'Clear all'"
          >
            <mat-icon style="font-size: 15px;">delete_sweep</mat-icon>
            <span>{{ chatState.language() === 'ar' ? 'مسح الكل' : 'Clear All' }}</span>
          </button>
        </div>

        <!-- Developer Credit with Photo & Bio -->
        <div class="pt-2 border-t border-white/5 dark:border-white/5 light:border-black/5 flex items-center justify-between text-[11px] text-[#A6A2B3] dark:text-[#A6A2B3] light:text-stone-500 font-sans">
          <div class="flex items-center gap-1.5">
            <img
              src="/assets/aistudio/ChatGPT_Image_27________2026__05_45_12___a5e00d16.png"
              alt="Belal Ahmed"
              class="w-5 h-5 rounded-full object-cover object-top border border-[#A994F7]"
              referrerpolicy="no-referrer"
            />
            <span>Developed by Belal Ahmed</span>
          </div>
          <span class="text-[10px] text-[#A994F7] font-semibold">جعفر v2.0</span>
        </div>
      </div>
    </aside>
  `,
})
export class HistoryDrawer {
  chatState = inject(ChatState);
  isOpen = input<boolean>(false);
  dismiss = output<void>();

  activeTab = signal<'active' | 'hidden'>('active');
  searchControl = new FormControl<string>('', { nonNullable: true });
  pinInputControl = new FormControl<string>('', { nonNullable: true });
  pinError = signal<string>('');

  onSearchChange() {
    this.chatState.searchQuery.set(this.searchControl.value.trim());
  }

  clearSearch() {
    this.searchControl.setValue('');
    this.chatState.clearSearch();
  }

  onNewChat() {
    this.clearSearch();
    this.chatState.startNewConversation();
    this.dismiss.emit();
  }

  selectChat(id: string) {
    this.clearSearch();
    this.chatState.selectConversation(id);
    this.dismiss.emit();
  }

  hideChat(event: MouseEvent, id: string) {
    event.stopPropagation();
    this.chatState.toggleHideConversation(id);
  }

  unhideChat(event: MouseEvent, id: string) {
    event.stopPropagation();
    this.chatState.toggleHideConversation(id);
  }

  unlockHidden() {
    const pin = this.pinInputControl.value.trim();
    if (!pin) {
      this.pinError.set('يرجى إدخال رمز القفل');
      return;
    }
    const success = this.chatState.unlockHiddenChats(pin);
    if (!success) {
      this.pinError.set('الرمز غير صحيح (الافتراضي: 1234)');
    } else {
      this.pinError.set('');
      this.pinInputControl.setValue('');
    }
  }

  deleteChat(event: MouseEvent, id: string) {
    event.stopPropagation();
    const isAr = this.chatState.language() === 'ar';
    if (confirm(isAr ? 'هل أنت متأكد من حذف هذه المحادثة من السجل؟' : 'Delete this conversation from history?')) {
      this.chatState.deleteConversation(id);
    }
  }

  clearAll() {
    const isAr = this.chatState.language() === 'ar';
    if (confirm(isAr ? 'هل أنت متأكد من مسح جميع الدردشات السابقة نهائياً؟ سيتم تنظيف السجل والبحث بالكامل.' : 'Permanently clear all chat history?')) {
      this.clearSearch();
      this.chatState.clearAllConversations();
    }
  }

  exportData() {
    const jsonStr = this.chatState.exportDataJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ja3far_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
