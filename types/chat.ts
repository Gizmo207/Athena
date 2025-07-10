// Core chat types
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatState {
  messages: Message[];
  shortTermBuffer: ChatMessage[];
  isLoading: boolean;
  currentAgent: Agent;
  sessionId: string;
}

export interface Message {
  id: number;
  message: string;
  sender: 'user' | 'agent' | 'system';
}

// Agent types
export interface Agent {
  id: string;
  name: string;
  purpose?: string;
  isOverseer?: boolean;
}

// API types
export interface ChatRequest {
  userId: string;
  message: string;
  shortTermBuffer: ChatMessage[];
}

export interface ChatResponse {
  reply: string;
  shortTermBuffer: ChatMessage[];
  factsExtracted?: number;
}

// Memory types
export interface MemoryFact {
  id: string;
  type: 'preference' | 'fact' | 'context' | 'personal_detail' | 'possession';
  key: string;
  value: string;
  timestamp: string;
  originMessage: string;
  userId: string;
}

export interface MemoryContext {
  facts: MemoryFact[];
  contextText: string;
}

export interface SearchResult {
  fact: MemoryFact;
  score: number;
}

// System types
export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'error';
  timestamp: string;
  services: {
    mistral: ServiceStatus;
    qdrant: ServiceStatus;
    embeddings: ServiceStatus;
  };
  environment: EnvironmentInfo;
}

export interface ServiceStatus {
  status: 'healthy' | 'unhealthy';
  description: string;
}

export interface EnvironmentInfo {
  nodeVersion: string;
  platform: string;
  mistralApiKey: 'configured' | 'missing';
  qdrantUrl: 'configured' | 'missing';
  qdrantApiKey: 'configured' | 'missing';
}

// Embedding types
export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
}

// Error types
export interface ApiError {
  error: string;
  details?: string;
  code?: string;
}
