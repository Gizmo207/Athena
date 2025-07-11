export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  hasError?: boolean;
  metadata?: {
    model?: string;
    tokens?: number;
    processingTime?: number;
    factCount?: number;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
  };
}

export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  settings?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
  isArchived?: boolean;
  userId?: string;
}

export interface SessionStore {
  sessions: Record<string, Session>;
  currentSessionId: string | null;
  settings: {
    theme: 'light' | 'dark';
    fontSize: 'small' | 'medium' | 'large';
    autoSave: boolean;
    typewriterSpeed: number;
  };
}

export interface ProcessedMessage {
  original: string;
  processed: string;
  chunks: string[];
  metadata: {
    wordCount: number;
    estimatedReadTime: number;
  };
}
