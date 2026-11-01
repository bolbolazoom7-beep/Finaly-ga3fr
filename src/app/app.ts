import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Composer } from './components/composer';
import { MessageItem } from './components/message-item';
import { HistoryDrawer } from './components/history-drawer';
import { SettingsDialog } from './components/settings-dialog';
import { DiagnosticsModal } from './components/diagnostics-modal';
import { ChatState } from './services/chat-state';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [
    MatIconModule,
    Composer,
    MessageItem,
    HistoryDrawer,
    SettingsDialog,
    DiagnosticsModal,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  chatState = inject(ChatState);

  @ViewChild('scrollContainer') scrollContainer?: ElementRef<HTMLDivElement>;

  isHistoryOpen = signal<boolean>(false);
  isSettingsOpen = signal<boolean>(false);
  isDiagnosticsOpen = signal<boolean>(false);

  isNearBottom = true;
  showScrollBottom = signal<boolean>(false);

  promptStarters = computed(() => {
    const isAr = this.chatState.language() === 'ar';
    if (isAr) {
      return [
        { text: 'ما هي آخر أخبار ونتائج مباريات الأهلي والزمالك والدوري اليوم؟', icon: 'sports_soccer' },
        { text: 'اشرح لي نظرية فيزيائية مع معادلة بـ LaTeX وجدول مقارنة منظم', icon: 'functions' },
        { text: 'اكتب دالة بلغة TypeScript للتحقق من أمان الروابط مع كود كامل', icon: 'code' },
        { text: 'صغ لي رسالة اعتذار رسمية ولبقة بروح مصرية راقية', icon: 'mail_outline' },
      ];
    }
    return [
      { text: 'What are today’s latest football matches and scores with live sources?', icon: 'sports_soccer' },
      { text: 'Explain a mathematical theorem using LaTeX and comparison table', icon: 'functions' },
      { text: 'Write a TypeScript utility with SSRF protection and tests', icon: 'code' },
      { text: 'Introduce yourself and your custom personality and memory capabilities', icon: 'auto_awesome' },
    ];
  });

  constructor() {
    // Ultra-fluid 120fps autoscroll during response streaming and message updates
    effect(() => {
      const msgs = this.chatState.currentMessages();

      if (msgs.length === 0) {
        this.isNearBottom = true;
        this.showScrollBottom.set(false);
        return;
      }

      if (this.isNearBottom) {
        requestAnimationFrame(() => {
          if (this.scrollContainer?.nativeElement) {
            const el = this.scrollContainer.nativeElement;
            el.scrollTop = el.scrollHeight;
          }
        });
      } else {
        this.showScrollBottom.set(true);
      }
    });

    if (typeof window !== 'undefined') {
      this.setupNativeAppTouchGuards();
    }
  }

  onScroll(event: Event) {
    const el = event.target as HTMLElement;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    this.isNearBottom = distanceToBottom <= 140;
    this.showScrollBottom.set(!this.isNearBottom && this.chatState.currentMessages().length > 0);
  }

  scrollToBottom(smooth = true) {
    if (!this.scrollContainer?.nativeElement) return;
    const el = this.scrollContainer.nativeElement;
    requestAnimationFrame(() => {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
      this.isNearBottom = true;
      this.showScrollBottom.set(false);
    });
  }

  private setupNativeAppTouchGuards() {
    // 1. Block multi-finger pinch gestures (two fingers zoom in / out)
    const preventPinch = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };
    window.addEventListener('touchstart', preventPinch, { passive: false });
    window.addEventListener('touchmove', preventPinch, { passive: false });

    // 2. Block WebKit / Safari gesture zooming events
    const preventGesture = (e: Event) => {
      e.preventDefault();
    };
    window.addEventListener('gesturestart', preventGesture as EventListener, { passive: false });
    window.addEventListener('gesturechange', preventGesture as EventListener, { passive: false });
    window.addEventListener('gestureend', preventGesture as EventListener, { passive: false });

    // 3. Block double-tap to zoom on mobile while preserving typing cursor taps in inputs
    let lastTouchEnd = 0;
    window.addEventListener(
      'touchend',
      (e: TouchEvent) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
          const target = e.target as HTMLElement | null;
          const isInput =
            target &&
            (target.tagName === 'INPUT' ||
              target.tagName === 'TEXTAREA' ||
              target.isContentEditable);
          if (!isInput) {
            e.preventDefault();
          }
        }
        lastTouchEnd = now;
      },
      { passive: false }
    );

    // 4. Block trackpad / Ctrl + Wheel zooming on desktop/tablets
    window.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        if (e.ctrlKey) {
          e.preventDefault();
        }
      },
      { passive: false }
    );

    // 5. Block long-press context menu and browser copy/paste/callout bars outside of text inputs
    window.addEventListener('contextmenu', (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (!isInput) {
        e.preventDefault();
        return false;
      }
      return true;
    });

    // 6. Block text selection dragging outside inputs and textareas
    window.addEventListener('selectstart', (e: Event) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (!isInput) {
        e.preventDefault();
        return false;
      }
      return true;
    });
  }

  toggleQuickTheme() {
    const next = this.chatState.theme() === 'dark' ? 'light' : 'dark';
    this.chatState.setTheme(next);
  }

  onDeleteCurrentChat() {
    const isAr = this.chatState.language() === 'ar';
    if (confirm(isAr ? 'هل أنت متأكد من مسح هذه المحادثة بالكامل؟' : 'Clear this conversation?')) {
      this.chatState.deleteCurrentConversation();
    }
  }
}
