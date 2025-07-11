// RAG Pipeline Test Suite
// Tests for Short-Term Memory, Long-Term Vector Store, and Chat Session Operations

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock implementations for testing
class MockVectorStore {
  private vectors: Map<string, { embedding: number[], metadata: any, content: string }> = new Map();
  
  async addDocument(id: string, content: string, metadata: any = {}) {
    // Simulate embedding generation
    const embedding = content.split('').map((_, i) => Math.random());
    this.vectors.set(id, { embedding, metadata, content });
  }
  
  async similaritySearch(query: string, topK: number = 5) {
    // Simple mock similarity search
    const results = Array.from(this.vectors.entries())
      .map(([id, doc]) => ({
        id,
        content: doc.content,
        metadata: doc.metadata,
        score: Math.random() // Mock similarity score
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    
    return results;
  }
  
  async deleteDocument(id: string) {
    return this.vectors.delete(id);
  }
  
  clear() {
    this.vectors.clear();
  }
  
  size() {
    return this.vectors.size;
  }
}

// Short-Term Memory (STM) Implementation
class ShortTermMemory {
  private messages: Message[] = [];
  private readonly maxSize: number;
  
  constructor(maxSize: number = 5) {
    this.maxSize = maxSize;
  }
  
  addMessage(message: Message) {
    this.messages.push(message);
    if (this.messages.length > this.maxSize) {
      this.messages.shift();
    }
  }
  
  getMessages(): Message[] {
    return [...this.messages];
  }
  
  getContextWindow(): Message[] {
    return this.messages.slice(-this.maxSize);
  }
  
  clear() {
    this.messages = [];
  }
  
  size(): number {
    return this.messages.length;
  }
}

// Long-Term Memory (LTM) Implementation
class LongTermMemory {
  private vectorStore: MockVectorStore;
  private facts: Map<string, any> = new Map();
  
  constructor() {
    this.vectorStore = new MockVectorStore();
  }
  
  async storeFact(key: string, value: any, content: string) {
    this.facts.set(key, value);
    await this.vectorStore.addDocument(key, content, { type: 'fact', value });
  }
  
  async storeConversation(sessionId: string, messages: Message[]) {
    const content = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    await this.vectorStore.addDocument(
      `conversation_${sessionId}`, 
      content, 
      { type: 'conversation', sessionId, messageCount: messages.length }
    );
  }
  
  async retrieveRelevantContext(query: string, topK: number = 3) {
    return await this.vectorStore.similaritySearch(query, topK);
  }
  
  getFact(key: string) {
    return this.facts.get(key);
  }
  
  async deleteFact(key: string) {
    this.facts.delete(key);
    await this.vectorStore.deleteDocument(key);
  }
  
  clear() {
    this.facts.clear();
    this.vectorStore.clear();
  }
}

// RAG Pipeline Implementation
class RAGPipeline {
  private stm: ShortTermMemory;
  private ltm: LongTermMemory;
  
  constructor(stmSize: number = 5) {
    this.stm = new ShortTermMemory(stmSize);
    this.ltm = new LongTermMemory();
  }
  
  async processMessage(message: Message, sessionId: string) {
    // Add to short-term memory
    this.stm.addMessage(message);
    
    // Extract and store facts if it's an assistant message
    if (message.role === 'assistant') {
      await this.extractAndStoreFacts(message, sessionId);
    }
    
    // Store conversation context in long-term memory
    await this.ltm.storeConversation(sessionId, this.stm.getMessages());
    
    return this.buildContext(message.content);
  }
  
  private async extractAndStoreFacts(message: Message, sessionId: string) {
    // Simple fact extraction (in real implementation, this would be more sophisticated)
    const content = message.content.toLowerCase();
    
    // Extract names
    const nameMatch = content.match(/my name is (\w+)/);
    if (nameMatch) {
      await this.ltm.storeFact('user_name', nameMatch[1], `User's name is ${nameMatch[1]}`);
    }
    
    // Extract preferences
    const preferenceMatch = content.match(/i (like|prefer|enjoy) (.+)/);
    if (preferenceMatch) {
      const preference = preferenceMatch[2];
      await this.ltm.storeFact(`preference_${Date.now()}`, preference, `User likes ${preference}`);
    }
    
    // Extract locations
    const locationMatch = content.match(/i live in (.+)/);
    if (locationMatch) {
      await this.ltm.storeFact('user_location', locationMatch[1], `User lives in ${locationMatch[1]}`);
    }
  }
  
  private async buildContext(query: string) {
    const recentMessages = this.stm.getContextWindow();
    const relevantContext = await this.ltm.retrieveRelevantContext(query);
    
    return {
      shortTermContext: recentMessages,
      longTermContext: relevantContext,
      combinedContext: this.combineContexts(recentMessages, relevantContext)
    };
  }
  
  private combineContexts(stmMessages: Message[], ltmContext: any[]) {
    const stmText = stmMessages.map(m => `${m.role}: ${m.content}`).join('\n');
    const ltmText = ltmContext.map(c => c.content).join('\n');
    
    return {
      recent: stmText,
      relevant: ltmText,
      combined: `Recent conversation:\n${stmText}\n\nRelevant context:\n${ltmText}`
    };
  }
  
  clearShortTerm() {
    this.stm.clear();
  }
  
  clearLongTerm() {
    this.ltm.clear();
  }
  
  getSTM() {
    return this.stm;
  }
  
  getLTM() {
    return this.ltm;
  }
}

// Test Suite
describe('RAG Pipeline Integration Tests', () => {
  let ragPipeline: RAGPipeline;
  let mockSessionManager: any;
  
  beforeEach(() => {
    ragPipeline = new RAGPipeline(5);
    mockSessionManager = {
      sessions: {},
      currentSessionId: 'test-session-1',
      saveSessions: jest.fn(),
      loadSessions: jest.fn()
    };
  });
  
  afterEach(() => {
    ragPipeline.clearShortTerm();
    ragPipeline.clearLongTerm();
  });
  
  describe('Short-Term Memory (STM) Tests', () => {
    test('should maintain message history within buffer size', async () => {
      const sessionId = 'test-session';
      const messages = [
        { id: '1', role: 'user', content: 'Hello', timestamp: '2024-01-01T10:00:00Z' },
        { id: '2', role: 'assistant', content: 'Hi there!', timestamp: '2024-01-01T10:00:01Z' },
        { id: '3', role: 'user', content: 'How are you?', timestamp: '2024-01-01T10:00:02Z' },
        { id: '4', role: 'assistant', content: 'I am doing well', timestamp: '2024-01-01T10:00:03Z' }
      ];
      
      for (const message of messages) {
        await ragPipeline.processMessage(message, sessionId);
      }
      
      const stm = ragPipeline.getSTM();
      expect(stm.size()).toBe(4);
      expect(stm.getMessages()).toHaveLength(4);
    });
    
    test('should maintain buffer size limit', async () => {
      const sessionId = 'test-session';
      const messages: Message[] = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
        timestamp: `2024-01-01T10:00:${i.toString().padStart(2, '0')}Z`
      }));
      
      for (const message of messages) {
        await ragPipeline.processMessage(message, sessionId);
      }
      
      const stm = ragPipeline.getSTM();
      expect(stm.size()).toBe(5); // Buffer size limit
      expect(stm.getMessages()[0].content).toBe('Message 6'); // Oldest kept message
    });
    
    test('should clear STM on new chat session', () => {
      const stm = ragPipeline.getSTM();
      stm.addMessage({ id: '1', role: 'user', content: 'Test', timestamp: '2024-01-01T10:00:00Z' });
      
      expect(stm.size()).toBe(1);
      
      ragPipeline.clearShortTerm();
      expect(stm.size()).toBe(0);
    });
    
    test('should provide correct context window', async () => {
      const sessionId = 'test-session';
      const messages: Message[] = Array.from({ length: 8 }, (_, i) => ({
        id: `${i + 1}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
        timestamp: `2024-01-01T10:00:${i.toString().padStart(2, '0')}Z`
      }));
      
      for (const message of messages) {
        await ragPipeline.processMessage(message, sessionId);
      }
      
      const stm = ragPipeline.getSTM();
      const contextWindow = stm.getContextWindow();
      
      expect(contextWindow).toHaveLength(5);
      expect(contextWindow[0].content).toBe('Message 4');
      expect(contextWindow[4].content).toBe('Message 8');
    });
  });
  
  describe('Long-Term Memory (LTM) Tests', () => {
    test('should extract and store user facts', async () => {
      const sessionId = 'test-session';
      const message = {
        id: '1',
        role: 'assistant' as const,
        content: 'Nice to meet you! So your name is John and you live in New York.',
        timestamp: '2024-01-01T10:00:00Z'
      };
      
      await ragPipeline.processMessage(message, sessionId);
      
      const ltm = ragPipeline.getLTM();
      expect(ltm.getFact('user_name')).toBe('john');
      expect(ltm.getFact('user_location')).toBe('new york');
    });
    
    test('should store conversation context', async () => {
      const sessionId = 'test-session';
      const messages = [
        { id: '1', role: 'user', content: 'What is machine learning?', timestamp: '2024-01-01T10:00:00Z' },
        { id: '2', role: 'assistant', content: 'Machine learning is a subset of AI', timestamp: '2024-01-01T10:00:01Z' }
      ];
      
      for (const message of messages) {
        await ragPipeline.processMessage(message, sessionId);
      }
      
      const ltm = ragPipeline.getLTM();
      const context = await ltm.retrieveRelevantContext('machine learning');
      
      expect(context.length).toBeGreaterThan(0);
      expect(context[0].metadata.type).toBe('conversation');
      expect(context[0].metadata.sessionId).toBe(sessionId);
    });
    
    test('should retrieve relevant context for queries', async () => {
      const sessionId = 'test-session';
      const ltm = ragPipeline.getLTM();
      
      // Store some facts
      await ltm.storeFact('tech_preference', 'React', 'User prefers React for frontend development');
      await ltm.storeFact('language_preference', 'TypeScript', 'User prefers TypeScript over JavaScript');
      
      const context = await ltm.retrieveRelevantContext('frontend development');
      
      expect(context.length).toBeGreaterThan(0);
      expect(context.some(c => c.content.includes('React'))).toBe(true);
    });
    
    test('should handle fact deletion', async () => {
      const ltm = ragPipeline.getLTM();
      
      await ltm.storeFact('temp_fact', 'temporary', 'This is temporary information');
      expect(ltm.getFact('temp_fact')).toBe('temporary');
      
      await ltm.deleteFact('temp_fact');
      expect(ltm.getFact('temp_fact')).toBeUndefined();
    });
  });
  
  describe('Context Building Tests', () => {
    test('should combine STM and LTM contexts', async () => {
      const sessionId = 'test-session';
      
      // Add some messages to STM
      const recentMessages = [
        { id: '1', role: 'user', content: 'Tell me about React', timestamp: '2024-01-01T10:00:00Z' },
        { id: '2', role: 'assistant', content: 'React is a JavaScript library', timestamp: '2024-01-01T10:00:01Z' }
      ];
      
      for (const message of recentMessages) {
        await ragPipeline.processMessage(message, sessionId);
      }
      
      // Add some facts to LTM
      const ltm = ragPipeline.getLTM();
      await ltm.storeFact('framework_knowledge', 'React', 'User is learning React framework');
      
      const context = await ragPipeline.processMessage(
        { id: '3', role: 'user', content: 'What are React hooks?', timestamp: '2024-01-01T10:00:02Z' },
        sessionId
      );
      
      expect(context.shortTermContext).toHaveLength(3);
      expect(context.longTermContext.length).toBeGreaterThan(0);
      expect(context.combinedContext.combined).toContain('Recent conversation:');
      expect(context.combinedContext.combined).toContain('Relevant context:');
    });
  });
  
  describe('Session Management Integration Tests', () => {
    test('should create new session with empty STM', () => {
      const newSession = SessionManager.createNewSession();
      ragPipeline.clearShortTerm();
      
      expect(newSession.messages).toHaveLength(0);
      expect(ragPipeline.getSTM().size()).toBe(0);
    });
    
    test('should load session and populate STM with last 5 messages', async () => {
      const sessionId = 'existing-session';
      const existingMessages: Message[] = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Historical message ${i + 1}`,
        timestamp: `2024-01-01T10:00:${i.toString().padStart(2, '0')}Z`
      }));
      
      // Simulate loading existing session
      for (const message of existingMessages.slice(-5)) {
        await ragPipeline.processMessage(message, sessionId);
      }
      
      const stm = ragPipeline.getSTM();
      expect(stm.size()).toBe(5);
      expect(stm.getMessages()[0].content).toBe('Historical message 6');
    });
    
    test('should maintain session isolation', async () => {
      const session1 = 'session-1';
      const session2 = 'session-2';
      
      // Add messages to session 1
      await ragPipeline.processMessage(
        { id: '1', role: 'user', content: 'Session 1 message', timestamp: '2024-01-01T10:00:00Z' },
        session1
      );
      
      // Clear STM (simulating session switch)
      ragPipeline.clearShortTerm();
      
      // Add messages to session 2
      await ragPipeline.processMessage(
        { id: '2', role: 'user', content: 'Session 2 message', timestamp: '2024-01-01T10:00:01Z' },
        session2
      );
      
      const stm = ragPipeline.getSTM();
      expect(stm.size()).toBe(1);
      expect(stm.getMessages()[0].content).toBe('Session 2 message');
    });
  });
  
  describe('Error Handling Tests', () => {
    test('should handle malformed messages gracefully', async () => {
      const sessionId = 'test-session';
      const malformedMessage = {
        id: '1',
        role: 'user' as const,
        content: '', // Empty content
        timestamp: '2024-01-01T10:00:00Z'
      };
      
      await expect(ragPipeline.processMessage(malformedMessage, sessionId)).resolves.not.toThrow();
    });
    
    test('should handle vector store failures gracefully', async () => {
      const sessionId = 'test-session';
      const ltm = ragPipeline.getLTM();
      
      // Mock vector store failure
      jest.spyOn(ltm, 'retrieveRelevantContext').mockRejectedValue(new Error('Vector store unavailable'));
      
      const message = {
        id: '1',
        role: 'user' as const,
        content: 'Test message',
        timestamp: '2024-01-01T10:00:00Z'
      };
      
      await expect(ragPipeline.processMessage(message, sessionId)).resolves.not.toThrow();
    });
  });
  
  describe('Performance Tests', () => {
    test('should handle large message volumes efficiently', async () => {
      const sessionId = 'performance-test';
      const messageCount = 1000;
      
      const startTime = Date.now();
      
      for (let i = 0; i < messageCount; i++) {
        const message: Message = {
          id: `${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Performance test message ${i}`,
          timestamp: `2024-01-01T10:00:${i.toString().padStart(2, '0')}Z`
        };
        await ragPipeline.processMessage(message, sessionId);
      }
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Should process messages reasonably quickly (adjust threshold as needed)
      expect(processingTime).toBeLessThan(5000); // 5 seconds
      expect(ragPipeline.getSTM().size()).toBe(5); // Should maintain buffer size
    });
  });
});

