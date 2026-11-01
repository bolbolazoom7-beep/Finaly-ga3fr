import { Injectable, inject, signal, computed, effect } from '@angular/core';
import {
  AppLanguage,
  AppTheme,
  Attachment,
  ChatMessage,
  Conversation,
  DiagnosticResult,
  MemoryItem,
  NoTrackConfig,
  PersonalizationSettings,
  SourceCitation,
  VoiceSettings,
  WebSearchSettings,
} from '../core/types';
import { CairoTimeResponse, NoTrackClient } from './notrack';
import { classifyError, normalizeError } from '../core/error-handler';

const STORAGE_KEY_CONVERSATIONS = 'ja3far_conversations_v2';
const STORAGE_KEY_SETTINGS = 'ja3far_settings_v2';
const STORAGE_KEY_PERSONALIZATION = 'ja3far_personalization_v2';
const STORAGE_KEY_MEMORIES = 'ja3far_memories_v2';
const STORAGE_KEY_HIDDEN_PIN = 'ja3far_hidden_pin_v2';
const STORAGE_KEY_VOICE = 'ja3far_voice_v2';
const STORAGE_KEY_SEARCH = 'ja3far_search_v2';

@Injectable({
  providedIn: 'root',
})
export class ChatState {
  private notrack = inject(NoTrackClient);

  // Core signals
  conversations = signal<Conversation[]>([]);
  currentConversationId = signal<string | null>(null);
  isStreaming = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  searchQuery = signal<string>('');
  theme = signal<AppTheme>('dark');
  language = signal<AppLanguage>('ar');

  // Pending attachments in composer
  pendingAttachments = signal<Attachment[]>([]);

  // Personalization
  personalization = signal<PersonalizationSettings>({
    userName: '',
    userInterests: '',
    personalNotes: '',
    preferredLanguage: 'ar',
    preferredDialect: 'egyptian',
    assistantName: 'جعفر',
    personality: 'friendly_humorous',
    tone: 'casual',
    responseLength: 'medium',
    formattingStyle: 'structured',
    customInstructions: '',
  });

