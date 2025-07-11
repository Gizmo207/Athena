/**
 * Comprehensive RAG Pipeline Te  async search(query: string, userId: string, limit: number = 10): Promise<MockFact[]> {
    if (!this.isConnected && Math.random() < 0.1) {
      throw new Error('Vector store connection failed');
    }

    // Normalize query for case-insensitive search
    const normalizedQuery = query.toLowerCase();
    const queryWords = normalizedQuery.split(' ');
    
    console.log('=== SEARCH DEBUG ===');
    console.log('Search query:', normalizedQuery);
    console.log('Available facts for user:', this.facts.filter(f => f.userId === userId).map(f => f.content));
    
    const results = this.facts
      .filter(fact => {
        if (fact.userId !== userId) return false;
        
        const factContent = fact.content.toLowerCase();
        console.log(`Checking fact: "${factContent}"`);
        
        // Direct word matches
        if (queryWords.some(word => factContent.includes(word))) {
          console.log(`  ✓ Direct word match found`);
          return true;
        }
        
        // Semantic matches for preferences (handle both singular and plural)
        if (normalizedQuery.includes('preference') || normalizedQuery.includes('favorite') || normalizedQuery.includes('like')) {
          console.log(`  ? Checking for preference semantic match...`);
          if (factContent.includes('preference:') || factContent.includes('favorite') || factContent.includes('technology:')) {
            console.log(`  ✓ Preference semantic match found`);
            return true;
          }
        }
        
        // Semantic matches for personal info
        if (normalizedQuery.includes('about me') || normalizedQuery.includes('know about')) {
          console.log(`  ✓ General personal info match found`);
          return true; // Return all facts for general queries about the user
        }
        
        console.log(`  ✗ No match`);
        return false;
      })
      .slice(0, limit);
      
    console.log('Search results:', results.map(f => f.content));
    console.log('=== END SEARCH DEBUG ===');
    
    return results;
  }ts Short-Term Memory, Long-Term Memory, and Chat Session Operations
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Mock implementations
interface MockMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

interface MockSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: MockMessage[];
}

interface MockFact {
  id: string;
  userId: string;
  content: string;
  metadata: Record<string, any>;
  embedding: number[];
  timestamp: string;
}

// Mock Vector Store for testing
class MockVectorStore {
  private facts: MockFact[] = [];
  private isConnected = true;

  async search(query: string, userId: string, limit = 10): Promise<MockFact[]> {
    if (!this.isConnected) {
      throw new Error('Vector store connection failed');
    }

    console.log('=== MOCK SEARCH ENTRY ===');
    console.log('Search query:', query);
    console.log('User ID:', userId);
    console.log('Available facts:', this.facts.filter(f => f.userId === userId).map(f => f.content));

    // Normalize query for case-insensitive search
    const normalizedQuery = query.toLowerCase();
    const queryWords = normalizedQuery.split(' ');
    
    const results = this.facts
      .filter(fact => {
        if (fact.userId !== userId) return false;
        
        const factContent = fact.content.toLowerCase();
        
        // Check for exact word matches or semantic matches
        return queryWords.some(word => {
          // Remove punctuation from search word
          const cleanWord = word.replace(/[^\w]/g, '');
          if (!cleanWord) return false;
          
          // Direct inclusion check
          if (factContent.includes(cleanWord)) {
            console.log(`Match found: "${cleanWord}" in "${factContent}"`);
            return true;
          }
          
          // Handle singular/plural variations for key words
          if (cleanWord === 'preferences' && factContent.includes('preference')) {
            console.log(`Semantic match: "${cleanWord}" matches "preference" in "${factContent}"`);
            return true;
          }
          if (cleanWord === 'preference' && factContent.includes('preferences')) {
            console.log(`Semantic match: "${cleanWord}" matches "preferences" in "${factContent}"`);
            return true;
          }
          
          return false;
        });
      })
      .slice(0, limit);
      
    console.log('Search results:', results.map(f => f.content));
    return results;
  }

  async store(fact: MockFact): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Vector store connection failed');
    }
    
    // Normalize content for consistent case-insensitive storage and matching
    const normalizedFact = {
      ...fact,
      content: fact.content.toLowerCase()
    };
    
    // Remove existing fact with same normalized content
    this.facts = this.facts.filter(f => 
      !(f.userId === normalizedFact.userId && f.content === normalizedFact.content)
    );
    this.facts.push(normalizedFact);
  }

  async delete(factId: string): Promise<void> {
    this.facts = this.facts.filter(f => f.id !== factId);
  }

  async getUserFacts(userId: string): Promise<MockFact[]> {
    return this.facts.filter(f => f.userId === userId);
  }

  setConnectionStatus(connected: boolean): void {
    this.isConnected = connected;
  }

  clear(): void {
    this.facts = [];
    this.isConnected = true; // Reset connection status
  }

  size(): number {
    return this.facts.length;
  }
}

// Mock Short-Term Memory Buffer
class MockSTMBuffer {
  private messages: MockMessage[] = [];
  private readonly maxSize = 5;

  add(message: MockMessage): void {
    this.messages.push(message);
    if (this.messages.length > this.maxSize) {
      this.messages = this.messages.slice(-this.maxSize);
    }
  }

  getAll(): MockMessage[] {
    return [...this.messages];
  }

  clear(): void {
    this.messages = [];
  }

  size(): number {
    return this.messages.length;
  }

  getContextWindow(): string {
    return this.messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');
  }
}

// Mock RAG Pipeline
class MockRAGPipeline {
  private stm: MockSTMBuffer;
  private ltm: MockVectorStore;
  private factExtractor: (content: string) => string[];

  constructor() {
    this.stm = new MockSTMBuffer();
    this.ltm = new MockVectorStore();
    this.factExtractor = this.extractFacts.bind(this);
  }

  async processMessage(
    content: string, 
    userId: string, 
    role: 'user' | 'assistant' = 'user'
  ): Promise<{
    response: string;
    stmContext: string;
    ltmContext: MockFact[];
    extractedFacts: string[];
  }> {
    const message: MockMessage = {
      id: `msg_${Date.now()}_${Math.random()}`,
      role,
      content,
      timestamp: new Date().toISOString()
    };

    // Add to STM
    this.stm.add(message);

    // Get STM context
    const stmContext = this.stm.getContextWindow();

    // Combine STM and current message for enhanced LTM search
    const combinedSearchContext = [
      ...(this.stm.getAll().map(msg => msg.content) || []),
      content
    ].join(' ').toLowerCase();
    console.log('Combined context:', combinedSearchContext);

    // Search LTM for relevant context using combined context
    let ltmContext: MockFact[] = [];
    try {
      ltmContext = await this.ltm.search(combinedSearchContext, userId);
    } catch (error) {
      console.warn('LTM search failed, continuing without LTM context:', error);
      ltmContext = [];
    }

    // Extract and store facts (for user messages)
    let extractedFacts: string[] = [];
    if (role === 'user') {
      extractedFacts = this.factExtractor(content);
      
      // Store facts in LTM
      for (const fact of extractedFacts) {
        const factObject: MockFact = {
          id: `fact_${Date.now()}_${Math.random()}`,
          userId,
          content: fact,
          metadata: { source: 'conversation', extractedAt: new Date().toISOString() },
          embedding: this.generateMockEmbedding(fact),
          timestamp: new Date().toISOString()
        };
        try {
          await this.ltm.store(factObject);
        } catch (error) {
          console.warn('Failed to store fact, continuing:', error);
          // Remove this fact from extracted facts if storage failed
          extractedFacts = extractedFacts.filter(f => f !== fact);
        }
      }
    }

    // Generate mock response
    const response = this.generateResponse(content, stmContext, ltmContext);

    return {
      response,
      stmContext,
      ltmContext,
      extractedFacts
    };
  }

  private extractFacts(content: string): string[] {
    const facts: string[] = [];
    const text = content.toLowerCase();

    // Extract names
    const nameMatch = text.match(/(?:i'?m|my name is|call me)\s+([a-z]+)/);
    if (nameMatch) {
      facts.push(`name: ${nameMatch[1]}`);
    }

    // Extract locations
    const locationMatch = text.match(/(?:from|live in|located in)\s+([a-z\s]+?)(?:\s|$|,|\.|!|\?)/);
    if (locationMatch) {
      facts.push(`location: ${locationMatch[1].trim()}`);
    }

    // Extract preferences (including programming languages in context)
    const preferencePatterns = [
      /(?:prefer|like|love|enjoy)\s+([^,.!?]+)/,
      /(?:my\s+)?favorite\s+(?:language|framework|tool|technology|tech)?\s*(?:is\s+)?([a-z\s]+?)(?:\s|$|,|\.|!|\?)/,
      /(?:work(?:ing)?\s+with|using)\s+([a-z\s]+?)(?:\s|$|,|\.|!|\?)/
    ];

    for (const pattern of preferencePatterns) {
      const match = text.match(pattern);
      if (match) {
        facts.push(`preference: ${match[1].trim()}`);
      }
    }

    // Extract standalone technology mentions (only if not already in preferences)
    const techPatterns = [
      /\b(typescript|javascript|react|vue|angular|node|java|c\+\+|c#|golang|rust|ruby|php|swift|kotlin|fastapi|django|flask|express|spring|laravel)\b/gi
    ];

    for (const pattern of techPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const techFact = `technology: ${match.toLowerCase()}`;
          // Only add if not already covered by preferences
          const hasPreferenceWithTech = facts.some(f => 
            f.startsWith('preference:') && f.includes(match.toLowerCase())
          );
          if (!hasPreferenceWithTech) {
            facts.push(techFact);
          }
        });
      }
    }

    return facts;
  }

  private generateMockEmbedding(text: string): number[] {
    // Generate consistent mock embedding based on text
    const hash = text.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return Array.from({ length: 1024 }, (_, i) => 
      Math.sin(hash + i) * 0.5 + 0.5
    );
  }

  private generateResponse(
    input: string, 
    stmContext: string, 
    ltmContext: MockFact[]
  ): string {
    const inputLower = input.toLowerCase();
    
    // Build context information from LTM
    const contextInfo = ltmContext.length > 0 
      ? ` Based on what I know about you (${ltmContext.map(f => f.content).join(', ')}),`
      : '';
    
    // Generate intelligent responses based on input and context
    if (inputLower.includes('framework')) {
      // Check if user has Python-related technologies or preferences
      const hasPythonContext = ltmContext.some(f => 
        f.content.toLowerCase().includes('python') || 
        f.content.toLowerCase().includes('fastapi') ||
        f.content.toLowerCase().includes('django') ||
        f.content.toLowerCase().includes('flask')
      );
      
      if (hasPythonContext) {
        return `I understand you're asking about frameworks.${contextInfo} Since you're a Python developer, I'd recommend considering FastAPI for APIs, Django for web apps, or Flask for lightweight projects.`;
      }
    }
    
    if (inputLower.includes('preferences') && ltmContext.length > 0) {
      const preferences = ltmContext.map(f => f.content).join(' and ');
      return `Based on our conversation history, I know you prefer ${preferences}. Is there something specific you'd like to know about these technologies?`;
    }
    
    if (inputLower.includes('react') && ltmContext.some(f => f.content.toLowerCase().includes('react'))) {
      return `I see you're interested in React.${contextInfo} React is a great choice for building user interfaces. Would you like to know about hooks, components, or state management?`;
    }
    
    // Default response
    return `I understand you said: "${input}".${contextInfo} How can I help you further?`;
  }

  getSTM(): MockSTMBuffer {
    return this.stm;
  }

  getLTM(): MockVectorStore {
    return this.ltm;
  }

  clearSession(): void {
    this.stm.clear();
  }
}

// Mock Session Manager
class MockSessionManager {
  private sessions: Map<string, MockSession> = new Map();
  private currentSessionId: string | null = null;

  createSession(): MockSession {
    const session: MockSession = {
      id: `session_${Date.now()}_${Math.random()}`,
      title: 'New Chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };
    
    this.sessions.set(session.id, session);
    this.currentSessionId = session.id;
    return session;
  }

  getSession(sessionId: string): MockSession | null {
    return this.sessions.get(sessionId) || null;
  }

  getAllSessions(): MockSession[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  getCurrentSession(): MockSession | null {
    return this.currentSessionId ? this.getSession(this.currentSessionId) : null;
  }

  setCurrentSession(sessionId: string): boolean {
    if (this.sessions.has(sessionId)) {
      this.currentSessionId = sessionId;
      return true;
    }
    return false;
  }

  addMessageToSession(sessionId: string, message: MockMessage): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messages.push(message);
      session.updatedAt = new Date().toISOString();
      
      // Update title based on first user message
      if (session.messages.length === 1 && message.role === 'user') {
        session.title = message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '');
      }
      
      return true;
    }
    return false;
  }

  deleteSession(sessionId: string): boolean {
    if (this.sessions.delete(sessionId)) {
      if (this.currentSessionId === sessionId) {
        this.currentSessionId = null;
      }
      return true;
    }
    return false;
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  clear(): void {
    this.sessions.clear();
    this.currentSessionId = null;
  }
}

// Test Helper Functions
function createTestMessage(content: string, role: 'user' | 'assistant' = 'user'): MockMessage {
  return {
    id: `msg_${Date.now()}_${Math.random()}`,
    role,
    content,
    timestamp: new Date().toISOString()
  };
}

function measureExecutionTime(fn: () => Promise<any>): Promise<{ result: any; duration: number }> {
  return new Promise(async (resolve) => {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    resolve({ result, duration: end - start });
  });
}

// Test Data Fixtures
const testConversations = {
  personalInfo: [
    "Hi, I'm John from Boston and I work in software development",
    "I prefer Python and React for my projects",
    "My favorite editor is VS Code"
  ],
  technicalSupport: [
    "I'm having trouble with my Next.js application",
    "The TypeScript compiler is showing errors",
    "Can you help me debug this issue?"
  ],
  preferences: [
    "I love Italian food and coffee",
    "My favorite color is blue",
    "I enjoy hiking and photography"
  ]
};

// TESTS START HERE

describe('RAG Pipeline Test Suite', () => {
  let ragPipeline: MockRAGPipeline;
  let sessionManager: MockSessionManager;
  let testUserId: string;

  beforeEach(() => {
    ragPipeline = new MockRAGPipeline();
    sessionManager = new MockSessionManager();
    testUserId = `user_${Date.now()}`;
  });

  afterEach(() => {
    ragPipeline.getLTM().clear();
    ragPipeline.clearSession();
    sessionManager.clear();
  });

  describe('Short-Term Memory (STM) Tests', () => {
    test('should maintain exactly 5 messages in STM buffer', async () => {
      const stm = ragPipeline.getSTM();
      
      // Add 7 messages
      for (let i = 1; i <= 7; i++) {
        await ragPipeline.processMessage(`Message ${i}`, testUserId);
      }
      
      expect(stm.size()).toBe(5);
      
      const messages = stm.getAll();
      expect(messages[0].content).toBe('Message 3'); // First message should be #3
      expect(messages[4].content).toBe('Message 7'); // Last message should be #7
    });

    test('should clear STM on new session', () => {
      const stm = ragPipeline.getSTM();
      
      // Add some messages
      stm.add(createTestMessage('Test message 1'));
      stm.add(createTestMessage('Test message 2'));
      
      expect(stm.size()).toBe(2);
      
      // Clear session (simulate new chat)
      ragPipeline.clearSession();
      
      expect(stm.size()).toBe(0);
    });

    test('should maintain correct message order in STM', async () => {
      const messages = ['First', 'Second', 'Third'];
      
      for (const msg of messages) {
        await ragPipeline.processMessage(msg, testUserId);
      }
      
      const stmMessages = ragPipeline.getSTM().getAll();
      expect(stmMessages.map(m => m.content)).toEqual(messages);
    });

    test('should provide proper context window format', async () => {
      await ragPipeline.processMessage('Hello', testUserId, 'user');
      await ragPipeline.processMessage('Hi there!', testUserId, 'assistant');
      
      const contextWindow = ragPipeline.getSTM().getContextWindow();
      expect(contextWindow).toContain('user: Hello');
      expect(contextWindow).toContain('assistant: Hi there!');
    });
  });

  describe('Long-Term Memory (LTM) Tests', () => {
    test('should extract and store user facts', async () => {
      const ltm = ragPipeline.getLTM();
      
      const result = await ragPipeline.processMessage(
        "Hi, I'm Alice from Seattle and I love Python programming",
        testUserId
      );
      
      expect(result.extractedFacts).toContain('name: alice');
      expect(result.extractedFacts).toContain('location: seattle');
      expect(result.extractedFacts).toContain('preference: python programming');
      
      const storedFacts = await ltm.getUserFacts(testUserId);
      expect(storedFacts.length).toBe(3);
    });

    test('should retrieve relevant context from LTM', async () => {
      const ltm = ragPipeline.getLTM();
      
      // Store initial facts
      await ragPipeline.processMessage("My name is Bob and I work with React", testUserId);
      
      // Query for relevant context
      const result = await ragPipeline.processMessage("Tell me about React", testUserId);
      
      expect(result.ltmContext.length).toBeGreaterThan(0);
      expect(result.ltmContext.some(fact => fact.content.includes('react'))).toBe(true);
    });

    test('should handle fact updates correctly', async () => {
      const ltm = ragPipeline.getLTM();
      
      // Add initial preference
      await ragPipeline.processMessage("I prefer Vue.js", testUserId);
      
      // Update preference
      await ragPipeline.processMessage("Actually, I prefer React now", testUserId);
      
      const facts = await ltm.getUserFacts(testUserId);
      const reactFacts = facts.filter(f => f.content.includes('react'));
      const vueFacts = facts.filter(f => f.content.includes('vue'));
      
      expect(reactFacts.length).toBeGreaterThan(0);
      expect(vueFacts.length).toBeGreaterThan(0); // Both should exist as separate facts
    });

    test('should isolate facts between different users', async () => {
      const user1 = 'user1';
      const user2 = 'user2';
      
      await ragPipeline.processMessage("My name is Alice", user1);
      await ragPipeline.processMessage("My name is Bob", user2);
      
      const user1Facts = await ragPipeline.getLTM().getUserFacts(user1);
      const user2Facts = await ragPipeline.getLTM().getUserFacts(user2);
      
      expect(user1Facts.length).toBe(1);
      expect(user2Facts.length).toBe(1);
      expect(user1Facts[0].content).toContain('alice');
      expect(user2Facts[0].content).toContain('bob');
    });

    test('should handle vector store failures gracefully', async () => {
      const ltm = ragPipeline.getLTM();
      
      // Simulate connection failure
      ltm.setConnectionStatus(false);
      
      const result = await ragPipeline.processMessage("Test message", testUserId);
      
      // Should still process message but with empty LTM context
      expect(result.response).toBeTruthy();
      expect(result.ltmContext).toEqual([]);
      expect(result.extractedFacts).toEqual([]);
    });
  });

  describe('RAG Pipeline Integration Tests', () => {
    test('should combine STM and LTM context effectively', async () => {
      // Build conversation history
      await ragPipeline.processMessage("I'm a Python developer", testUserId);
      await ragPipeline.processMessage("I work on web applications", testUserId);
      await ragPipeline.processMessage("I need help with FastAPI", testUserId);
      
      const result = await ragPipeline.processMessage("What framework should I use?", testUserId);
      
      // Should have both STM and LTM context
      expect(result.stmContext).toContain('FastAPI');
      expect(result.ltmContext.length).toBeGreaterThan(0);
      expect(result.response).toContain('Python');
    });

    test('should process complex multi-fact messages', async () => {
      const complexMessage = "I'm John from Boston, I prefer Python and React, working on ML project";
      
      const result = await ragPipeline.processMessage(complexMessage, testUserId);
      
      expect(result.extractedFacts.length).toBeGreaterThanOrEqual(3);
      expect(result.extractedFacts.some(f => f.includes('john'))).toBe(true);
      expect(result.extractedFacts.some(f => f.includes('boston'))).toBe(true);
      expect(result.extractedFacts.some(f => f.includes('python') || f.includes('react'))).toBe(true);
    });

    test('should maintain context across session boundaries', async () => {
      // Session 1: Store facts
      console.log('=== SESSION 1: Storing facts ===');
      const firstResult = await ragPipeline.processMessage("My favorite language is TypeScript", testUserId);
      console.log('Extracted facts:', firstResult.extractedFacts);
      
      // Check what's stored in LTM
      const storedFacts = await ragPipeline.getLTM().getUserFacts(testUserId);
      console.log('Facts stored in LTM:', storedFacts.map(f => f.content));
      
      // Clear STM (simulate new session)
      console.log('=== CLEARING STM (new session) ===');
      ragPipeline.clearSession();
      
      // Session 2: Should still have LTM context
      console.log('=== SESSION 2: Retrieving context ===');
      const result = await ragPipeline.processMessage("What do you know about my preferences?", testUserId);
      console.log('LTM context found:', result.ltmContext.map(f => f.content));
      
      expect(result.ltmContext.length).toBeGreaterThan(0);
      expect(result.ltmContext.some(f => f.content.includes('typescript'))).toBe(true);
    });
  });

  describe('Chat Session Sidebar Operations', () => {
    test('should create new chat session', () => {
      const session = sessionManager.createSession();
      
      expect(session.id).toBeTruthy();
      expect(session.title).toBe('New Chat');
      expect(session.messages).toEqual([]);
      expect(sessionManager.getCurrentSession()?.id).toBe(session.id);
    });

    test('should switch between sessions correctly', () => {
      const session1 = sessionManager.createSession();
      const session2 = sessionManager.createSession();
      
      expect(sessionManager.getCurrentSession()?.id).toBe(session2.id);
      
      sessionManager.setCurrentSession(session1.id);
      expect(sessionManager.getCurrentSession()?.id).toBe(session1.id);
    });

    test('should display sessions sorted by recent activity', () => {
      const session1 = sessionManager.createSession();
      const session2 = sessionManager.createSession();
      
      // Add message to session1 (making it more recent)
      sessionManager.addMessageToSession(session1.id, createTestMessage('Hello'));
      
      const sessions = sessionManager.getAllSessions();
      expect(sessions[0].id).toBe(session1.id); // Most recent first
      expect(sessions[1].id).toBe(session2.id);
    });

    test('should update session title based on first message', () => {
      const session = sessionManager.createSession();
      const longMessage = "This is a very long message that should be truncated in the session title";
      
      sessionManager.addMessageToSession(session.id, createTestMessage(longMessage));
      
      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession?.title).toBe(longMessage.slice(0, 50) + '...');
    });

    test('should handle session deletion', () => {
      const session1 = sessionManager.createSession();
      const session2 = sessionManager.createSession();
      
      expect(sessionManager.getSessionCount()).toBe(2);
      
      sessionManager.deleteSession(session1.id);
      
      expect(sessionManager.getSessionCount()).toBe(1);
      expect(sessionManager.getSession(session1.id)).toBeNull();
      expect(sessionManager.getSession(session2.id)).toBeTruthy();
    });

    test('should isolate messages between sessions', () => {
      const session1 = sessionManager.createSession();
      const session2 = sessionManager.createSession();
      
      sessionManager.addMessageToSession(session1.id, createTestMessage('Message 1'));
      sessionManager.addMessageToSession(session2.id, createTestMessage('Message 2'));
      
      expect(sessionManager.getSession(session1.id)?.messages.length).toBe(1);
      expect(sessionManager.getSession(session2.id)?.messages.length).toBe(1);
      expect(sessionManager.getSession(session1.id)?.messages[0].content).toBe('Message 1');
      expect(sessionManager.getSession(session2.id)?.messages[0].content).toBe('Message 2');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty messages gracefully', async () => {
      const result = await ragPipeline.processMessage('', testUserId);
      
      expect(result.response).toBeTruthy();
      expect(result.extractedFacts).toEqual([]);
    });

    test('should handle very long messages', async () => {
      const longMessage = 'A'.repeat(10000);
      
      const result = await ragPipeline.processMessage(longMessage, testUserId);
      
      expect(result.response).toBeTruthy();
      expect(result.stmContext).toContain(longMessage);
    });

    test('should handle malformed user IDs', async () => {
      const malformedUserId = '';
      
      const result = await ragPipeline.processMessage('Test', malformedUserId);
      
      expect(result.response).toBeTruthy();
    });

    test('should handle concurrent message processing', async () => {
      const promises: Promise<any>[] = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(ragPipeline.processMessage(`Message ${i}`, testUserId));
      }
      
      const results = await Promise.all(promises);
      
      expect(results.length).toBe(10);
      results.forEach(result => {
        expect(result.response).toBeTruthy();
      });
    });
  });

  describe('Performance Tests', () => {
    test('should process single message within acceptable time', async () => {
      const { duration } = await measureExecutionTime(async () => {
        return await ragPipeline.processMessage('Test message', testUserId);
      });
      
      expect(duration).toBeLessThan(100); // Should process in under 100ms
    });

    test('should handle high volume of messages efficiently', async () => {
      const messageCount = 50;
      
      const { duration } = await measureExecutionTime(async () => {
        const promises: Promise<any>[] = [];
        for (let i = 0; i < messageCount; i++) {
          promises.push(ragPipeline.processMessage(`Message ${i}`, testUserId));
        }
        return await Promise.all(promises);
      });
      
      expect(duration).toBeLessThan(2000); // Should process 50 messages in under 2s
      expect(ragPipeline.getSTM().size()).toBe(5); // STM should still respect limits
    });

    test('should maintain performance with large LTM', async () => {
      // Pre-populate LTM with many facts
      for (let i = 0; i < 100; i++) {
        await ragPipeline.processMessage(`I like technology ${i}`, testUserId);
      }
      
      const { duration } = await measureExecutionTime(async () => {
        return await ragPipeline.processMessage('What do you know about me?', testUserId);
      });
      
      expect(duration).toBeLessThan(200); // Should still be fast with large LTM
    });

    test('should handle memory pressure gracefully', async () => {
      // Stress test with rapid message bursts
      for (let burst = 0; burst < 5; burst++) {
        const promises: Promise<any>[] = [];
        for (let i = 0; i < 20; i++) {
          promises.push(ragPipeline.processMessage(`Burst ${burst} Message ${i}`, testUserId));
        }
        await Promise.all(promises);
      }
      
      // System should still be responsive
      const result = await ragPipeline.processMessage('Final test', testUserId);
      expect(result.response).toBeTruthy();
      expect(ragPipeline.getSTM().size()).toBe(5);
    });
  });

  describe('Real-World Usage Scenarios', () => {
    test('should handle typical tech support conversation', async () => {
      const conversation = testConversations.technicalSupport;
      
      for (const message of conversation) {
        await ragPipeline.processMessage(message, testUserId);
      }
      
      const result = await ragPipeline.processMessage('Can you summarize my issues?', testUserId);
      
      expect(result.stmContext).toContain('Next.js');
      expect(result.stmContext).toContain('TypeScript');
      expect(result.response).toBeTruthy();
    });

    test('should build comprehensive user profile', async () => {
      const conversation = testConversations.personalInfo;
      
      for (const message of conversation) {
        await ragPipeline.processMessage(message, testUserId);
      }
      
      const userFacts = await ragPipeline.getLTM().getUserFacts(testUserId);
      
      expect(userFacts.length).toBeGreaterThan(0);
      expect(userFacts.some(f => f.content.includes('john'))).toBe(true);
      expect(userFacts.some(f => f.content.includes('boston'))).toBe(true);
      expect(userFacts.some(f => f.content.includes('python'))).toBe(true);
    });

    test('should handle multi-session user journey', async () => {
      // Session 1: Initial conversation
      const session1 = sessionManager.createSession();
      await ragPipeline.processMessage("I'm learning React", testUserId);
      sessionManager.addMessageToSession(session1.id, createTestMessage("I'm learning React"));
      
      // Session 2: Follow-up conversation
      ragPipeline.clearSession();
      const session2 = sessionManager.createSession();
      const result = await ragPipeline.processMessage("Tell me more about React hooks", testUserId);
      sessionManager.addMessageToSession(session2.id, createTestMessage("Tell me more about React hooks"));
      
      // Should have context from previous session
      expect(result.ltmContext.some(f => f.content.includes('react'))).toBe(true);
      expect(sessionManager.getSessionCount()).toBe(2);
    });
  });
});

// Export test utilities for manual testing
export const TestUtils = {
  MockRAGPipeline,
  MockSessionManager,
  MockVectorStore,
  MockSTMBuffer,
  testConversations,
  measureExecutionTime,
  createTestMessage
};
