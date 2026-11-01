export type Role = 'user' | 'assistant' | 'system';

export type MessageStatus = 'sending' | 'streaming' | 'complete' | 'error';

export type ErrorCategory =
  | 'CONFIGURATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'PROVIDER_ERROR'
  | 'RATE_LIMIT'
  | 'QUOTA_OR_BILLING_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'BACKEND_ERROR'
  | 'STORAGE_ERROR'
  | 'DEPLOYMENT_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNSUPPORTED_CAPABILITY'
  | 'UNKNOWN_ERROR';

export interface Attachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  dataUrl: string; // Base64 data URI
  type: 'image';
}

export interface SourceCitation {
  title: string;
  url: string;
  snippet?: string;
  date?: string;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  status: MessageStatus;
  errorCategory?: ErrorCategory;
  errorMessage?: string;
  tokenCount?: number;
  attachments?: Attachment[];
  sources?: SourceCitation[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  isHidden?: boolean;
  isTemporary?: boolean;
}

export type DialectType = 'egyptian' | 'saudi' | 'levantine' | 'msa' | 'english';
export type PersonalityType = 'friendly_humorous' | 'professional' | 'concise' | 'creative';
export type ToneType = 'casual' | 'formal';
export type ResponseLengthType = 'concise' | 'medium' | 'detailed';
export type FormattingStyleType = 'structured' | 'conversational' | 'code_heavy';

export interface PersonalizationSettings {
  userName: string;
  userInterests: string;
  personalNotes: string;
  preferredLanguage: 'ar' | 'en';
  preferredDialect: DialectType;
  assistantName: string;
  personality: PersonalityType;
  tone: ToneType;
  responseLength: ResponseLengthType;
  formattingStyle: FormattingStyleType;
  customInstructions: string;
}

export interface MemoryItem {
  id: string;
  key: string;
  value: string;
  createdAt: number;
  updatedAt: number;
}

export interface VoiceSettings {
  autoReadAloud: boolean;
  speechRate: number; // 0.8 - 1.2
  speechPitch: number; // 0.8 - 1.2
  preferredVoiceName?: string;
}

export interface WebSearchSettings {
  enabled: boolean;
  autoDetectTopics: boolean;
}

export interface NoTrackConfig {
  baseUrl: string;
  model: string;
  apiKeyMasked: string;
  isCustomConfigured: boolean;
  status: 'connected' | 'not_configured' | 'error' | 'testing';
  lastChecked?: number;
  lastLatencyMs?: number;
  provider?: 'notrack';
}

export interface DiagnosticResult {
  frontendOk: boolean;
  backendOk: boolean;
  notrackOk: boolean;
  latencyMs?: number;
  statusMessage: string;
  category?: ErrorCategory;
  timestamp: number;
  activeModel: string;
  version: string;
}

export type AppTheme = 'dark' | 'light' | 'system';
export type AppLanguage = 'ar' | 'en';
