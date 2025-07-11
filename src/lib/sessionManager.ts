import { Session, SessionStore, Message } from '../types/chat';

export class SessionManager {
  private static readonly STORAGE_KEY = 'athena_chat_sessions';
  private static readonly MAX_SESSIONS = 100;
  
  static async loadSessions(): Promise<SessionStore> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return this.getDefaultStore();
      
      const parsed = JSON.parse(stored);
      return this.validateStore(parsed);
    } catch (error) {
      console.warn('Failed to load sessions:', error);
      return this.getDefaultStore();
    }
  }
  
  static async saveSessions(store: SessionStore): Promise<void> {
    try {
      // Implement session cleanup if over limit
      if (Object.keys(store.sessions).length > this.MAX_SESSIONS) {
        store = this.cleanupOldSessions(store);
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(store));
    } catch (error) {
      console.error('Failed to save sessions:', error);
      throw new Error('Storage quota exceeded or unavailable');
    }
  }
  
  static createNewSession(title?: string, userId?: string): Session {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    return {
      id,
      title: title || 'New Chat',
      createdAt: now,
      updatedAt: now,
      messages: [],
      settings: {
        model: 'mistral-large-latest',
        temperature: 0.7,
        maxTokens: 2000
      },
      userId
    };
  }
  
  static generateSessionTitle(messages: Message[]): string {
    const firstUserMessage = messages.find(m => m.role === 'user')?.content;
    if (!firstUserMessage) return 'New Chat';
    
    // Extract meaningful title from first message
    const title = firstUserMessage
      .slice(0, 50)
      .replace(/[^\w\s]/g, '')
      .trim();
    
    return title || 'New Chat';
  }
  
  static updateSessionTitle(session: Session): Session {
    if (session.messages.length > 0 && session.title === 'New Chat') {
      return {
        ...session,
        title: this.generateSessionTitle(session.messages)
      };
    }
    return session;
  }
  
  static addMessageToSession(session: Session, message: Message): Session {
    const updatedSession = {
      ...session,
      messages: [...session.messages, message],
      updatedAt: new Date().toISOString()
    };
    
    return this.updateSessionTitle(updatedSession);
  }
  
  static archiveSession(sessionId: string, store: SessionStore): SessionStore {
    const session = store.sessions[sessionId];
    if (!session) return store;
    
    const updatedSession = { ...session, isArchived: true };
    const updatedSessions = { ...store.sessions, [sessionId]: updatedSession };
    
    // If this was the current session, clear it
    const currentSessionId = store.currentSessionId === sessionId 
      ? null 
      : store.currentSessionId;
    
    return {
      ...store,
      sessions: updatedSessions,
      currentSessionId
    };
  }
  
  static deleteSession(sessionId: string, store: SessionStore): SessionStore {
    const { [sessionId]: deletedSession, ...remainingSessions } = store.sessions;
    
    // If this was the current session, clear it
    const currentSessionId = store.currentSessionId === sessionId 
      ? null 
      : store.currentSessionId;
    
    return {
      ...store,
      sessions: remainingSessions,
      currentSessionId
    };
  }
  
  static searchSessions(store: SessionStore, query: string): Session[] {
    const searchTerm = query.toLowerCase();
    
    return Object.values(store.sessions)
      .filter(session => !session.isArchived)
      .filter(session => {
        // Search in title
        if (session.title.toLowerCase().includes(searchTerm)) return true;
        
        // Search in message content
        return session.messages.some(message => 
          message.content.toLowerCase().includes(searchTerm)
        );
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
  
  private static getDefaultStore(): SessionStore {
    return {
      sessions: {},
      currentSessionId: null,
      settings: {
        theme: 'light',
        fontSize: 'medium',
        autoSave: true,
        typewriterSpeed: 30
      }
    };
  }
  
  private static validateStore(store: any): SessionStore {
    // Basic validation and migration logic
    if (!store.sessions) store.sessions = {};
    if (!store.settings) {
      store.settings = {
        theme: 'light',
        fontSize: 'medium',
        autoSave: true,
        typewriterSpeed: 30
      };
    }
    
    // Validate sessions structure
    Object.keys(store.sessions).forEach(sessionId => {
      const session = store.sessions[sessionId];
      if (!session.id) session.id = sessionId;
      if (!session.messages) session.messages = [];
      if (!session.createdAt) session.createdAt = new Date().toISOString();
      if (!session.updatedAt) session.updatedAt = session.createdAt;
    });
    
    return store as SessionStore;
  }
  
  private static cleanupOldSessions(store: SessionStore): SessionStore {
    const sessions = Object.values(store.sessions)
      .filter(s => !s.isArchived)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, this.MAX_SESSIONS - 10);
    
    const cleanedSessions: Record<string, Session> = {};
    sessions.forEach(session => {
      cleanedSessions[session.id] = session;
    });
    
    return { ...store, sessions: cleanedSessions };
  }
  
  static exportSession(session: Session): string {
    const exportData = {
      title: session.title,
      createdAt: session.createdAt,
      messages: session.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }))
    };
    
    return JSON.stringify(exportData, null, 2);
  }
  
  static getSessionStats(session: Session) {
    const messageCount = session.messages.length;
    const userMessages = session.messages.filter(m => m.role === 'user').length;
    const assistantMessages = session.messages.filter(m => m.role === 'assistant').length;
    const totalChars = session.messages.reduce((sum, m) => sum + m.content.length, 0);
    
    return {
      messageCount,
      userMessages,
      assistantMessages,
      totalCharacters: totalChars,
      estimatedTokens: Math.ceil(totalChars / 4), // Rough estimate
      duration: new Date(session.updatedAt).getTime() - new Date(session.createdAt).getTime()
    };
  }
}
