import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ChatState } from '../services/chat-state';
import { NoTrackClient } from '../services/notrack';
import {
  DialectType,
  PersonalityType,
  ResponseLengthType,
  ToneType,
} from '../core/types';

type SettingsTab =
  | 'appearance'
  | 'personalization'
  | 'memory'
  | 'behavior'
  | 'hidden'
  | 'search'
  | 'privacy'
  | 'api'
  | 'about';

@Component({
  selector: 'app-settings-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    @if (isOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
      >
        <!-- Accessible Backdrop Button -->
        <button
          type="button"
          class="fixed inset-0 w-full h-full bg-black/70 backdrop-blur-xs border-0 cursor-default"
          (click)="dismiss.emit()"
          [attr.aria-label]="chatState.language() === 'ar' ? 'إغلاق الإعدادات' : 'Close settings'"
        ></button>

        <div
          class="relative w-full max-w-3xl border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] z-10 transition-colors"
          [class]="chatState.theme() === 'dark'
            ? 'bg-[#181820] border-white/10 text-[#E6E4EC]'
            : 'bg-[#FFFFFF] border-black/10 text-stone-900'"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-3.5 border-b border-white/5 dark:border-white/5 light:border-black/5">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-[#A994F7]/20 flex items-center justify-center text-[#A994F7]">
                <mat-icon style="font-size: 18px;">tune</mat-icon>
              </div>
              <h2 class="font-ruqaa text-xl font-bold text-inherit">
                {{ chatState.language() === 'ar' ? 'إعدادات وتخصيص جعفر' : 'Ja3far Settings' }}
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

          <!-- Body with Sidebar Categories Navigation and Content -->
          <div class="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[460px]">
            <!-- Categories Navigation Bar -->
            <div
              class="w-full md:w-56 overflow-x-auto md:overflow-y-auto flex md:flex-col gap-1 p-2 border-b md:border-b-0 md:border-l border-white/5 dark:border-white/5 light:border-black/5 text-xs shrink-0"
              [class]="chatState.theme() === 'dark' ? 'bg-[#14141A]' : 'bg-[#F9F7F4]'"
            >
              @for (cat of categories; track cat.id) {
                <button
                  type="button"
                  (click)="activeTab.set(cat.id)"
                  class="flex items-center gap-2 px-3 py-2 rounded-xl text-start font-medium transition-all shrink-0 cursor-pointer"
                  [class]="activeTab() === cat.id
                    ? 'bg-[#A994F7] text-[#111116] shadow-xs font-semibold'
                    : 'text-[#A6A2B3] dark:text-[#A6A2B3] light:text-stone-600 hover:bg-white/5 dark:hover:bg-white/5 light:hover:bg-black/5'"
                >
                  <mat-icon style="font-size: 16px; width: 16px; height: 16px;" [class.text-[#A994F7]]="activeTab() !== cat.id">
                    {{ cat.icon }}
                  </mat-icon>
                  <span>{{ cat.label }}</span>
                </button>
              }
            </div>

            <!-- Tab Content Panel -->
            <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs sm:text-sm">
              <!-- 1. APPEARANCE (المظهر) -->
              @if (activeTab() === 'appearance') {
                <div class="space-y-4">
                  <h3 class="text-base font-bold text-inherit flex items-center gap-2">
                    <mat-icon class="text-[#A994F7]">palette</mat-icon>
                    <span>{{ chatState.language() === 'ar' ? 'المظهر وتنسيق الشاشة' : 'Appearance & Themes' }}</span>
                  </h3>
                  <p class="text-xs text-[#A6A2B3]">
                    {{ chatState.language() === 'ar' ? 'خصص ألوان الواجهة والتباين للقراءة المريحة في الليل والنهار.' : 'Select light, dark, or automatic system theme with full contrast.' }}
                  </p>

                  <!-- Theme Selection -->
                  <div class="space-y-2">
                    <span class="block text-xs font-semibold text-inherit">
                      {{ chatState.language() === 'ar' ? 'السمة (Theme)' : 'Theme' }}
                    </span>
                    <div class="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        (click)="chatState.setTheme('dark')"
                        class="p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer"
                        [class]="chatState.theme() === 'dark'
                          ? 'bg-[#A994F7]/15 border-[#A994F7] text-[#A994F7] font-bold shadow-xs'
                          : 'bg-white/5 border-white/10 text-[#A6A2B3] hover:text-white'"
                      >
                        <mat-icon>dark_mode</mat-icon>
                        <span class="text-xs">{{ chatState.language() === 'ar' ? 'داكن (Dark)' : 'Dark' }}</span>
                      </button>

                      <button
                        type="button"
                        (click)="chatState.setTheme('light')"
                        class="p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer"
                        [class]="chatState.theme() === 'light'
                          ? 'bg-[#A994F7]/25 border-[#7C5CE6] text-[#7C5CE6] font-bold shadow-xs'
                          : 'bg-white/5 border-white/10 text-[#A6A2B3] hover:text-white'"
                      >
                        <mat-icon>light_mode</mat-icon>
                        <span class="text-xs">{{ chatState.language() === 'ar' ? 'فاتح (Light)' : 'Light' }}</span>
                      </button>

                      <button
                        type="button"
                        (click)="chatState.setTheme('system')"
                        class="p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer"
                        [class]="chatState.theme() === 'system'
                          ? 'bg-[#A994F7]/15 border-[#A994F7] text-[#A994F7] font-bold shadow-xs'
                          : 'bg-white/5 border-white/10 text-[#A6A2B3] hover:text-white'"
                      >
                        <mat-icon>settings_brightness</mat-icon>
                        <span class="text-xs">{{ chatState.language() === 'ar' ? 'تلقائي (System)' : 'Auto' }}</span>
                      </button>
                    </div>
                  </div>

                  <!-- Language Selection -->
                  <div class="space-y-2 pt-3 border-t border-white/5 dark:border-white/5 light:border-black/5">
                    <span class="block text-xs font-semibold text-inherit">
                      {{ chatState.language() === 'ar' ? 'لغة الواجهة الرئيسية' : 'Interface Language' }}
                    </span>
                    <div class="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        (click)="chatState.setLanguage('ar')"
                        class="py-2 px-3 rounded-xl border text-xs font-medium cursor-pointer transition-all"
                        [class]="chatState.language() === 'ar' ? 'bg-[#A994F7] text-[#111116] border-[#A994F7]' : 'bg-white/5 border-white/10 text-[#A6A2B3]'"
                      >
                        العربية (Arabic)
                      </button>
                      <button
                        type="button"
                        (click)="chatState.setLanguage('en')"
                        class="py-2 px-3 rounded-xl border text-xs font-medium cursor-pointer transition-all"
                        [class]="chatState.language() === 'en' ? 'bg-[#A994F7] text-[#111116] border-[#A994F7]' : 'bg-white/5 border-white/10 text-[#A6A2B3]'"
                      >
                        English
                      </button>
                    </div>
                  </div>
                </div>
              }

              <!-- 2. PERSONALIZATION (التخصيص) -->
              @if (activeTab() === 'personalization') {
                <div class="space-y-4">
                  <h3 class="text-base font-bold text-inherit flex items-center gap-2">
                    <mat-icon class="text-[#A994F7]">person</mat-icon>
                    <span>{{ chatState.language() === 'ar' ? 'التخصيص وملف المستخدم' : 'Personalization & Profile' }}</span>
                  </h3>
                  <p class="text-xs text-[#A6A2B3]">
                    {{ chatState.language() === 'ar' ? 'يتذكر جعفر هذه الإعدادات ويخاطبك بها في كل محادثة.' : 'Ja3far customizes answers based on your profile and dialect.' }}
                  </p>

                  <div class="space-y-3">
                    <div>
                      <span class="block text-xs font-semibold mb-1 text-inherit">
                        {{ chatState.language() === 'ar' ? 'اسمك أو اللقب المفضل (كيف يناديك جعفر؟)' : 'Your Name or Preferred Title' }}
                      </span>
                      <input
                        [formControl]="userNameControl"
                        type="text"
                        placeholder="مثال: أحمد، المهندسة سارة، دكتور محمد..."
                        class="w-full rounded-xl px-3.5 py-2 text-xs border bg-white/5 dark:bg-white/5 light:bg-black/5 border-white/10 dark:border-white/10 light:border-black/10 focus:outline-none focus:border-[#A994F7]"
                      />
                    </div>

                    <div>
                      <span class="block text-xs font-semibold mb-1 text-inherit">
                        {{ chatState.language() === 'ar' ? 'اهتماماتك ومجال عملك' : 'Your Interests & Profession' }}
                      </span>
                      <input
                        [formControl]="userInterestsControl"
                        type="text"
                        placeholder="مثال: هندسة البرمجيات، تشجيع النادي الأهلي، الذكاء الاصطناعي، التجارة..."
                        class="w-full rounded-xl px-3.5 py-2 text-xs border bg-white/5 dark:bg-white/5 light:bg-black/5 border-white/10 dark:border-white/10 light:border-black/10 focus:outline-none focus:border-[#A994F7]"
                      />
                    </div>

                    <div>
                      <span class="block text-xs font-semibold mb-1 text-inherit">
                        {{ chatState.language() === 'ar' ? 'اللهجة المفضلة لردود جعفر' : 'Preferred Dialect' }}
                      </span>
                      <select
                        [formControl]="preferredDialectControl"
                        class="w-full rounded-xl px-3.5 py-2 text-xs border bg-white/5 dark:bg-[#181820] light:bg-white border-white/10 dark:border-white/10 light:border-black/10 focus:outline-none focus:border-[#A994F7]"
                      >
                        <option value="egyptian">اللهجة المصرية (الافتراضية - ودودة وذكية)</option>
                        <option value="saudi">اللهجة السعودية والخليجية</option>
                        <option value="levantine">اللهجة الشامية</option>
                        <option value="msa">اللغة العربية الفصحى</option>
                        <option value="english">English (Natural & Articulate)</option>
                      </select>
                    </div>

                    <div>
                      <span class="block text-xs font-semibold mb-1 text-inherit">
                        {{ chatState.language() === 'ar' ? 'ملاحظات ومعلومات خاصة يهمك أن يعرفها' : 'Personal Notes & Context' }}
                      </span>
                      <textarea
                        [formControl]="personalNotesControl"
                        rows="2"
                        placeholder="مثال: أقيم في الجيزة، أفضل الأمثلة العملية باللغة العربية، أدرس في كلية الهندسة..."
                        class="w-full rounded-xl px-3.5 py-2 text-xs border bg-white/5 dark:bg-white/5 light:bg-black/5 border-white/10 dark:border-white/10 light:border-black/10 focus:outline-none focus:border-[#A994F7] resize-none"
                      ></textarea>
                    </div>

                    <button
                      type="button"
                      (click)="savePersonalization()"
                      class="px-4 py-2 rounded-xl bg-[#A994F7] text-[#111116] font-bold text-xs shadow-xs hover:bg-[#BDB0F9] transition-all cursor-pointer"
                    >
                      {{ chatState.language() === 'ar' ? 'حفظ التخصيص' : 'Save Personalization' }}
                    </button>
                  </div>
                </div>
              }

              <!-- 3. MEMORY (الذاكرة) -->
              @if (activeTab() === 'memory') {
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <h3 class="text-base font-bold text-inherit flex items-center gap-2">
                        <mat-icon class="text-[#A994F7]">psychology</mat-icon>
                        <span>{{ chatState.language() === 'ar' ? 'ذاكرة جعفر المخصصة' : 'Assistant Memory' }}</span>
                      </h3>
                      <p class="text-xs text-[#A6A2B3] mt-0.5">
                        {{ chatState.language() === 'ar' ? 'تحكم كامل في المعلومات المحفوظة: يمكنك مراجعتها، تعديلها، أو حذفها.' : 'Full control over saved memory items.' }}
                      </p>
                    </div>
                    @if (chatState.memories().length > 0) {
                      <button
                        type="button"
                        (click)="clearMemories()"
                        class="px-2.5 py-1 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      >
                        {{ chatState.language() === 'ar' ? 'مسح الذاكرة بالكامل' : 'Clear All' }}
                      </button>
                    }
                  </div>

                  <!-- Add New Memory Card -->
                  <div class="p-3.5 rounded-xl border border-white/10 dark:border-white/10 light:border-black/10 bg-white/5 dark:bg-white/5 light:bg-black/5 space-y-2.5">
                    <span class="text-xs font-bold text-[#A994F7] flex items-center gap-1">
                      <mat-icon style="font-size: 15px;">add_circle_outline</mat-icon>
                      <span>{{ chatState.language() === 'ar' ? 'إضافة معلومة جديدة للذاكرة' : 'Add New Memory' }}</span>
                    </span>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        [formControl]="newMemoryKeyControl"
                        type="text"
                        placeholder="العنوان (مثال: فريقي المفضل)"
                        class="rounded-xl px-3 py-1.5 text-xs border bg-white/5 dark:bg-[#181820] light:bg-white border-white/10 dark:border-white/10 light:border-black/10 focus:outline-none focus:border-[#A994F7]"
                      />
                      <input
                        [formControl]="newMemoryValControl"
                        type="text"
                        placeholder="المعلومة (مثال: النادي الأهلي المصري)"
                        class="rounded-xl px-3 py-1.5 text-xs border bg-white/5 dark:bg-[#181820] light:bg-white border-white/10 dark:border-white/10 light:border-black/10 focus:outline-none focus:border-[#A994F7]"
                      />
                    </div>
                    <button
                      type="button"
                      (click)="addNewMemory()"
                      class="px-3.5 py-1.5 rounded-xl bg-[#8BCFC2] text-stone-900 font-bold text-xs hover:bg-[#A3DDD2] transition-all cursor-pointer"
                    >
                      {{ chatState.language() === 'ar' ? 'تثبيت في الذاكرة' : 'Save Memory' }}
                    </button>
                  </div>

                  <!-- Memories List -->
                  <div class="space-y-2">
                    @for (mem of chatState.memories(); track mem.id) {
                      <div class="p-3 rounded-xl border border-white/5 dark:border-white/5 light:border-black/10 flex items-center justify-between gap-2 bg-white/[0.02]">
                        <div class="flex-1">
                          <span class="font-bold text-xs text-[#A994F7] block">[{{ mem.key }}]</span>
                          <span class="text-xs opacity-90 block mt-0.5">{{ mem.value }}</span>
                        </div>
                        <button
                          type="button"
                          (click)="deleteMemory(mem.id)"
                          class="p-1 rounded text-[#A6A2B3] hover:text-rose-400 hover:bg-white/5 transition-colors cursor-pointer"
                          [attr.title]="chatState.language() === 'ar' ? 'حذف هذه المعلومة' : 'Delete'"
                        >
                          <mat-icon style="font-size: 16px;">delete_outline</mat-icon>
                        </button>
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- 4. BEHAVIOR (سلوك المساعد) -->
              @if (activeTab() === 'behavior') {
                <div class="space-y-4">
                  <h3 class="text-base font-bold text-inherit flex items-center gap-2">
                    <mat-icon class="text-[#A994F7]">smart_toy</mat-icon>
                    <span>{{ chatState.language() === 'ar' ? 'تخصيص شخصية وسلوك جعفر' : 'Assistant Behavior' }}</span>
                  </h3>

                  <div class="space-y-3">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span class="block text-xs font-semibold mb-1 text-inherit">
                          {{ chatState.language() === 'ar' ? 'اسم المساعد' : 'Assistant Name' }}
                        </span>
                        <input
                          [formControl]="assistantNameControl"
                          type="text"
                          class="w-full rounded-xl px-3 py-2 text-xs border bg-white/5 dark:bg-white/5 light:bg-black/5 border-white/10 dark:border-white/10 light:border-black/10 focus:outline-none"
                        />
                      </div>

                      <div>
                        <span class="block text-xs font-semibold mb-1 text-inherit">
                          {{ chatState.language() === 'ar' ? 'الشخصية والروح' : 'Personality' }}
                        </span>
                        <select
                          [formControl]="personalityControl"
                          class="w-full rounded-xl px-3 py-2 text-xs border bg-white/5 dark:bg-[#181820] light:bg-white border-white/10 dark:border-white/10 light:border-black/10 focus:outline-none"
                        >
                          <option value="friendly_humorous">ودود ومرح وخفيف الظل بروح مصرية</option>
                          <option value="professional">احترافي، موضوعي، ودقيق جداً</option>
                          <option value="concise">موجز وسريع ومباشر في الإجابة</option>
                          <option value="creative">إبداعي وغني بالحلول المبتكرة</option>
                        </select>
                      </div>

                      <div>
                        <span class="block text-xs font-semibold mb-1 text-inherit">
                          {{ chatState.language() === 'ar' ? 'النبرة (Tone)' : 'Tone' }}
                        </span>
                        <select
                          [formControl]="toneControl"
                          class="w-full rounded-xl px-3 py-2 text-xs border bg-white/5 dark:bg-[#181820] light:bg-white border-white/10 dark:border-white/10 light:border-black/10 focus:outline-none"
                        >
                          <option value="casual">عفوية وودية وغير متكلفة</option>
                          <option value="formal">رسمية وأنيقة وأكاديمية</option>
                        </select>
                      </div>

                      <div>
                        <span class="block text-xs font-semibold mb-1 text-inherit">
                          {{ chatState.language() === 'ar' ? 'طول الردود المفضل' : 'Response Length' }}
                        </span>
                        <select
                          [formControl]="responseLengthControl"
                          class="w-full rounded-xl px-3 py-2 text-xs border bg-white/5 dark:bg-[#181820] light:bg-white border-white/10 dark:border-white/10 light:border-black/10 focus:outline-none"
                        >
                          <option value="medium">متوازن (الافتراضي)</option>
                          <option value="concise">موجز ومختصر</option>
                          <option value="detailed">مفصل وشامل مع تفاصيل وأمثلة</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <span class="block text-xs font-semibold mb-1 text-inherit">
                        {{ chatState.language() === 'ar' ? 'تعليمات نظام مخصصة دائمة (Custom Instructions)' : 'Custom System Instructions' }}
                      </span>
                      <textarea
                        [formControl]="customInstructionsControl"
                        rows="3"
                        placeholder="مثال: ركز دائماً على توفير كود كامل مع تعليقات، استخدم جداول عند المقارنات..."
                        class="w-full rounded-xl px-3.5 py-2 text-xs border bg-white/5 dark:bg-white/5 light:bg-black/5 border-white/10 dark:border-white/10 light:border-black/10 focus:outline-none focus:border-[#A994F7] resize-none"
                      ></textarea>
                    </div>

                    <button
                      type="button"
                      (click)="saveBehavior()"
                      class="px-4 py-2 rounded-xl bg-[#A994F7] text-[#111116] font-bold text-xs shadow-xs hover:bg-[#BDB0F9] transition-all cursor-pointer"
                    >
                      {{ chatState.language() === 'ar' ? 'تطبيق إعدادات السلوك' : 'Apply Behavior' }}
                    </button>
                  </div>
                </div>
              }

              <!-- 6. HIDDEN CHATS (المحادثات المخفية) -->
              @if (activeTab() === 'hidden') {
                <div class="space-y-4">
                  <h3 class="text-base font-bold text-inherit flex items-center gap-2">
                    <mat-icon class="text-amber-400">visibility_off</mat-icon>
                    <span>{{ chatState.language() === 'ar' ? 'أمان المحادثات المخفية' : 'Hidden Chats Security' }}</span>
                  </h3>
                  <p class="text-xs text-[#A6A2B3]">
                    {{ chatState.language() === 'ar' ? 'المحادثات المخفية تبقى محفوظة برمز قفل سري لا يظهر للآخرين.' : 'Manage your hidden conversation lock code and view hidden chat count.' }}
                  </p>

                  <div class="p-3.5 rounded-xl border border-white/10 dark:border-white/10 light:border-black/10 space-y-3 bg-white/5">
                    <div class="flex items-center justify-between text-xs">
                      <span>{{ chatState.language() === 'ar' ? 'عدد المحادثات المخفية حالياً:' : 'Hidden conversations count:' }}</span>
                      <span class="font-bold font-mono text-[#A994F7]">{{ chatState.hiddenConversations().length }}</span>
                    </div>

                    <div class="flex items-center justify-between text-xs">
                      <span>{{ chatState.language() === 'ar' ? 'حالة القفل:' : 'Lock status:' }}</span>
                      <span class="font-bold" [class]="chatState.hiddenChatsUnlocked() ? 'text-emerald-400' : 'text-amber-400'">
                        {{ chatState.hiddenChatsUnlocked() ? (chatState.language() === 'ar' ? 'مفتوح' : 'Unlocked') : (chatState.language() === 'ar' ? 'مقفل' : 'Locked') }}
                      </span>
                    </div>

                    <!-- Change PIN -->
                    <div class="pt-3 border-t border-white/5 dark:border-white/5 light:border-black/5 space-y-2">
                      <span class="text-xs font-bold block text-inherit">
                        {{ chatState.language() === 'ar' ? 'تغيير رمز القفل (PIN)' : 'Change PIN' }}
                      </span>
                      <div class="grid grid-cols-2 gap-2">
                        <input
                          [formControl]="currentPinControl"
                          type="password"
                          maxlength="8"
                          placeholder="الرمز الحالي"
                          class="rounded-xl px-3 py-1.5 text-xs border bg-white/5 dark:bg-[#181820] light:bg-white border-white/10 dark:border-white/10 light:border-black/10 focus:outline-none"
                        />
                        <input
                          [formControl]="newPinControl"
                          type="password"
                          maxlength="8"
                          placeholder="الرمز الجديد"
                          class="rounded-xl px-3 py-1.5 text-xs border bg-white/5 dark:bg-[#181820] light:bg-white border-white/10 dark:border-white/10 light:border-black/10 focus:outline-none"
                        />
                      </div>
                      @if (pinChangeMessage()) {
                        <p class="text-[11px] font-medium" [class]="pinChangeSuccess() ? 'text-emerald-400' : 'text-rose-400'">
                          {{ pinChangeMessage() }}
                        </p>
                      }
                      <button
                        type="button"
                        (click)="saveNewPin()"
                        class="px-3.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 font-bold text-xs hover:bg-amber-500/30 transition-all cursor-pointer"
                      >
                        {{ chatState.language() === 'ar' ? 'حفظ الرمز الجديد' : 'Update PIN' }}
                      </button>
                    </div>
                  </div>
                </div>
              }

              <!-- 7. WEB SEARCH (البحث المباشر) -->
              @if (activeTab() === 'search') {
                <div class="space-y-4">
                  <h3 class="text-base font-bold text-inherit flex items-center gap-2">
                    <mat-icon class="text-[#8BCFC2]">travel_explore</mat-icon>
                    <span>{{ chatState.language() === 'ar' ? 'البحث الحي والمعلومات المحدثة' : 'Live Web Search' }}</span>
                  </h3>
                  <p class="text-xs text-[#A6A2B3]">
                    {{ chatState.language() === 'ar' ? 'يبحث جعفر في الويب تلقائياً عند السؤال عن الأخبار الحالية، نتائج ومباريات كرة القدم (الأهلي، الزمالك، إلخ)، التكنولوجيا، الأسعار، وحالة الطقس.' : 'Provides live factual grounding with verified citation links.' }}
                  </p>

                  <div class="p-3.5 rounded-xl border border-white/10 dark:border-white/10 light:border-black/10 space-y-3">
                    <label for="enableLiveWebSearchCheckbox" class="flex items-center justify-between cursor-pointer">
                      <div>
                        <span class="font-bold text-xs block text-inherit">
                          {{ chatState.language() === 'ar' ? 'تفعيل البحث الحي على الإنترنت' : 'Enable Live Web Search' }}
                        </span>
                        <span class="text-[11px] text-[#A6A2B3]">
                          {{ chatState.language() === 'ar' ? 'يدعم روابط المصادر الحقيقية القابلة للنقر.' : 'Enables real-time verification and clickable sources.' }}
                        </span>
                      </div>
                      <input
                        id="enableLiveWebSearchCheckbox"
                        type="checkbox"
                        [checked]="chatState.webSearchSettings().enabled"
                        (change)="toggleSearchSetting($event)"
                        class="w-4 h-4 text-[#8BCFC2] rounded accent-[#8BCFC2] cursor-pointer"
                      />
                    </label>

                    <!-- Real-time Cairo Time Status -->
                    @if (chatState.cairoTime(); as time) {
                      <div class="p-3 rounded-xl bg-[#8BCFC2]/10 border border-[#8BCFC2]/20 text-xs text-[#8BCFC2] flex items-center gap-2">
                        <mat-icon style="font-size: 16px;">schedule</mat-icon>
                        <div>
                          <span class="font-bold block">{{ time.fullSummary }}</span>
                          <span class="text-[10px] opacity-80">يستخدم جعفر هذا التوقيت الفعلي للرد على مواعيد وأخبار اليوم.</span>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- 8. PRIVACY & SECURITY (الخصوصية والأمان) -->
              @if (activeTab() === 'privacy') {
                <div class="space-y-4">
                  <h3 class="text-base font-bold text-inherit flex items-center gap-2">
                    <mat-icon class="text-[#A994F7]">shield</mat-icon>
                    <span>{{ chatState.language() === 'ar' ? 'الخصوصية وتخزين البيانات' : 'Privacy & Security' }}</span>
                  </h3>

                  <div class="space-y-3 text-xs text-[#A6A2B3] leading-relaxed">
                    <div class="p-3.5 rounded-xl border border-white/10 dark:border-white/10 light:border-black/10 bg-white/5 space-y-2">
                      <span class="font-bold text-inherit block text-sm">
                        {{ chatState.language() === 'ar' ? 'معايير الخصوصية الفائقة' : 'High Privacy Standards' }}
                      </span>
                      <p>
                        {{ chatState.language() === 'ar' ? '• جميع محادثاتك وسجلاتك مخزنة محلياً في متصفحك فقط ولا يتم حفظها في قواعد بيانات سحابية خارجية.' : '• All chats and personal data are stored only in your local browser.' }}
                      </p>
                      <p>
                        {{ chatState.language() === 'ar' ? '• المفاتيح والإعدادات الإدارية محفوظة في الخادم الداخلي المعزول ولا تتسرب أبداً لكود المتصفح.' : '• Sensitive API keys remain strictly protected on the backend server.' }}
                      </p>
                    </div>

                    <div class="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        (click)="clearAllChats()"
                        class="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/25 text-rose-300 dark:text-rose-300 light:text-rose-700 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <mat-icon style="font-size: 16px;">delete_sweep</mat-icon>
                        <span>{{ chatState.language() === 'ar' ? 'مسح كل الدردشات السابقة وتنظيف البحث' : 'Clear All Previous Chats' }}</span>
                      </button>

                      <button
                        type="button"
                        (click)="clearLocalData()"
                        class="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[#A6A2B3] hover:text-white font-medium text-xs transition-colors cursor-pointer"
                      >
                        {{ chatState.language() === 'ar' ? 'مسح كل بيانات المتصفح وإعادة الضبط' : 'Reset All Browser Data' }}
                      </button>
                    </div>
                  </div>
                </div>
              }

              <!-- 9. API MANAGEMENT (إدارة API - للمسؤول فقط) -->
              @if (activeTab() === 'api') {
                <div class="space-y-4">
                  <h3 class="text-base font-bold text-inherit flex items-center gap-2">
                    <mat-icon class="text-amber-400">admin_panel_settings</mat-icon>
                    <span>{{ chatState.language() === 'ar' ? 'إدارة مفاتيح API (لوحة الإدارة)' : 'API Management (Admin)' }}</span>
                  </h3>

                  @if (!isAdminVerified()) {
                    <!-- Admin Login -->
                    <div class="p-4 rounded-xl border border-white/10 dark:border-white/10 light:border-black/10 bg-white/5 space-y-3">
                      <p class="text-xs text-[#A6A2B3]">
                        {{ chatState.language() === 'ar' ? 'منطقة محمية لإدارة مفاتيح ومزود الذكاء الاصطناعي المركزي. أدخل رمز المرور الإداري للمتابعة:' : 'Protected area for central AI provider management. Enter the admin access code to continue:' }}
                      </p>

                      <div class="flex items-center gap-2 max-w-sm">
                        <input
                          [formControl]="adminCodeInputControl"
                          type="password"
                          placeholder="••••••••"
                          autocomplete="current-password"
                          class="flex-1 rounded-xl px-3.5 py-2 text-xs font-mono border bg-white/5 dark:bg-[#181820] light:bg-white border-white/10 dark:border-white/10 light:border-black/10 focus:outline-none"
                          (keydown.enter)="verifyAdminAccess()"
                        />
                        <button
                          type="button"
                          (click)="verifyAdminAccess()"
                          [disabled]="isAdminChecking()"
                          class="px-4 py-2 rounded-xl bg-[#A994F7] text-[#111116] font-bold text-xs shadow-xs hover:bg-[#BDB0F9] cursor-pointer disabled:opacity-50"
                        >
                          {{ isAdminChecking() ? '...' : (chatState.language() === 'ar' ? 'دخول' : 'Unlock') }}
                        </button>
                      </div>

                      @if (adminError()) {
                        <p class="text-xs text-rose-400 font-medium">{{ adminError() }}</p>
                      }
                    </div>
                  } @else {
                    <!-- Admin Dashboard: Provider & Keys -->
                    <div class="space-y-4">
                      <div class="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                        <span class="flex items-center gap-1.5 font-bold">
                          <mat-icon style="font-size: 16px;">verified</mat-icon>
                          <span>{{ chatState.language() === 'ar' ? 'تم الدخول بصلاحيات المدير بنجاح' : 'Admin Authorized' }}</span>
                        </span>
                        <button
                          type="button"
                          (click)="lockAdmin()"
                          class="px-2 py-0.5 rounded text-[11px] bg-white/10 text-inherit hover:bg-white/20 cursor-pointer"
                        >
                          {{ chatState.language() === 'ar' ? 'خروج' : 'Lock' }}
                        </button>
                      </div>

                      <!-- NoTrack Active Badge -->
                      <div class="flex items-center justify-between p-3 rounded-xl bg-[#8BCFC2]/10 border border-[#8BCFC2]/25 text-[#8BCFC2] text-xs">
                        <span class="flex items-center gap-2 font-bold">
                          <mat-icon style="font-size: 18px; width: 18px; height: 18px;">bolt</mat-icon>
                          <span>{{ chatState.language() === 'ar' ? 'المزود النشط: NoTrack.ai (غير مقيد فائق الخصوصية)' : 'Active Engine: NoTrack.ai (Uncensored)' }}</span>
                        </span>
                        <span class="font-mono text-[10px] px-2 py-0.5 rounded bg-[#8BCFC2]/20 font-bold">notrack-uncensored</span>
                      </div>

                      <!-- NoTrack Settings -->
                      <div class="p-3.5 rounded-xl border border-white/10 dark:border-white/10 light:border-black/10 space-y-2.5">
                        <span class="font-bold text-xs text-[#8BCFC2] block">NoTrack.ai API</span>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <span class="block text-[11px] text-[#A6A2B3] mb-1">Base URL</span>
                            <input
                              [formControl]="notrackUrlControl"
                              type="url"
                              placeholder="https://api.notrack.ai/v1"
                              class="w-full rounded-xl px-3 py-1.5 text-xs font-mono border bg-white/5 dark:bg-[#181820] light:bg-white border-white/10 dark:border-white/10 light:border-black/10 focus:outline-none"
                            />
                          </div>
                          <div>
                            <span class="block text-[11px] text-[#A6A2B3] mb-1">Model ID</span>
                            <input
                              [formControl]="notrackModelControl"
                              type="text"
                              placeholder="notrack-uncensored"
                              class="w-full rounded-xl px-3 py-1.5 text-xs font-mono border bg-white/5 dark:bg-[#181820] light:bg-white border-white/10 dark:border-white/10 light:border-black/10 focus:outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <span class="block text-[11px] text-[#A6A2B3] mb-1">NoTrack API Key</span>
                          <input
                            [formControl]="notrackKeyControl"
                            type="password"
                            placeholder="sk-notrack-..."
                            class="w-full rounded-xl px-3 py-1.5 text-xs font-mono border bg-white/5 dark:bg-[#181820] light:bg-white border-white/10 dark:border-white/10 light:border-black/10 focus:outline-none"
                          />
                        </div>
                      </div>

                      <!-- Test & Save Buttons -->
                      <div class="flex items-center gap-2 pt-2">
                        <button
                          type="button"
                          (click)="testAdminConnection()"
                          [disabled]="isAdminTesting()"
                          class="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <mat-icon style="font-size: 16px;" [class.animate-spin]="isAdminTesting()">sync</mat-icon>
                          <span>{{ chatState.language() === 'ar' ? 'فحص الاتصال المباشر' : 'Test API' }}</span>
                        </button>

                        <button
                          type="button"
                          (click)="saveAdminKeys()"
                          [disabled]="isAdminSaving()"
                          class="px-4 py-2 rounded-xl bg-[#A994F7] text-[#111116] font-bold text-xs shadow-xs hover:bg-[#BDB0F9] transition-all cursor-pointer"
                        >
                          {{ chatState.language() === 'ar' ? 'حفظ المفاتيح على الخادم' : 'Save Keys on Server' }}
                        </button>
                      </div>

                      @if (adminSaveStatus(); as saveRes) {
                        <div
                          class="p-3 rounded-xl border text-xs flex items-center gap-2"
                          [class]="saveRes.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'"
                        >
                          <mat-icon style="font-size: 16px; width: 16px; height: 16px;">{{ saveRes.success ? 'check_circle' : 'error' }}</mat-icon>
                          <span>{{ saveRes.message }}</span>
                        </div>
                      }

                      @if (adminTestResult(); as res) {
                        <div
                          class="p-3 rounded-xl border text-xs"
                          [class]="res.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'"
                        >
                          {{ res.message }} ({{ res.latencyMs }}ms)
                        </div>
                      }
                    </div>
                  }
                </div>
              }

              <!-- 10. ABOUT & DEVELOPER CONTACT (حول المطور والتواصل) -->
              @if (activeTab() === 'about') {
                <div class="space-y-4">
                  <h3 class="text-base font-bold text-inherit flex items-center gap-2">
                    <mat-icon class="text-[#A994F7]">info</mat-icon>
                    <span>{{ chatState.language() === 'ar' ? 'حول التطبيق والمطور' : 'About & Developer' }}</span>
                  </h3>

                  <!-- App Card -->
                  <div class="p-4 rounded-xl border border-white/10 dark:border-white/10 light:border-black/10 bg-white/5 space-y-2">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#A994F7] to-[#8BCFC2] p-[1px] flex items-center justify-center">
                        <div class="w-full h-full bg-[#181820] rounded-[11px] flex items-center justify-center">
                          <span class="font-ruqaa text-[#A994F7] text-lg font-bold">ج</span>
                        </div>
                      </div>
                      <div>
                        <h4 class="font-ruqaa text-lg font-bold text-inherit">جعفر — Ja3far AI</h4>
                        <p class="text-xs text-[#A6A2B3]">الإصدار 2.0 • مساعد ذكي مصري مستقل وفائق الخصوصية</p>
                      </div>
                    </div>
                  </div>

                  <!-- Developer Profile Card with User Photo & Bio -->
                  <div class="p-4 sm:p-5 rounded-2xl border border-white/10 dark:border-white/10 light:border-black/10 bg-gradient-to-br from-[#A994F7]/15 via-white/5 to-[#8BCFC2]/15 space-y-3.5">
                    <div class="flex items-center gap-3.5 sm:gap-4">
                      <div class="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-2xl overflow-hidden border-2 border-[#A994F7] shadow-lg">
                        <img
                          src="/assets/aistudio/ChatGPT_Image_27________2026__05_45_12___a5e00d16.png"
                          alt="Belal Ahmed - بلال أحمد"
                          class="w-full h-full object-cover object-top"
                          referrerpolicy="no-referrer"
                        />
                      </div>
                      <div class="space-y-1">
                        <span class="text-[11px] font-mono text-[#8BCFC2] font-semibold tracking-wider uppercase block">
                          {{ chatState.language() === 'ar' ? 'المطور والمبتكر' : 'Developer & Creator' }}
                        </span>
                        <h4 class="text-base sm:text-lg font-bold text-white dark:text-white light:text-stone-900 font-sans">
                          Developed by Belal Ahmed
                        </h4>
                        <p class="text-xs text-[#A6A2B3] dark:text-[#A6A2B3] light:text-stone-600 font-medium">
                          بلال أحمد
                        </p>
                      </div>
                    </div>

                    <!-- User's exact quote as requested -->
                    <div class="p-3.5 rounded-xl bg-black/25 dark:bg-black/35 light:bg-black/5 border border-white/5 dark:border-white/5 light:border-black/5 text-xs sm:text-sm text-inherit leading-relaxed">
                      <div class="flex items-start gap-2">
                        <span class="text-[#A994F7] font-bold text-lg leading-none shrink-0">❝</span>
                        <p class="font-medium whitespace-pre-line text-sm text-[#E6E4EC] dark:text-[#E6E4EC] light:text-stone-800">
اسمي بلال وطالب ثانوي عام 
وبحب اضيع وقتي في حاجات زي كدة
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- Professional Contact & Social Media Section (Section 12) -->
                  <div class="space-y-3">
                    <div class="flex items-center gap-2">
                      <mat-icon class="text-[#8BCFC2]">alternate_email</mat-icon>
                      <h4 class="font-bold text-xs sm:text-sm text-inherit">
                        {{ chatState.language() === 'ar' ? 'تواصل مع المطور (Contact the Developer)' : 'Contact the Developer' }}
                      </h4>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <!-- Instagram Option -->
                      <a
                        href="https://www.instagram.com/bola_699?vrfl=d2lwbTFxaTNmeTdn"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="p-3.5 rounded-xl border border-white/10 dark:border-white/10 light:border-black/10 bg-white/5 dark:bg-white/5 light:bg-black/5 hover:border-[#A994F7]/50 hover:bg-[#A994F7]/10 transition-all flex items-center justify-between group cursor-pointer"
                      >
                        <div class="flex items-center gap-3">
                          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-xs">
                            <mat-icon style="font-size: 20px;">camera_alt</mat-icon>
                          </div>
                          <div>
                            <span class="font-bold text-xs block text-inherit">Instagram</span>
                            <span class="text-xs font-mono text-[#A994F7] group-hover:underline">&#64;bola_699</span>
                          </div>
                        </div>
                        <mat-icon style="font-size: 16px;" class="text-[#A6A2B3] group-hover:text-white">open_in_new</mat-icon>
                      </a>

                      <!-- Telegram Option -->
                      <a
                        href="https://t.me/bola_69"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="p-3.5 rounded-xl border border-white/10 dark:border-white/10 light:border-black/10 bg-white/5 dark:bg-white/5 light:bg-black/5 hover:border-[#8BCFC2]/50 hover:bg-[#8BCFC2]/10 transition-all flex items-center justify-between group cursor-pointer"
                      >
                        <div class="flex items-center gap-3">
                          <div class="w-9 h-9 rounded-xl bg-[#229ED9] flex items-center justify-center text-white shadow-xs">
                            <mat-icon style="font-size: 20px;">send</mat-icon>
                          </div>
                          <div>
                            <span class="font-bold text-xs block text-inherit">Telegram</span>
                            <span class="text-xs font-mono text-[#8BCFC2] group-hover:underline">&#64;bola_69</span>
                          </div>
                        </div>
                        <mat-icon style="font-size: 16px;" class="text-[#A6A2B3] group-hover:text-white">open_in_new</mat-icon>
                      </a>
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Dialog Footer -->
          <div class="flex items-center justify-between px-5 py-3 border-t border-white/5 dark:border-white/5 light:border-black/5 bg-white/[0.02]">
            <span class="text-[11px] text-[#A6A2B3] font-sans">Developed by Belal Ahmed</span>
            <button
              type="button"
              (click)="dismiss.emit()"
              class="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-inherit font-bold text-xs transition-colors cursor-pointer"
            >
              {{ chatState.language() === 'ar' ? 'إغلاق' : 'Close' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class SettingsDialog implements OnInit {
  chatState = inject(ChatState);
  notrack = inject(NoTrackClient);

  isOpen = input<boolean>(false);
  dismiss = output<void>();

  activeTab = signal<SettingsTab>('appearance');

  categories: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'appearance', label: 'المظهر', icon: 'palette' },
    { id: 'personalization', label: 'التخصيص', icon: 'person' },
    { id: 'memory', label: 'الذاكرة', icon: 'psychology' },
    { id: 'behavior', label: 'سلوك المساعد', icon: 'smart_toy' },
    { id: 'hidden', label: 'المحادثات المخفية', icon: 'visibility_off' },
    { id: 'search', label: 'البحث المباشر', icon: 'travel_explore' },
    { id: 'privacy', label: 'الخصوصية', icon: 'shield' },
    { id: 'api', label: 'إدارة API', icon: 'admin_panel_settings' },
    { id: 'about', label: 'حول والمطور', icon: 'info' },
  ];

  // Personalization Form Controls
  userNameControl = new FormControl<string>('', { nonNullable: true });
  userInterestsControl = new FormControl<string>('', { nonNullable: true });
  personalNotesControl = new FormControl<string>('', { nonNullable: true });
  preferredDialectControl = new FormControl<DialectType>('egyptian', { nonNullable: true });

  // Memory Controls
  newMemoryKeyControl = new FormControl<string>('', { nonNullable: true });
  newMemoryValControl = new FormControl<string>('', { nonNullable: true });

  // Behavior Controls
  assistantNameControl = new FormControl<string>('جعفر', { nonNullable: true });
  personalityControl = new FormControl<PersonalityType>('friendly_humorous', { nonNullable: true });
  toneControl = new FormControl<ToneType>('casual', { nonNullable: true });
  responseLengthControl = new FormControl<ResponseLengthType>('medium', { nonNullable: true });
  customInstructionsControl = new FormControl<string>('', { nonNullable: true });

  // Hidden Chats Pin
  currentPinControl = new FormControl<string>('', { nonNullable: true });
  newPinControl = new FormControl<string>('', { nonNullable: true });
  pinChangeMessage = signal<string>('');
  pinChangeSuccess = signal<boolean>(false);

  // Admin Controls
  adminCodeInputControl = new FormControl<string>('', { nonNullable: true });
  isAdminVerified = signal<boolean>(false);
  isAdminChecking = signal<boolean>(false);
  adminError = signal<string>('');
  activeAdminCode = signal<string>('');

  activeProviderControl = new FormControl<'notrack'>('notrack', { nonNullable: true });
  notrackKeyControl = new FormControl<string>('', { nonNullable: true });
  notrackUrlControl = new FormControl<string>('https://api.notrack.ai/v1', { nonNullable: true });
  notrackModelControl = new FormControl<string>('notrack-uncensored', { nonNullable: true });

  isAdminSaving = signal<boolean>(false);
  isAdminTesting = signal<boolean>(false);
  adminTestResult = signal<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  adminSaveStatus = signal<{ success: boolean; message: string } | null>(null);

  ngOnInit() {
    this.syncFormValues();
  }

  syncFormValues() {
    const pers = this.chatState.personalization();
    this.userNameControl.setValue(pers.userName);
    this.userInterestsControl.setValue(pers.userInterests);
    this.personalNotesControl.setValue(pers.personalNotes);
    this.preferredDialectControl.setValue(pers.preferredDialect);
    this.assistantNameControl.setValue(pers.assistantName);
    this.personalityControl.setValue(pers.personality);
    this.toneControl.setValue(pers.tone);
    this.responseLengthControl.setValue(pers.responseLength);
    this.customInstructionsControl.setValue(pers.customInstructions);

    const cfg = this.chatState.config();
    this.activeProviderControl.setValue('notrack');
    this.notrackUrlControl.setValue(cfg.baseUrl);
    this.notrackModelControl.setValue(cfg.model);
  }

  savePersonalization() {
    this.chatState.personalization.update((prev) => ({
      ...prev,
      userName: this.userNameControl.value.trim(),
      userInterests: this.userInterestsControl.value.trim(),
      personalNotes: this.personalNotesControl.value.trim(),
      preferredDialect: this.preferredDialectControl.value,
    }));
    alert(this.chatState.language() === 'ar' ? 'تم حفظ التخصيص بنجاح.' : 'Personalization saved.');
  }

  addNewMemory() {
    const k = this.newMemoryKeyControl.value.trim();
    const v = this.newMemoryValControl.value.trim();
    if (!k || !v) return;
    this.chatState.addMemory(k, v);
    this.newMemoryKeyControl.setValue('');
    this.newMemoryValControl.setValue('');
  }

  deleteMemory(id: string) {
    this.chatState.deleteMemory(id);
  }

  clearMemories() {
    if (confirm(this.chatState.language() === 'ar' ? 'مسح جميع عناصر الذاكرة؟' : 'Clear all memory items?')) {
      this.chatState.clearAllMemories();
    }
  }

  saveBehavior() {
    this.chatState.personalization.update((prev) => ({
      ...prev,
      assistantName: this.assistantNameControl.value.trim() || 'جعفر',
      personality: this.personalityControl.value,
      tone: this.toneControl.value,
      responseLength: this.responseLengthControl.value,
      customInstructions: this.customInstructionsControl.value.trim(),
    }));
    alert(this.chatState.language() === 'ar' ? 'تم تطبيق إعدادات سلوك جعفر.' : 'Behavior settings applied.');
  }

  saveNewPin() {
    const curr = this.currentPinControl.value.trim();
    const next = this.newPinControl.value.trim();
    if (!curr || !next) {
      this.pinChangeMessage.set('يرجى ملء الحقول');
      this.pinChangeSuccess.set(false);
      return;
    }
    const ok = this.chatState.changeHiddenPin(curr, next);
    if (ok) {
      this.pinChangeMessage.set('تم تغيير الرمز بنجاح!');
      this.pinChangeSuccess.set(true);
      this.currentPinControl.setValue('');
      this.newPinControl.setValue('');
    } else {
      this.pinChangeMessage.set('الرمز الحالي غير صحيح أو الرمز الجديد قصير.');
      this.pinChangeSuccess.set(false);
    }
  }

  toggleSearchSetting(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.chatState.webSearchSettings.update((prev) => ({ ...prev, enabled: checked }));
  }

  clearAllChats() {
    const isAr = this.chatState.language() === 'ar';
    if (confirm(isAr ? 'هل أنت متأكد من مسح جميع الدردشات السابقة وتنظيف البحث بالكامل؟' : 'Clear all previous chats and search history?')) {
      this.chatState.clearAllConversations();
      alert(isAr ? 'تم مسح جميع الدردشات السابقة وتنظيف السجل والبحث بنجاح.' : 'All chat history and search cleared.');
    }
  }

  clearLocalData() {
    if (confirm(this.chatState.language() === 'ar' ? 'هل أنت متأكد من مسح جميع بيانات المحادثات والإعدادات؟' : 'Clear all data?')) {
      localStorage.clear();
      window.location.reload();
    }
  }

  // Admin Verification Flow
  async verifyAdminAccess() {
    const code = this.adminCodeInputControl.value.trim();
    if (!code) return;

    this.isAdminChecking.set(true);
    this.adminError.set('');

    const res = await this.notrack.verifyAdmin(code);
    this.isAdminChecking.set(false);

    if (res.success) {
      this.isAdminVerified.set(true);
      this.activeAdminCode.set(code);
      this.adminError.set('');
      this.loadAdminConfig(code);
    } else {
      this.adminError.set(res.error || 'رمز الدخول غير صحيح.');
    }
  }

  lockAdmin() {
    this.isAdminVerified.set(false);
    this.activeAdminCode.set('');
    this.adminCodeInputControl.setValue('');
  }

  async loadAdminConfig(code: string) {
    try {
      const cfg = await this.notrack.getAdminConfig(code);
      this.activeProviderControl.setValue('notrack');
      const notrackObj = cfg['notrack'] as { baseUrl?: string; model?: string } | undefined;
      if (notrackObj?.baseUrl) this.notrackUrlControl.setValue(notrackObj.baseUrl);
      if (notrackObj?.model) this.notrackModelControl.setValue(notrackObj.model);
    } catch {
      // ignore
    }
  }

  async testAdminConnection() {
    this.isAdminTesting.set(true);
    this.adminTestResult.set(null);
    try {
      const provider = this.activeProviderControl.value;
      const res = await this.notrack.testConnection(provider);
      this.adminTestResult.set({
        success: res.backendOk && res.notrackOk,
        message: res.statusMessage,
        latencyMs: res.latencyMs,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.adminTestResult.set({
        success: false,
        message: msg || 'فشل الاتصال',
      });
    } finally {
      this.isAdminTesting.set(false);
    }
  }

  async saveAdminKeys() {
    this.isAdminSaving.set(true);
    this.adminSaveStatus.set(null);
    try {
      const payload: Record<string, unknown> = {
        provider: 'notrack',
        notrackKey: this.notrackKeyControl.value.trim() || undefined,
        notrackBaseUrl: this.notrackUrlControl.value.trim() || undefined,
        notrackModel: this.notrackModelControl.value.trim() || undefined,
      };

      await this.notrack.updateAdminKeys(this.activeAdminCode(), payload);
      await this.chatState.refreshConfig();
      this.adminSaveStatus.set({
        success: true,
        message:
          this.chatState.language() === 'ar'
            ? 'تم حفظ مفتاح NoTrack.ai والإعدادات على الخادم بنجاح.'
            : 'Admin keys updated successfully on the server.',
      });
      this.notrackKeyControl.setValue('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.adminSaveStatus.set({
        success: false,
        message: msg || 'حدث خطأ أثناء حفظ الإعدادات.',
      });
    } finally {
      this.isAdminSaving.set(false);
    }
  }
}