// Types used in tests
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

// Mock SessionManager for testing
class SessionManager {
  static createNewSession(title?: string): Session {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    return {
      id,
      title: title || 'New Chat',
      createdAt: now,
      updatedAt: now,
      messages: []
    };
  }
}

// Additional Test Utilities and Fixtures
const testFixtures = {
  // Sample conversations for testing
  sampleConversations: {
    techSupport: [
      { id: '1', role: 'user', content: 'My React app is crashing', timestamp: '2024-01-01T10:00:00Z' },
      { id: '2', role: 'assistant', content: 'Let me help you debug that. What error are you seeing?', timestamp: '2024-01-01T10:00:01Z' },
      { id: '3', role: 'user', content: 'TypeError: Cannot read property of undefined', timestamp: '2024-01-01T10:00:02Z' },
      { id: '4', role: 'assistant', content: 'This usually happens when accessing properties on undefined objects. Can you show me the code?', timestamp: '2024-01-01T10:00:03Z' }
    ],
    personalInfo: [
      { id: '1', role: 'user', content: 'Hi, my name is John Smith', timestamp: '2024-01-01T10:00:00Z' },
      { id: '2', role: 'assistant', content: 'Nice to meet you John! How can I help you today?', timestamp: '2024-01-01T10:00:01Z' },
      { id: '3', role: 'user', content: 'I live in Boston and work as a software engineer', timestamp: '2024-01-01T10:00:02Z' },
      { id: '4', role: 'assistant', content: 'That\'s great! Boston has a vibrant tech scene. What kind of software do you work on?', timestamp: '2024-01-01T10:00:03Z' }
    ],
    preferences: [
      { id: '1', role: 'user', content: 'I prefer Python over JavaScript', timestamp: '2024-01-01T10:00:00Z' },
      { id: '2', role: 'assistant', content: 'Python is a great choice! What do you like most about it?', timestamp: '2024-01-01T10:00:01Z' },
      { id: '3', role: 'user', content: 'I enjoy machine learning and data science', timestamp: '2024-01-01T10:00:02Z' },
      { id: '4', role: 'assistant', content: 'Excellent! Python has amazing libraries for ML like scikit-learn and TensorFlow.', timestamp: '2024-01-01T10:00:03Z' }
    ]
  },
  
  // Sample facts for LTM testing
  sampleFacts: {
    userProfile: {
      name: 'John Smith',
      location: 'Boston',
      profession: 'Software Engineer',
      experience: '5 years',
      company: 'TechCorp'
    },
    preferences: {
      languages: ['Python', 'TypeScript', 'Go'],
      frameworks: ['React', 'FastAPI', 'Django'],
      tools: ['VS Code', 'Git', 'Docker'],
      topics: ['Machine Learning', 'Web Development', 'DevOps']
    },
    projects: {
      current: 'E-commerce platform with React and Node.js',
      completed: ['Weather app', 'Todo list', 'Blog platform'],
      learning: ['Kubernetes', 'AWS', 'GraphQL']
    }
  }
};

