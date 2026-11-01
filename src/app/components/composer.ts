import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ChatState } from '../services/chat-state';
import { Attachment } from '../core/types';

interface SpeechRecognitionResultItem {
  transcript: string;
}

type SpeechRecognitionResult = Record<number, SpeechRecognitionResultItem>;

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: Record<number, SpeechRecognitionResult> & { length: number };
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

interface WindowWithSpeech extends Window {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
}

@Component({
  selector: 'app-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    <div class="relative w-full max-w-4xl mx-auto px-3 sm:px-4 pb-1.5 sm:pb-2">
      <!-- Hidden image and camera inputs (Images only) -->
      <input
        #fileInput
        type="file"
        multiple
        class="hidden"
        (change)="onFilesSelected($event)"
        accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
      />
      <input
        #cameraInput
        type="file"
        accept="image/png,image/jpeg,image/webp"
        capture="environment"
        class="hidden"
        (change)="onFilesSelected($event)"
      />

      <div
        class="relative flex flex-col rounded-2xl border shadow-lg transition-all duration-200 focus-within:ring-2 focus-within:ring-[#A994F7]/25"
        [class]="chatState.theme() === 'dark'
          ? 'bg-[#181820] border-white/10 focus-within:border-[#A994F7]/60'
          : 'bg-[#FFFFFF] border-black/15 focus-within:border-[#7C5CE6] shadow-sm'"
      >
        <!-- Pending Image Attachments Preview Shelf -->
        @if (chatState.pendingAttachments().length > 0) {
          <div class="flex items-center gap-2 p-2.5 overflow-x-auto border-b border-white/5 dark:border-white/5 light:border-black/5">
            @for (att of chatState.pendingAttachments(); track att.id) {
              <div
                class="relative group shrink-0 flex items-center gap-2 pr-2 pl-1 py-1 rounded-xl text-xs border"
                [class]="chatState.theme() === 'dark'
                  ? 'bg-white/5 border-white/10 text-[#E6E4EC]'
                  : 'bg-black/5 border-black/10 text-stone-800'"
              >
                <img
                  [src]="att.dataUrl"
                  [alt]="att.name"
                  class="w-8 h-8 rounded-lg object-cover border border-white/10"
                  referrerpolicy="no-referrer"
                />
                <span class="truncate max-w-[120px] text-[11px] font-mono">{{ att.name }}</span>
                <button
                  type="button"
                  (click)="removeAttachment(att.id)"
                  class="p-0.5 rounded-full hover:bg-rose-500/20 text-[#A6A2B3] hover:text-rose-400 transition-colors cursor-pointer"
                  [attr.aria-label]="chatState.language() === 'ar' ? 'إزالة الصورة' : 'Remove image'"
                >
                  <mat-icon style="font-size: 14px; width: 14px; height: 14px;">close</mat-icon>
                </button>
              </div>
            }
          </div>
        }

        <!-- Audio Recording Banner if active -->
        @if (isRecordingVoice()) {
          <div class="flex items-center justify-between px-4 py-2.5 bg-rose-500/15 text-rose-300 border-b border-rose-500/30 text-xs animate-pulse">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-rose-500 animate-ping"></span>
              <span class="font-bold">
                {{ chatState.language() === 'ar' ? 'الميكروفون نشط... تحدث لجعفر بالعامية أو الفصحى' : 'Listening... Speak to Ja3far' }}
              </span>
            </div>
            <button
              type="button"
              (click)="stopVoiceRecording()"
              class="px-2.5 py-1 rounded-lg bg-rose-500/25 hover:bg-rose-500/40 text-rose-100 text-xs font-bold transition-all cursor-pointer"
            >
              {{ chatState.language() === 'ar' ? 'إيقاف التسجيل' : 'Stop' }}
            </button>
          </div>
        }

        <!-- Textarea Field -->
        <textarea
          #textareaRef
          [formControl]="inputControl"
          (keydown)="handleKeyDown($event)"
          (input)="adjustHeight()"
          rows="1"
          [placeholder]="
            chatState.language() === 'ar'
              ? 'تحدث مع جعفر... (اسأل، ارفع صورة، أو اطلب بحثاً حياً)'
              : 'Message Ja3far... (Ask, attach photo, or search web)'
          "
          class="w-full resize-none bg-transparent px-4 py-3 text-sm md:text-base focus:outline-none max-h-48 overflow-y-auto leading-relaxed"
          [class]="chatState.theme() === 'dark'
            ? 'text-[#E6E4EC] placeholder-[#A6A2B3]/60'
            : 'text-stone-900 placeholder-stone-400'"
          [attr.aria-label]="
            chatState.language() === 'ar' ? 'حقل إدخال الرسالة' : 'Message input field'
          "
        ></textarea>

        <!-- Composer Toolbar -->
        <div class="flex items-center justify-between px-3 py-2 border-t"
          [class]="chatState.theme() === 'dark' ? 'border-white/5' : 'border-black/5'"
        >
          <!-- Left: Image Attachment, Camera, Mic, Web Search badge -->
          <div class="flex items-center gap-1 sm:gap-1.5">
            <!-- Image Attachment Button (Images Only) -->
            <button
              type="button"
              (click)="triggerFileInput()"
              class="p-1.5 sm:p-2 rounded-xl text-[#A6A2B3] hover:text-white dark:hover:text-white light:hover:text-stone-900 hover:bg-white/5 dark:hover:bg-white/5 light:hover:bg-black/5 transition-colors cursor-pointer"
              [attr.title]="chatState.language() === 'ar' ? 'إرفاق صورة' : 'Attach image'"
              [attr.aria-label]="chatState.language() === 'ar' ? 'إرفاق صورة' : 'Attach image'"
            >
              <mat-icon style="font-size: 19px; width: 19px; height: 19px;">add_photo_alternate</mat-icon>
            </button>

            <!-- Camera Capture Button -->
            <button
              type="button"
              (click)="triggerCameraInput()"
              class="p-1.5 sm:p-2 rounded-xl text-[#A6A2B3] hover:text-white dark:hover:text-white light:hover:text-stone-900 hover:bg-white/5 dark:hover:bg-white/5 light:hover:bg-black/5 transition-colors cursor-pointer"
              [attr.title]="chatState.language() === 'ar' ? 'التقاط صورة بالكاميرا' : 'Take photo with camera'"
              [attr.aria-label]="chatState.language() === 'ar' ? 'التقاط صورة بالكاميرا' : 'Take photo with camera'"
            >
              <mat-icon style="font-size: 19px; width: 19px; height: 19px;">photo_camera</mat-icon>
            </button>

            <!-- Voice Dictation / Recording Button -->
            <button
              type="button"
              (click)="toggleVoiceRecording()"
              class="p-1.5 sm:p-2 rounded-xl transition-colors cursor-pointer"
              [class]="isRecordingVoice()
                ? 'bg-rose-500/25 text-rose-400 animate-pulse'
                : 'text-[#A6A2B3] hover:text-white dark:hover:text-white light:hover:text-stone-900 hover:bg-white/5 dark:hover:bg-white/5 light:hover:bg-black/5'"
              [attr.title]="chatState.language() === 'ar' ? (isRecordingVoice() ? 'إيقاف التسجيل الصوتي' : 'تسجيل صوتي (تحدث لجعفر)') : 'Voice recording'"
              [attr.aria-label]="chatState.language() === 'ar' ? 'تسجيل صوتي' : 'Voice recording'"
            >
              <mat-icon style="font-size: 19px; width: 19px; height: 19px;">
                {{ isRecordingVoice() ? 'mic' : 'mic_none' }}
              </mat-icon>
            </button>

            <!-- Live Search Indicator Chip -->
            <button
              type="button"
              (click)="toggleWebSearch()"
              class="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-medium border transition-all cursor-pointer"
              [class]="chatState.webSearchSettings().enabled
                ? 'bg-[#8BCFC2]/15 text-[#8BCFC2] dark:text-[#8BCFC2] light:text-teal-700 border-[#8BCFC2]/30'
                : 'bg-white/5 text-[#A6A2B3] border-transparent'"
              [attr.title]="chatState.language() === 'ar' ? 'تبديل البحث الحي على الإنترنت' : 'Toggle live web search'"
            >
              <mat-icon style="font-size: 14px; width: 14px; height: 14px;">travel_explore</mat-icon>
              <span>{{ chatState.language() === 'ar' ? (chatState.webSearchSettings().enabled ? 'بحث حي' : 'البحث معطل') : (chatState.webSearchSettings().enabled ? 'Live Search' : 'Search Off') }}</span>
            </button>
          </div>

          <!-- Right: Status & Send / Stop -->
          <div class="flex items-center gap-2">
            <!-- Cairo Time chip on desktop (Live ticking) -->
            @if (chatState.cairoTime(); as time) {
              <div class="hidden md:flex items-center gap-1 text-[11px] text-[#A6A2B3] dark:text-[#A6A2B3] light:text-stone-500 font-mono">
                <mat-icon style="font-size: 13px; width: 13px; height: 13px;">schedule</mat-icon>
                <span>{{ time.cairoTimeArabic }}</span>
              </div>
            }

            @if (chatState.isStreaming()) {
              <button
                type="button"
                (click)="chatState.stopStreaming()"
                class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 dark:text-rose-300 light:text-rose-700 text-xs font-medium border border-rose-500/20 transition-all cursor-pointer"
                [attr.aria-label]="chatState.language() === 'ar' ? 'إيقاف التوليد' : 'Stop generation'"
              >
                <mat-icon style="font-size: 16px; width: 16px; height: 16px;">stop</mat-icon>
                <span>{{ chatState.language() === 'ar' ? 'إيقاف' : 'Stop' }}</span>
              </button>
            } @else {
              <button
                type="button"
                (click)="submit()"
                [disabled]="!hasContent()"
                class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-[#A994F7] text-[#111116] hover:bg-[#BDB0F9] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm active:scale-95"
                [attr.aria-label]="chatState.language() === 'ar' ? 'إرسال الرسالة' : 'Send message'"
              >
                <mat-icon style="font-size: 18px; width: 18px; height: 18px;">
                  arrow_upward
                </mat-icon>
              </button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class Composer {
  chatState = inject(ChatState);

  @ViewChild('textareaRef') textareaRef!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('cameraInput') cameraInput!: ElementRef<HTMLInputElement>;

  inputControl = new FormControl<string>('', { nonNullable: true });
  isRecordingVoice = signal<boolean>(false);
  private speechRecognition: BrowserSpeechRecognition | null = null;
  private micStream: MediaStream | null = null;

  hasContent(): boolean {
    return (
      this.inputControl.value.trim().length > 0 ||
      this.chatState.pendingAttachments().length > 0
    );
  }

  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submit();
    }
  }

  adjustHeight() {
    if (!this.textareaRef) return;
    const el = this.textareaRef.nativeElement;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }

  triggerFileInput() {
    this.fileInput?.nativeElement?.click();
  }

  triggerCameraInput() {
    this.cameraInput?.nativeElement?.click();
  }

  toggleWebSearch() {
    this.chatState.webSearchSettings.update((prev) => ({
      ...prev,
      enabled: !prev.enabled,
    }));
  }

  // Handle image files selection (Images only - Documents removed as requested)
  async onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    let rejectedDocsCount = 0;

    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i];
      if (!file.type.startsWith('image/')) {
        rejectedDocsCount++;
        continue;
      }

      const dataUrl = await this.readFileAsDataUrl(file);
      const att: Attachment = {
        id: `att_${Date.now()}_${i}`,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'image/jpeg',
        dataUrl,
        type: 'image',
      };

      this.chatState.addAttachment(att);
    }

    if (rejectedDocsCount > 0) {
      alert(
        this.chatState.language() === 'ar'
          ? 'عذراً، ميزة رفع المستندات معطلة. تم قبول الصور فقط.'
          : 'Document uploads are disabled. Only image files were accepted.'
      );
    }

    input.value = '';
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  removeAttachment(id: string) {
    this.chatState.removeAttachment(id);
  }

  // Voice recording and dictation
  toggleVoiceRecording() {
    if (this.isRecordingVoice()) {
      this.stopVoiceRecording();
    } else {
      this.startVoiceRecording();
    }
  }

  async startVoiceRecording() {
    if (typeof window === 'undefined') return;

    // First request microphone permission via getUserMedia
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        alert(
          this.chatState.language() === 'ar'
            ? 'يرجى السماح للتطبيق باستخدام الميكروفون من إعدادات المتصفح.'
            : 'Please allow microphone access in your browser.'
        );
        return;
      }
    }

    const win = window as unknown as WindowWithSpeech;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      this.isRecordingVoice.set(true);
      alert(
        this.chatState.language() === 'ar'
          ? 'المتصفح لا يدعم التعرف الصوتي المباشر. الميكروفون نشط، يمكنك أيضاً استخدام الإملاء الصوتي من لوحة المفاتيح.'
          : 'Browser does not support native speech recognition. Please use keyboard dictation.'
      );
      return;
    }

    try {
      this.speechRecognition = new SpeechRec();
      this.speechRecognition.lang =
        this.chatState.personalization().preferredDialect === 'english'
          ? 'en-US'
          : 'ar-EG'; // Egyptian Arabic dictation!
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = true;

      this.speechRecognition.onstart = () => {
        this.isRecordingVoice.set(true);
      };

      this.speechRecognition.onresult = (event: SpeechRecognitionEvent) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (item[0]?.transcript) {
            currentTranscript += item[0].transcript;
          }
        }
        if (currentTranscript.trim()) {
          const prev = this.inputControl.value ? this.inputControl.value + ' ' : '';
          this.inputControl.setValue(prev + currentTranscript.trim());
          this.adjustHeight();
        }
      };

      this.speechRecognition.onerror = () => {
        this.stopVoiceRecording();
      };

      this.speechRecognition.onend = () => {
        if (this.isRecordingVoice()) {
          // Attempt graceful continue
          try {
            this.speechRecognition?.start();
          } catch {
            this.stopVoiceRecording();
          }
        }
      };

      this.speechRecognition.start();
    } catch {
      this.stopVoiceRecording();
    }
  }

  stopVoiceRecording() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.speechRecognition) {
      try {
        this.speechRecognition.stop();
      } catch {
        // ignore
      }
      this.speechRecognition = null;
    }
    this.isRecordingVoice.set(false);
  }

  submit() {
    const val = this.inputControl.value.trim();
    if (!this.hasContent() || this.chatState.isStreaming()) return;

    this.stopVoiceRecording();
    this.chatState.sendMessage(val);
    this.inputControl.setValue('');
    if (this.textareaRef) {
      this.textareaRef.nativeElement.style.height = 'auto';
    }
  }
}
