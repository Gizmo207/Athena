import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message, Session, SessionStore } from '../types/chat';
import { SessionManager } from '../lib/sessionManager';
import { MessageProcessor } from '../lib/messageProcessor';
import { TypewriterEffect } from './TypewriterEffect';

interface ChatInterfaceProps {
  className?: string;
  onSessionChange?: (session: Session | null) => void;
  initialMessage?: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  className = '',
  onSessionChange,
  initialMessage
}) => {
  // Core state
  const [store, setStore] = useState<SessionStore | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [inputValue, setInputValue] = useState(initialMessage || '');
  
  // UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Initialize store and sessions
  useEffect(() => {
    const initializeChat = async () => {
      try {
        const loadedStore = await SessionManager.loadSessions();
        setStore(loadedStore);
        
        // Load current session if exists
        if (loadedStore.currentSessionId && loadedStore.sessions[loadedStore.currentSessionId]) {
          const session = loadedStore.sessions[loadedStore.currentSessionId];
          setCurrentSession(session);
          onSessionChange?.(session);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize chat:', error);
        setIsLoading(false);
      }
    };
    
    initializeChat();
  }, [onSessionChange]);
  
  // Filter sessions based on search
  useEffect(() => {
    if (!store) {
      setFilteredSessions([]);
      return;
    }
    
    if (!searchQuery.trim()) {
      const sessions = Object.values(store.sessions)
        .filter(s => !s.isArchived)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setFilteredSessions(sessions);
    } else {
      const results = SessionManager.searchSessions(store, searchQuery);
      setFilteredSessions(results);
    }
  }, [store, searchQuery]);
  
  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);
  
  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages, scrollToBottom]);
  
  // Save store changes
  const saveStore = useCallback(async (newStore: SessionStore) => {
    try {
      await SessionManager.saveSessions(newStore);
      setStore(newStore);
    } catch (error) {
      console.error('Failed to save sessions:', error);
    }
  }, []);
  
  // Create new session
  const createNewSession = useCallback(async () => {
    if (!store) return;
    
    const newSession = SessionManager.createNewSession();
    const newStore: SessionStore = {
      ...store,
      sessions: { ...store.sessions, [newSession.id]: newSession },
      currentSessionId: newSession.id
    };
    
    await saveStore(newStore);
    setCurrentSession(newSession);
    onSessionChange?.(newSession);
    setInputValue('');
    inputRef.current?.focus();
  }, [store, saveStore, onSessionChange]);
  
  // Switch to session
  const switchToSession = useCallback(async (sessionId: string) => {
    if (!store) return;
    
    const session = store.sessions[sessionId];
    if (!session) return;
    
    const newStore: SessionStore = {
      ...store,
      currentSessionId: sessionId
    };
    
    await saveStore(newStore);
    setCurrentSession(session);
    onSessionChange?.(session);
  }, [store, saveStore, onSessionChange]);
  
  // Delete session
  const deleteSession = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!store) return;
    
    const newStore = SessionManager.deleteSession(sessionId, store);
    await saveStore(newStore);
    
    if (currentSession?.id === sessionId) {
      setCurrentSession(null);
      onSessionChange?.(null);
    }
  }, [store, currentSession, saveStore, onSessionChange]);
  
  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isSending || !store) return;
    
    setIsSending(true);
    
    try {
      // Create or get current session
      let session = currentSession;
      if (!session) {
        session = SessionManager.createNewSession();
        const newStore: SessionStore = {
          ...store,
          sessions: { ...store.sessions, [session.id]: session },
          currentSessionId: session.id
        };
        await saveStore(newStore);
        setCurrentSession(session);
        onSessionChange?.(session);
      }
      
      // Create user message
      const userMessage: Message = {
        id: MessageProcessor.generateMessageId(),
        role: 'user',
        content: MessageProcessor.sanitizeInput(content),
        timestamp: new Date().toISOString()
      };
      
      // Add user message to session
      const updatedSession = SessionManager.addMessageToSession(session, userMessage);
      const storeWithUserMessage: SessionStore = {
        ...store,
        sessions: { ...store.sessions, [updatedSession.id]: updatedSession }
      };
      await saveStore(storeWithUserMessage);
      setCurrentSession(updatedSession);
      
      // Create assistant message placeholder
      const assistantMessage: Message = {
        id: MessageProcessor.generateMessageId(),
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isStreaming: true
      };
      
      const sessionWithAssistant = SessionManager.addMessageToSession(updatedSession, assistantMessage);
      const storeWithAssistant: SessionStore = {
        ...store,
        sessions: { ...store.sessions, [sessionWithAssistant.id]: sessionWithAssistant }
      };
      await saveStore(storeWithAssistant);
      setCurrentSession(sessionWithAssistant);
      
      // Call API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: sessionWithAssistant.messages.slice(0, -1), // Exclude the streaming placeholder
          sessionId: sessionWithAssistant.id,
          settings: sessionWithAssistant.settings
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Update assistant message with response
      const completedAssistantMessage: Message = {
        ...assistantMessage,
        content: data.content || 'Sorry, I encountered an error processing your request.',
        isStreaming: false,
        metadata: {
          model: data.model,
          usage: data.usage,
          processingTime: data.processingTime
        }
      };
      
      const finalSession = {
        ...sessionWithAssistant,
        messages: [
          ...sessionWithAssistant.messages.slice(0, -1),
          completedAssistantMessage
        ],
        updatedAt: new Date().toISOString()
      };
      
      const finalStore: SessionStore = {
        ...store,
        sessions: { ...store.sessions, [finalSession.id]: finalSession }
      };
      
      await saveStore(finalStore);
      setCurrentSession(finalSession);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Update the assistant message with error
      if (currentSession) {
        const errorMessage = 'Sorry, I encountered an error. Please try again.';
        const messages = [...currentSession.messages];
        const lastMessage = messages[messages.length - 1];
        
        if (lastMessage?.role === 'assistant' && lastMessage.isStreaming) {
          lastMessage.content = errorMessage;
          lastMessage.isStreaming = false;
          lastMessage.hasError = true;
          
          const errorSession = { ...currentSession, messages };
          setCurrentSession(errorSession);
        }
      }
    } finally {
      setIsSending(false);
      setInputValue('');
    }
  }, [currentSession, store, isSending, saveStore, onSessionChange]);
  
  // Handle input submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isSending) {
      sendMessage(inputValue.trim());
    }
  }, [inputValue, isSending, sendMessage]);
  
  // Handle textarea key events
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);
  
  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
    }
  }, []);
  
  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue, adjustTextareaHeight]);
  
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-gray-500">Loading chat...</div>
      </div>
    );
  }
  
  return (
    <div className={`flex h-full bg-white ${className}`}>
      {/* Sidebar */}
      <div className={`
        flex flex-col bg-gray-50 border-r border-gray-200 transition-all duration-300
        ${isSidebarOpen ? 'w-80' : 'w-0 overflow-hidden'}
      `}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">Chat Sessions</h2>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 hover:bg-gray-200 rounded text-gray-500"
              title="Close sidebar"
            >
              ×
            </button>
          </div>
          
          <button
            onClick={createNewSession}
            className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            + New Chat
          </button>
          
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto">
          {filteredSessions.map((session) => (
            <div
              key={session.id}
              onClick={() => switchToSession(session.id)}
              className={`
                group p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors
                ${currentSession?.id === session.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-800 truncate">
                    {session.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(session.updatedAt).toLocaleDateString()}
                  </p>
                  {session.messages.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1 truncate">
                      {session.messages[session.messages.length - 1]?.content?.slice(0, 50)}...
                    </p>
                  )}
                </div>
                
                <button
                  onClick={(e) => deleteSession(session.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded text-red-500 transition-all"
                  title="Delete session"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          
          {filteredSessions.length === 0 && (
            <div className="p-4 text-center text-gray-500 text-sm">
              {searchQuery ? 'No sessions found' : 'No chat sessions yet'}
            </div>
          )}
        </div>
      </div>
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!isSidebarOpen && (
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  title="Open sidebar"
                >
                  ☰
                </button>
              )}
              <h1 className="text-lg font-semibold text-gray-800">
                {currentSession?.title || 'ATHENA Chat'}
              </h1>
            </div>
            
            {currentSession && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{currentSession.messages.length} messages</span>
                {currentSession.settings?.model && (
                  <span>• {currentSession.settings.model}</span>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Messages */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto chat-messages-container"
        >
          {!currentSession ? (
            <div className="flex items-center justify-center h-full text-center">
              <div className="max-w-md">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                  Welcome to ATHENA Chat
                </h2>
                <p className="text-gray-600 mb-4">
                  Start a new conversation or select an existing session from the sidebar.
                </p>
                <button
                  onClick={createNewSession}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Start New Chat
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {currentSession.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`
                    max-w-[80%] p-4 rounded-lg
                    ${message.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-800'
                    }
                    ${message.hasError ? 'bg-red-100 text-red-800 border border-red-200' : ''}
                  `}>
                    {message.role === 'assistant' && message.isStreaming ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                        <span className="text-gray-600">Thinking...</span>
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none">
                        {message.role === 'assistant' ? (
                          <TypewriterEffect
                            content={message.content}
                            speed={store?.settings?.typewriterSpeed || 30}
                            autoScroll={true}
                            className="whitespace-pre-wrap"
                          />
                        ) : (
                          <div className="whitespace-pre-wrap">
                            {MessageProcessor.formatMessageForDisplay(message.content, message.role)}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="text-xs opacity-70 mt-2">
                      {new Date(message.timestamp).toLocaleTimeString()}
                      {message.metadata?.model && (
                        <span className="ml-2">• {message.metadata.model}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        
        {/* Input Area */}
        {currentSession && (
          <div className="border-t border-gray-200 p-4 bg-white">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message... (Shift+Enter for new line)"
                  disabled={isSending}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  style={{ minHeight: '52px', maxHeight: '200px' }}
                />
              </div>
              
              <button
                type="submit"
                disabled={!inputValue.trim() || isSending}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