// Advanced Test Helpers
class TestHelpers {
  static async createMockSession(
    id: string, 
    messages: Message[], 
    title?: string
  ): Promise<Session> {
    const now = new Date().toISOString();
    return {
      id,
      title: title || TestHelpers.generateTitleFromMessages(messages),
      createdAt: now,
      updatedAt: now,
      messages
    };
  }
  
  static generateTitleFromMessages(messages: Message[]): string {
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (!firstUserMessage) return 'New Chat';
    
    return firstUserMessage.content.slice(0, 30) + '...';
  }
  
  static async simulateTypingDelay(ms: number = 100): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  static createMessageSequence(
    baseContent: string, 
    count: number, 
    startTime: Date = new Date()
  ): Message[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `msg-${i + 1}`,
      role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `${baseContent} ${i + 1}`,
      timestamp: new Date(startTime.getTime() + i * 1000).toISOString()
    }));
  }
  
  static async measurePerformance<T>(
    operation: () => Promise<T> | T,
    description: string
  ): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await operation();
    const duration = performance.now() - start;
    
    console.log(`${description}: ${duration.toFixed(2)}ms`);
    return { result, duration };
  }
  
  static validateMessageStructure(message: any): boolean {
    return (
      typeof message.id === 'string' &&
      ['user', 'assistant', 'system'].includes(message.role) &&
      typeof message.content === 'string' &&
      typeof message.timestamp === 'string' &&
      !isNaN(Date.parse(message.timestamp))
    );
  }
  
  static async waitForCondition(
    condition: () => boolean,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (condition()) return;
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }
}

export { 
  RAGPipeline, 
  ShortTermMemory, 
  LongTermMemory, 
  MockVectorStore, 
  TestHelpers, 
  testFixtures
};