  // Memory items
  memories = signal<MemoryItem[]>([
    {
      id: 'mem_default_1',
      key: 'الاسم المفضل للمساعد',
      value: 'جعفر (Ja3far) - مساعد ذكي مصري ودود وحاذق',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'mem_default_2',
      key: 'اللهجة المفضلة',
      value: 'اللهجة المصرية الذكية والمهذبة',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ]);

  // Hidden chats security
  hiddenChatsUnlocked = signal<boolean>(false);
  hiddenChatsPin = signal<string>('1234');

  // Voice & Audio settings
  voiceSettings = signal<VoiceSettings>({
    autoReadAloud: false,
    speechRate: 1.0,
    speechPitch: 1.0,
    preferredVoiceName: '',
  });

  // Web Search settings
  webSearchSettings = signal<WebSearchSettings>({
    enabled: true,
    autoDetectTopics: true,
  });

  // Temporary (incognito) chat
  isTemporaryChat = signal<boolean>(false);

  // Time in Cairo
  cairoTime = signal<CairoTimeResponse | null>(null);

  // Audio Speech Singleton
  currentlySpeakingMsgId = signal<string | null>(null);
  isSpeaking = signal<boolean>(false);
  isSpeechPaused = signal<boolean>(false);
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private speechKeepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private availableVoices: SpeechSynthesisVoice[] = [];

  config = signal<NoTrackConfig>({
    provider: 'notrack',
    baseUrl: 'https://api.notrack.ai/v1',
    model: 'notrack-uncensored',
    apiKeyMasked: '',
    isCustomConfigured: false,
    status: 'connected',
  });

  diagnosticData = signal<DiagnosticResult | null>(null);

  private currentAbortController: AbortController | null = null;

  // Computed signals
  activeConversation = computed(() => {
    const id = this.currentConversationId();
    if (!id) return null;
    return this.conversations().find((c) => c.id === id) || null;
  });

  currentMessages = computed(() => {
    return this.activeConversation()?.messages || [];
  });

  // Visible (non-hidden, non-temporary) conversations
  visibleConversations = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.conversations().filter((c) => !c.isHidden && !c.isTemporary);
    if (!q) return list;
    return list.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  });

  // Hidden conversations
  hiddenConversations = computed(() => {
    return this.conversations().filter((c) => !!c.isHidden && !c.isTemporary);
  });

  constructor() {
    this.loadStateFromStorage();
    this.refreshConfig();

    // Initialize and start live ticking Cairo Clock (updates every second)
    this.cairoTime.set(this.computeCairoTime());
    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.cairoTime.set(this.computeCairoTime());
      }, 1000);
      this.refreshCairoTime();

      // Load Speech Synthesis voices immediately and on event
      if ('speechSynthesis' in window) {
        this.loadVoices();
        window.speechSynthesis.onvoiceschanged = () => {
          this.loadVoices();
        };
      }
    }

    // Auto-save changes to localStorage (excluding temporary chats)
    effect(() => {
      const nonTemporaryConvs = this.conversations().filter((c) => !c.isTemporary);
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(nonTemporaryConvs));
        } catch {
          // ignore
        }
      }
    });

    effect(() => {
      const th = this.theme();
      const lang = this.language();
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(
            STORAGE_KEY_SETTINGS,
            JSON.stringify({ theme: th, language: lang })
          );
        } catch {
          // ignore
        }
      }
      this.applyThemeAndLanguage(th, lang);
    });

    effect(() => {
      const pers = this.personalization();
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(STORAGE_KEY_PERSONALIZATION, JSON.stringify(pers));
        } catch {
          // ignore
        }
      }
    });

    effect(() => {
      const mems = this.memories();
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(STORAGE_KEY_MEMORIES, JSON.stringify(mems));
        } catch {
          // ignore
        }
      }
    });

    effect(() => {
      const voice = this.voiceSettings();
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(STORAGE_KEY_VOICE, JSON.stringify(voice));
        } catch {
          // ignore
        }
      }
    });

    effect(() => {
      const search = this.webSearchSettings();
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(STORAGE_KEY_SEARCH, JSON.stringify(search));
        } catch {
          // ignore
        }
      }
    });
  }

  computeCairoTime(): CairoTimeResponse {
    const now = new Date();
    try {
      const timeFmt = new Intl.DateTimeFormat('ar-EG', {
        timeZone: 'Africa/Cairo',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true,
      });
      const dateFmt = new Intl.DateTimeFormat('ar-EG', {
        timeZone: 'Africa/Cairo',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const cairoTimeArabic = timeFmt.format(now);
      const cairoDateArabic = dateFmt.format(now);

      const timeFmtEn = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Cairo',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true,
      });
      const dateFmtEn = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Cairo',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      return {
        timestamp: now.getTime(),
        timezone: 'Africa/Cairo',
        cairoDateArabic,
        cairoTimeArabic,
        cairoDateEnglish: dateFmtEn.format(now),
        cairoTimeEnglish: timeFmtEn.format(now),
        fullSummary: `${cairoDateArabic} — ${cairoTimeArabic} بتوقيت القاهرة`,
      };
    } catch {
      return {
        timestamp: now.getTime(),
        timezone: 'Africa/Cairo',
        cairoDateArabic: now.toLocaleDateString('ar-EG'),
        cairoTimeArabic: now.toLocaleTimeString('ar-EG'),
        cairoDateEnglish: now.toLocaleDateString('en-US'),
        cairoTimeEnglish: now.toLocaleTimeString('en-US'),
        fullSummary: `${now.toLocaleDateString('ar-EG')} — ${now.toLocaleTimeString('ar-EG')}`,
      };
    }
  }

  private loadVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      const list = window.speechSynthesis.getVoices();
      if (list && list.length > 0) {
        this.availableVoices = list;
      }
    } catch {
      // ignore
    }
  }

  async refreshCairoTime() {
    try {
      const timeData = await this.notrack.getCairoTime();
      if (timeData) {
        this.cairoTime.set(timeData);
      }
    } catch {
      this.cairoTime.set(this.computeCairoTime());
    }
  }

  private loadStateFromStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return;

    try {
      const savedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.theme) this.theme.set(parsed.theme);
        if (parsed.language) this.language.set(parsed.language);
      }

      const savedConvs = localStorage.getItem(STORAGE_KEY_CONVERSATIONS);
      if (savedConvs) {
        const parsedConvs: Conversation[] = JSON.parse(savedConvs);
        if (Array.isArray(parsedConvs) && parsedConvs.length > 0) {
          this.conversations.set(parsedConvs);
          const firstVisible = parsedConvs.find((c) => !c.isHidden);
          this.currentConversationId.set(firstVisible ? firstVisible.id : parsedConvs[0].id);
        }
      }

      const savedPers = localStorage.getItem(STORAGE_KEY_PERSONALIZATION);
      if (savedPers) {
        const parsedPers = JSON.parse(savedPers);
        this.personalization.update((prev) => ({ ...prev, ...parsedPers }));
      }

      const savedMems = localStorage.getItem(STORAGE_KEY_MEMORIES);
      if (savedMems) {
        const parsedMems = JSON.parse(savedMems);
        if (Array.isArray(parsedMems)) {
          this.memories.set(parsedMems);
        }
      }

      const savedPin = localStorage.getItem(STORAGE_KEY_HIDDEN_PIN);
      if (savedPin) {
        this.hiddenChatsPin.set(savedPin);
      }

      const savedVoice = localStorage.getItem(STORAGE_KEY_VOICE);
      if (savedVoice) {
        this.voiceSettings.update((prev) => ({ ...prev, ...JSON.parse(savedVoice) }));
      }

      const savedSearch = localStorage.getItem(STORAGE_KEY_SEARCH);
      if (savedSearch) {
        this.webSearchSettings.update((prev) => ({ ...prev, ...JSON.parse(savedSearch) }));
      }
    } catch {
      // clean fallback
    }
  }

  applyThemeAndLanguage(theme: AppTheme, lang: AppLanguage) {
    if (typeof document === 'undefined') return;

    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

    const isDark =
      theme === 'dark' ||
      (theme === 'system' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.body.style.backgroundColor = '#111116';
      document.body.style.color = '#E6E4EC';
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#FAF8F5';
      document.body.style.color = '#1C1917';
    }
  }

  async refreshConfig() {
    try {
      const cfg = await this.notrack.getConfig();
      this.config.set(cfg);
    } catch {
      // ignore
    }
  }

  // Conversation Management
  startNewConversation(isTemporary = false): string {
    const id = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newConv: Conversation = {
      id,
      title: isTemporary
        ? (this.language() === 'ar' ? 'دردشة مؤقتة' : 'Temporary Chat')
        : (this.language() === 'ar' ? 'محادثة جديدة' : 'New Chat'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      isHidden: false,
      isTemporary,
    };

    this.conversations.update((prev) => [newConv, ...prev]);
    this.currentConversationId.set(id);
    this.isTemporaryChat.set(isTemporary);
    this.clearAttachments();
    return id;
  }

  startTemporaryChat(): string {
    return this.startNewConversation(true);
  }

  endTemporaryChat() {
    // Remove all temporary chats from state
    this.conversations.update((list) => list.filter((c) => !c.isTemporary));
    this.isTemporaryChat.set(false);
    const visible = this.visibleConversations();
    if (visible.length > 0) {
      this.currentConversationId.set(visible[0].id);
    } else {
      this.startNewConversation(false);
    }
  }

  toggleTemporaryChat() {
    if (this.isTemporaryChat()) {
      this.endTemporaryChat();
    } else {
      this.startTemporaryChat();
    }
  }

  selectConversation(id: string) {
    const conv = this.conversations().find((c) => c.id === id);
    this.isTemporaryChat.set(!!conv?.isTemporary);
    this.currentConversationId.set(id);
    this.clearAttachments();
    this.stopSpeech();
  }

  renameConversation(id: string, newTitle: string) {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    this.conversations.update((list) =>
      list.map((c) => (c.id === id ? { ...c, title: trimmed, updatedAt: Date.now() } : c))
    );
  }

  deleteConversation(id: string) {
    this.conversations.update((list) => list.filter((c) => c.id !== id));
    if (this.currentConversationId() === id) {
      const remaining = this.visibleConversations();
      this.currentConversationId.set(remaining.length > 0 ? remaining[0].id : null);
    }
  }

  deleteCurrentConversation() {
    const id = this.currentConversationId();
    if (id) {
      this.deleteConversation(id);
    }
  }

  clearSearch() {
    this.searchQuery.set('');
  }

  clearAllConversations() {
    this.conversations.set([]);
    this.currentConversationId.set(null);
    this.stopSpeech();
  }

  // Hidden Chats Logic
  toggleHideConversation(id: string) {
    this.conversations.update((list) =>
      list.map((c) => {
        if (c.id === id) {
          const nextHidden = !c.isHidden;
          return { ...c, isHidden: nextHidden };
        }
        return c;
      })
    );

    // If current conversation was just hidden and hidden section is not open, switch to another visible chat
    const conv = this.conversations().find((c) => c.id === id);
    if (conv?.isHidden && !this.hiddenChatsUnlocked() && this.currentConversationId() === id) {
      const visible = this.visibleConversations();
      this.currentConversationId.set(visible.length > 0 ? visible[0].id : null);
    }
  }

  unlockHiddenChats(pin: string): boolean {
    if (pin === this.hiddenChatsPin()) {
      this.hiddenChatsUnlocked.set(true);
      return true;
    }
    return false;
  }

  lockHiddenChats() {
    this.hiddenChatsUnlocked.set(false);
    // If active conversation is hidden, navigate away
    if (this.activeConversation()?.isHidden) {
      const visible = this.visibleConversations();
      this.currentConversationId.set(visible.length > 0 ? visible[0].id : null);
    }
  }

  changeHiddenPin(currentPin: string, newPin: string): boolean {
    if (currentPin !== this.hiddenChatsPin()) return false;
    if (!newPin || newPin.length < 4) return false;
    this.hiddenChatsPin.set(newPin);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY_HIDDEN_PIN, newPin);
    }
    return true;
  }

  // Memory Management
  addMemory(key: string, value: string) {
    const k = key.trim();
    const v = value.trim();
    if (!k || !v) return;
    const newItem: MemoryItem = {
      id: `mem_${Date.now()}`,
      key: k,
      value: v,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.memories.update((prev) => [newItem, ...prev]);
  }

  updateMemory(id: string, key: string, value: string) {
    const k = key.trim();
    const v = value.trim();
    if (!k || !v) return;
    this.memories.update((list) =>
      list.map((m) => (m.id === id ? { ...m, key: k, value: v, updatedAt: Date.now() } : m))
    );
  }

  deleteMemory(id: string) {
    this.memories.update((list) => list.filter((m) => m.id !== id));
  }

  clearAllMemories() {
    this.memories.set([]);
  }

  // Attachments Handling
  addAttachment(att: Attachment) {
    this.pendingAttachments.update((prev) => [...prev, att]);
  }

  removeAttachment(id: string) {
    this.pendingAttachments.update((prev) => prev.filter((a) => a.id !== id));
  }

  clearAttachments() {
    this.pendingAttachments.set([]);
  }

  // Text-To-Speech Singleton Audio Player with Chrome bug workarounds & sentence splitting
  speakMessage(messageId: string, text: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert(
        this.language() === 'ar'
          ? 'المتصفح الحالي لا يدعم تحويل النص إلى كلام (TTS).'
          : 'Speech synthesis is not supported in this browser.'
      );
      return;
    }

    // If currently speaking this message and paused, resume
    if (this.currentlySpeakingMsgId() === messageId && this.isSpeechPaused()) {
      this.resumeSpeech();
      return;
    }

    // If already playing this message, toggle pause
    if (this.currentlySpeakingMsgId() === messageId && this.isSpeaking()) {
      this.pauseSpeech();
      return;
    }

    // Stop existing speech
    this.stopSpeech();

    // Clean text from markdown syntax
    const cleanText = text
      .replace(/```[\s\S]*?```/g, 'كود برمجي')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\$\$[\s\S]*?\$\$/g, 'معادلة رياضية')
      .replace(/\$([^$]+)\$/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[#*>\-_~]/g, '')
      .replace(/https?:\/\/\S+/g, 'رابط')
      .trim();

    if (!cleanText) return;

    // Wake up synthesis engine in Chromium
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();

    // Split text by sentence to bypass Chrome's 200+ char / 15s stall bug
    const rawSentences = cleanText.split(/([.!\n؟،]+)/);
    const sentences: string[] = [];
    for (let i = 0; i < rawSentences.length; i += 2) {
      const part = (rawSentences[i] || '') + (rawSentences[i + 1] || '');
      if (part.trim()) sentences.push(part.trim());
    }
    const queue = sentences.length > 0 ? sentences : [cleanText];

    this.currentlySpeakingMsgId.set(messageId);
    this.isSpeaking.set(true);
    this.isSpeechPaused.set(false);

    this.playSpeechQueue(messageId, queue, 0);
  }

  private playSpeechQueue(messageId: string, queue: string[], index: number) {
    if (index >= queue.length || this.currentlySpeakingMsgId() !== messageId) {
      this.stopSpeech();
      return;
    }

    const sentence = queue[index];
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.rate = this.voiceSettings().speechRate || 1.0;
    utterance.pitch = this.voiceSettings().speechPitch || 1.0;

    const voices = this.availableVoices.length > 0 ? this.availableVoices : window.speechSynthesis.getVoices();
    const arabicVoice =
      voices.find((v) => v.name === this.voiceSettings().preferredVoiceName) ||
      voices.find((v) => v.lang === 'ar-EG') ||
      voices.find((v) => v.lang.startsWith('ar')) ||
      null;

    if (arabicVoice) {
      utterance.voice = arabicVoice;
      utterance.lang = arabicVoice.lang;
    } else {
      utterance.lang = this.language() === 'ar' ? 'ar' : 'en-US';
    }

    utterance.onend = () => {
      if (this.currentlySpeakingMsgId() === messageId) {
        this.playSpeechQueue(messageId, queue, index + 1);
      }
    };

    utterance.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        if (this.currentlySpeakingMsgId() === messageId) {
          this.playSpeechQueue(messageId, queue, index + 1);
        }
      }
    };

    this.activeUtterance = utterance;

    // Fix Chromium queue pause bug: resume then speak
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);

    // Keep synthesis engine alive (prevents Chrome 15-second hang)
    if (!this.speechKeepAliveTimer) {
      this.speechKeepAliveTimer = setInterval(() => {
        if (this.isSpeaking() && window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 10000);
    }
  }

  pauseSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
      this.isSpeechPaused.set(true);
    }
  }

  resumeSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
      this.isSpeechPaused.set(false);
    }
  }

  stopSpeech() {
    if (this.speechKeepAliveTimer) {
      clearInterval(this.speechKeepAliveTimer);
      this.speechKeepAliveTimer = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.currentlySpeakingMsgId.set(null);
    this.isSpeaking.set(false);
    this.isSpeechPaused.set(false);
    this.activeUtterance = null;
  }

  stopStreaming() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
    this.isStreaming.set(false);
    this.isLoading.set(false);
  }

  async sendMessage(userText: string) {
    const text = userText.trim();
    const currentAttachments = [...this.pendingAttachments()];
    if ((!text && currentAttachments.length === 0) || this.isStreaming()) return;

    this.stopSpeech();

    let convId = this.currentConversationId();
    if (!convId) {
      convId = this.startNewConversation();
    }

    const userMessage: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      status: 'complete',
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
    };

    // Clear composer attachments immediately
    this.clearAttachments();

    const assistantMessageId = `msg_a_${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming',
      sources: [],
    };

    // Update conversation title if first message
    const currentConv = this.activeConversation();
    const shouldUpdateTitle = !currentConv || currentConv.messages.length === 0;
    const titleSource = text || (currentAttachments[0]?.name ? `ملف: ${currentAttachments[0].name}` : 'محادثة');
    const newTitle = shouldUpdateTitle
      ? titleSource.length > 30
        ? titleSource.substring(0, 30) + '...'
        : titleSource
      : currentConv.title;

    this.conversations.update((list) =>
      list.map((c) => {
        if (c.id === convId) {
          return {
            ...c,
            title: newTitle,
            updatedAt: Date.now(),
            messages: [...c.messages, userMessage, assistantMessage],
          };
        }
        return c;
      })
    );

    this.isStreaming.set(true);
    this.isLoading.set(true);
    this.currentAbortController = new AbortController();

    // Prepare payload context with personalization, memories, and time
    const contextPayload = {
      ...this.personalization(),
      memories: this.memories().map((m) => ({ key: m.key, value: m.value })),
    };

    const messagesPayload = (this.activeConversation()?.messages || [])
      .filter((m) => m.id !== assistantMessageId && m.status !== 'error')
      .map((m) => ({ role: m.role, content: m.content }));

    let streamedAccumulator = '';
    const collectedSources: SourceCitation[] = [];

    await this.notrack.streamChat(
      messagesPayload,
      {
        context: contextPayload,
        attachments: userMessage.attachments,
        enableSearch: this.webSearchSettings().enabled,
      },
      {
        onToken: (token) => {
          this.isLoading.set(false);
          streamedAccumulator += token;

          this.conversations.update((list) =>
            list.map((c) => {
              if (c.id === convId) {
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, content: streamedAccumulator }
                      : m
                  ),
                };
              }
              return c;
            })
          );
        },
        onSources: (sources) => {
          for (const s of sources) {
            if (!collectedSources.some((item) => item.url === s.url)) {
              collectedSources.push(s);
            }
          }
          this.conversations.update((list) =>
            list.map((c) => {
              if (c.id === convId) {
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, sources: [...collectedSources] }
                      : m
                  ),
                };
              }
              return c;
            })
          );
        },
        onComplete: () => {
          this.isStreaming.set(false);
          this.isLoading.set(false);
          this.currentAbortController = null;

          this.conversations.update((list) =>
            list.map((c) => {
              if (c.id === convId) {
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMessageId
                      ? {
                          ...m,
                          status: 'complete',
                          sources: collectedSources.length > 0 ? collectedSources : undefined,
                        }
                      : m
                  ),
                };
              }
              return c;
            })
          );
        },
        onError: (err, statusCode) => {
          this.isStreaming.set(false);
          this.isLoading.set(false);
          this.currentAbortController = null;

          const category = classifyError(statusCode, err);
          const normalized = normalizeError(category, this.language(), statusCode);

          // Always display the specific server error message when available
          const displayMessage =
            err && err.trim().length > 0
              ? err
              : `${normalized.message} (${normalized.recoveryAction})`;

          this.conversations.update((list) =>
            list.map((c) => {
              if (c.id === convId) {
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMessageId
                      ? {
                          ...m,
                          status: 'error',
                          errorCategory: category,
                          errorMessage: displayMessage,
                        }
                      : m
                  ),
                };
              }
              return c;
            })
          );
        },
      },
      this.currentAbortController.signal
    );
  }

  async regenerateResponse(assistantMessageId: string) {
    if (this.isStreaming()) return;
    const conv = this.activeConversation();
    if (!conv) return;

    const msgIdx = conv.messages.findIndex((m) => m.id === assistantMessageId);
    if (msgIdx <= 0) return;

    const trimmedMessages = conv.messages.slice(0, msgIdx);
    const lastUserMsg = trimmedMessages[trimmedMessages.length - 1];
    if (!lastUserMsg || lastUserMsg.role !== 'user') return;

    this.conversations.update((list) =>
      list.map((c) => (c.id === conv.id ? { ...c, messages: trimmedMessages } : c))
    );

    if (lastUserMsg.attachments) {
      this.pendingAttachments.set(lastUserMsg.attachments);
    }
    await this.sendMessage(lastUserMsg.content);
  }

  async editAndResend(userMessageId: string, newContent: string) {
    if (this.isStreaming()) return;
    const conv = this.activeConversation();
    if (!conv) return;

    const msgIdx = conv.messages.findIndex((m) => m.id === userMessageId);
    if (msgIdx < 0) return;

    const targetMsg = conv.messages[msgIdx];
    const trimmed = conv.messages.slice(0, msgIdx);
    this.conversations.update((list) =>
      list.map((c) => (c.id === conv.id ? { ...c, messages: trimmed } : c))
    );

    if (targetMsg.attachments) {
      this.pendingAttachments.set(targetMsg.attachments);
    }
    await this.sendMessage(newContent);
  }

  setTheme(th: AppTheme) {
    this.theme.set(th);
  }

  setLanguage(lang: AppLanguage) {
    this.language.set(lang);
  }

  exportDataJson(): string {
    return JSON.stringify(
      {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        personalization: this.personalization(),
        memories: this.memories(),
        conversations: this.conversations(),
      },
      null,
      2
    );
  }

  importDataJson(rawJson: string): boolean {
    try {
      const data = JSON.parse(rawJson);
      if (Array.isArray(data.conversations)) {
        this.conversations.set(data.conversations);
        if (data.conversations.length > 0) {
          const first = data.conversations.find((c: Conversation) => !c.isHidden);
          this.currentConversationId.set(first ? first.id : data.conversations[0].id);
        }
      }
      if (data.personalization) {
        this.personalization.set(data.personalization);
      }
      if (Array.isArray(data.memories)) {
        this.memories.set(data.memories);
      }
      return true;
    } catch {
      return false;
    }
  }
}
