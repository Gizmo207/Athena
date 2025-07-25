"use client";
// Athena Multi-Agent AI Platform — Modular, TypeScript, Airbnb+Prettier

import { useState, useRef, useEffect, useCallback } from "react";
import AthenaBootup from "@/components/AthenaBootup";
import AgentSwitcher, { Agent, AVAILABLE_AGENTS } from "@/components/AgentSwitcher";
import SessionSidebar from "@/components/SessionSidebar";
import ChatBubble from "@/components/ChatBubble";
import { restoreAthenaMemoryContext } from "@/hooks/sessionRestore";
import { SessionManager } from "@/lib/sessionManager";
import { MessageProcessor } from "@/lib/messageProcessor";
import { Message, Session, SessionStore } from "@/types/chat";

// Main Home Page — Modular, TypeScript, Airbnb+Prettier
export default function Home() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      message:
        "Greetings, Commander. I'm ATHENA, your Intelligent Overseer Agent. I'm here to help you coordinate complex projects, manage tasks, and provide strategic insights. My memory systems are online and I'm ready to assist with whatever challenges you're facing. What's our first objective?",
      sender: "agent",
      useTypewriter: false, // Initial message doesn't need typewriter
    },
  ] as Array<{ id: number; message: string; sender: "user" | "agent" | "system"; useTypewriter?: boolean }>);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [booted, setBooted] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<Agent>(AVAILABLE_AGENTS[0]); // Start with ATHENA
  const [shortTermBuffer, setShortTermBuffer] = useState<Array<{ role: string; content: string }>>([]); // STM buffer
  const [sessionId, setSessionId] = useState(() => `session_${Date.now()}`); // Current session ID
  const [showGreeting, setShowGreeting] = useState(true); // Control greeting display
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Sidebar collapse state
  
  // Enhanced session management
  const [sessionStore, setSessionStore] = useState<SessionStore | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageId = useRef(2);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Initialize enhanced session management
  useEffect(() => {
    const initializeSessionManagement = async () => {
      try {
        const store = await SessionManager.loadSessions();
        setSessionStore(store);
        
        // If there's a current session, load it
        if (store.currentSessionId && store.sessions[store.currentSessionId]) {
          const session = store.sessions[store.currentSessionId];
          setCurrentSession(session);
          
          // Convert enhanced session to legacy format for existing UI
          const legacyMessages = session.messages.map((msg, index) => ({
            id: index + 1,
            message: msg.content,
            sender: msg.role === 'user' ? 'user' as const : 
                   msg.role === 'assistant' ? 'agent' as const : 'system' as const,
            useTypewriter: false // Existing messages don't need typewriter
          }));
          
          if (legacyMessages.length > 0) {
            setMessages(legacyMessages);
            setShowGreeting(false);
            messageId.current = legacyMessages.length + 1;
          }
        }
      } catch (error) {
        console.error('Failed to initialize session management:', error);
      }
    };
    
    initializeSessionManagement();
  }, []);

  // Save session changes
  const saveSessionStore = useCallback(async (newStore: SessionStore) => {
    try {
      await SessionManager.saveSessions(newStore);
      setSessionStore(newStore);
    } catch (error) {
      console.error('Failed to save session store:', error);
    }
  }, []);

  // Convert legacy message to enhanced format
  const convertToEnhancedMessage = useCallback((legacyMsg: any): Message => {
    return {
      id: MessageProcessor.generateMessageId(),
      role: legacyMsg.sender === 'user' ? 'user' : 
            legacyMsg.sender === 'agent' ? 'assistant' : 'system',
      content: legacyMsg.message,
      timestamp: new Date().toISOString()
    };
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    const userMsg = { id: messageId.current++, message: input, sender: "user" as "user" };
    setMessages((msgs) => [...msgs, userMsg]);
    setLoading(true);
    const userText = input;
    setInput("");

    // Update STM buffer with user message
    const newSTM = [...shortTermBuffer, { role: 'user', content: userText }].slice(-5);

    // Enhanced session management - ensure we have a current session
    let session = currentSession;
    if (!session && sessionStore) {
      session = SessionManager.createNewSession();
      const newStore: SessionStore = {
        ...sessionStore,
        sessions: { ...sessionStore.sessions, [session.id]: session },
        currentSessionId: session.id
      };
      await saveSessionStore(newStore);
      setCurrentSession(session);
      setSessionId(session.id);
    }

    // Add user message to enhanced session
    if (session && sessionStore) {
      const enhancedUserMsg = convertToEnhancedMessage(userMsg);
      const updatedSession = SessionManager.addMessageToSession(session, enhancedUserMsg);
      const updatedStore: SessionStore = {
        ...sessionStore,
        sessions: { ...sessionStore.sessions, [updatedSession.id]: updatedSession }
      };
      await saveSessionStore(updatedStore);
      setCurrentSession(updatedSession);
    }

    // Retry mechanism for API calls
    const makeApiRequest = async (requestData: any, retries = 3): Promise<any> => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const res = await fetch("/api/athena-mistral", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestData),
          });
          
          if (!res.ok) {
            // Try to parse error details
            try {
              const errorData = await res.json();
              console.error(`API Error Details (attempt ${attempt}):`, errorData);
              
              // Don't retry on 4xx errors (client errors)
              if (res.status >= 400 && res.status < 500 && attempt === 1) {
                throw new Error(`API Error (${res.status}): ${errorData.error || errorData.message || 'Client error'}`);
              }
              
              if (attempt === retries) {
                throw new Error(`API Error (${res.status}): ${errorData.error || errorData.message || 'Unknown error'}`);
              }
            } catch (parseError) {
              // If JSON parsing fails, use status text
              if (attempt === retries) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
              }
            }
            
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
            continue;
          }
          
          return await res.json();
        } catch (error) {
          if (attempt === retries) {
            throw error;
          }
          
          console.warn(`API request attempt ${attempt} failed:`, error);
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
        }
      }
    };

    try {
      const data = await makeApiRequest({
        message: userText,
        shortTermBuffer: newSTM,
        userId: session?.id || sessionId,
      });
      
      // Update STM buffer with server response
      if (data.shortTermBuffer) {
        setShortTermBuffer(data.shortTermBuffer);
      }
      
      const agentMsg = {
        id: messageId.current++,
        message: data.reply || "I apologize, but I couldn't generate a response.",
        sender: "agent" as "agent",
        useTypewriter: true, // Enable typewriter for new responses
      };
      setMessages((msgs) => [...msgs, agentMsg]);
      
      // Add agent message to enhanced session
      if (session && sessionStore) {
        const enhancedAgentMsg = convertToEnhancedMessage(agentMsg);
        const updatedSession = SessionManager.addMessageToSession(currentSession || session, enhancedAgentMsg);
        const updatedStore: SessionStore = {
          ...sessionStore,
          sessions: { ...sessionStore.sessions, [updatedSession.id]: updatedSession }
        };
        await saveSessionStore(updatedStore);
        setCurrentSession(updatedSession);
      }
      
      // Update session with last message
      if ((window as any).updateAthenaSession) {
        (window as any).updateAthenaSession(agentMsg.message);
      }
    } catch (e) {
      console.error("Error in handleSend:", e);
      
      // Create more informative error message based on error type
      let errorMessage = "I'm having trouble connecting to the AI service right now. Please try again in a moment.";
      
      if (e instanceof Error) {
        if (e.message.includes('404')) {
          errorMessage = "The AI service endpoint is not available. Please check if the server is running.";
        } else if (e.message.includes('500')) {
          errorMessage = "The AI service encountered an internal error. Please try again.";
        } else if (e.message.includes('timeout') || e.message.includes('network')) {
          errorMessage = "Network connection issue detected. Please check your connection and try again.";
        } else if (e.message.includes('API Error')) {
          errorMessage = `AI Service Error: ${e.message.split(': ')[1] || 'Unknown error'}`;
        }
      }
      
      const errorMsg = {
        id: messageId.current++,
        message: errorMessage,
        sender: "agent" as const,
        useTypewriter: true, // Enable typewriter for error messages too
      };
      setMessages((msgs) => [...msgs, errorMsg]);
      
      // Add error message to enhanced session
      if (session && sessionStore) {
        const enhancedErrorMsg = {
          ...convertToEnhancedMessage(errorMsg),
          hasError: true
        };
        const updatedSession = SessionManager.addMessageToSession(currentSession || session, enhancedErrorMsg);
        const updatedStore: SessionStore = {
          ...sessionStore,
          sessions: { ...sessionStore.sessions, [updatedSession.id]: updatedSession }
        };
        await saveSessionStore(updatedStore);
        setCurrentSession(updatedSession);
      }
    } finally {
      setLoading(false);
    }
  }, [input, shortTermBuffer, sessionId, currentSession, sessionStore, saveSessionStore, convertToEnhancedMessage]);

  const handleAgentChange = useCallback((agent: Agent) => {
    setCurrentAgent(agent);
    // Add system message about agent switch
    const switchMsg = {
      id: messageId.current++,
      message: `Switching to ${agent.name}. ${agent.purpose || ""}`,
      sender: "system" as const,
    };
    setMessages((msgs) => [...msgs, switchMsg]);
  }, []);

  // Enhanced session management handlers
  const handleSessionChange = useCallback(async (newSessionId: string) => {
    if (!sessionStore) return;
    
    // Save current session state to enhanced store (already saved in handleSend)
    
    // Load new session state
    try {
      const session = sessionStore.sessions[newSessionId];
      if (session) {
        // Load from enhanced session
        setCurrentSession(session);
        
        // Convert to legacy format for existing UI
        const legacyMessages = session.messages.map((msg, index) => ({
          id: index + 1,
          message: msg.content,
          sender: msg.role === 'user' ? 'user' as const : 
                 msg.role === 'assistant' ? 'agent' as const : 'system' as const,
          useTypewriter: false // Existing messages don't need typewriter
        }));
        
        setMessages(legacyMessages);
        messageId.current = legacyMessages.length + 1;
        setShowGreeting(legacyMessages.length === 0);
        
        // Update current session in store
        const updatedStore: SessionStore = {
          ...sessionStore,
          currentSessionId: newSessionId
        };
        await saveSessionStore(updatedStore);
      } else {
        // New session - create enhanced session
        const newSession = SessionManager.createNewSession();
        setCurrentSession(newSession);
        
        // Reset to initial state
        setMessages([
          {
            id: 1,
            message:
              "Greetings, Commander. I'm ATHENA, your Intelligent Overseer Agent. I'm here to help you coordinate complex projects, manage tasks, and provide strategic insights. My memory systems are online and I'm ready to assist with whatever challenges you're facing. What's our first objective?",
            sender: "agent",
            useTypewriter: false,
          },
        ]);
        setShortTermBuffer([]);
        messageId.current = 2;
        setShowGreeting(true);
        
        // Save new session to store
        const updatedStore: SessionStore = {
          ...sessionStore,
          sessions: { ...sessionStore.sessions, [newSession.id]: newSession },
          currentSessionId: newSession.id
        };
        await saveSessionStore(updatedStore);
      }
    } catch (err) {
      console.warn('Failed to load enhanced session:', err);
      // Fallback to legacy session loading
      const savedSession = localStorage.getItem(`session_${newSessionId}`);
      if (savedSession) {
        const sessionData = JSON.parse(savedSession);
        setMessages(sessionData.messages || []);
        setShortTermBuffer(sessionData.shortTermBuffer || []);
        messageId.current = sessionData.messageId || 2;
        setShowGreeting(false);
      } else {
        // Reset to default state on error
        setMessages([
          {
            id: 1,
            message:
              "Greetings, Commander. I'm ATHENA, your Intelligent Overseer Agent. I'm here to help you coordinate complex projects, manage tasks, and provide strategic insights. My memory systems are online and I'm ready to assist with whatever challenges you're facing. What's our first objective?",
            sender: "agent",
            useTypewriter: false,
          },
        ]);
        setShortTermBuffer([]);
        messageId.current = 2;
        setShowGreeting(true);
      }
    }

    setSessionId(newSessionId);
  }, [sessionStore, saveSessionStore]);

  const handleNewSession = useCallback(async () => {
    if (!sessionStore) return;
    
    const newSession = SessionManager.createNewSession();
    const newSessionId = newSession.id;
    
    // Create new enhanced session
    const updatedStore: SessionStore = {
      ...sessionStore,
      sessions: { ...sessionStore.sessions, [newSessionId]: newSession },
      currentSessionId: newSessionId
    };
    await saveSessionStore(updatedStore);
    setCurrentSession(newSession);
    
    // Reset UI to initial state
    setMessages([
      {
        id: 1,
        message:
          "Greetings, Commander. I'm ATHENA, your Intelligent Overseer Agent. I'm here to help you coordinate complex projects, manage tasks, and provide strategic insights. My memory systems are online and I'm ready to assist with whatever challenges you're facing. What's our first objective?",
        sender: "agent",
        useTypewriter: false,
      },
    ]);
    setShortTermBuffer([]);
    messageId.current = 2;
    setShowGreeting(true);
    setSessionId(newSessionId);
  }, [sessionStore, saveSessionStore]);

  // Handle sidebar collapse state
  const handleSidebarCollapse = useCallback((isCollapsed: boolean) => {
    setSidebarCollapsed(isCollapsed);
  }, []);

  // On boot, restore Athena's memory context and inject as system message
  useEffect(() => {
    async function injectMemoryContext() {
      const memoryContext = await restoreAthenaMemoryContext();
      if (memoryContext && memoryContext.trim().length > 0) {
        setMessages((msgs) => [
          {
            id: 0,
            message: `ATHENA MEMORY CONTEXT:\n${memoryContext}`,
            sender: "system",
          },
          ...msgs,
        ]);
        console.log('[Athena:page] Injected memory context:', memoryContext);
      } else {
        console.log('[Athena:page] No persistent memory context found.');
      }
    }
    injectMemoryContext();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  return (
    <div 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        background: '#0a0a0f', 
        margin: 0, 
        padding: 0,
        overflow: 'hidden'
      }}
    >
      {/* Session Sidebar */}
      <SessionSidebar
        currentSessionId={sessionId}
        onSessionChange={handleSessionChange}
        onNewSession={handleNewSession}
        onCollapseChange={handleSidebarCollapse}
      />
      
      {/* Bootup Animation */}
      {!booted && <AthenaBootup onComplete={() => setBooted(true)} />}
      
      {/* Main Chat Interface with Background */}
      {booted && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: sidebarCollapsed ? '40px' : '300px',
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'monospace',
            color: 'white',
            backgroundColor: '#0a0a0f',
            transition: 'left 0.3s ease',
            overflowY: 'auto',
            zIndex: 1
          }}
        >
          {/* Chat Container */}
          <div 
            className="chat-container"
            style={{
              position: 'relative',
              zIndex: 100,
              maxWidth: 700, 
              width: '90%',
              height: 'calc(100vh - 40px)',
              minHeight: '600px',
              border: "2px solid #00d4ff", 
              borderRadius: 16, 
              padding: 24, 
              background: "rgba(26,26,46,0.95)", 
              boxShadow: "0 0 30px rgba(0,212,255,0.2), 0 8px 32px rgba(0,0,0,0.5)",
              backdropFilter: "blur(10px)",
              display: 'flex',
              flexDirection: 'column',
              margin: '20px 0'
            }}
          >
            {/* Header with Enhanced Athena branding and Agent Switcher */}
            <div style={{ 
              textAlign: "center", 
              marginBottom: 24, 
              paddingBottom: 20, 
              borderBottom: "2px solid rgba(0,212,255,0.3)"
            }}>
              <div className="flex justify-between items-center mb-4">
                <div className="flex-1 flex justify-start">
                  <AgentSwitcher 
                    currentAgent={currentAgent}
                    onAgentChange={handleAgentChange}
                  />
                </div>
                <div className="flex-1 flex flex-col items-center">
                  <h1 style={{ 
                    color: "#00d4ff", 
                    margin: 0, 
                    fontSize: 32,
                    fontWeight: "bold",
                    textShadow: "0 0 15px rgba(0,212,255,0.6)",
                    letterSpacing: "0.1em"
                  }}>
                    {currentAgent.name}
                  </h1>
                  {/* Only show green subtitle for Athena */}
                  {currentAgent.id === 'athena' && (
                    <p style={{ 
                      color: "#00ff88", 
                      margin: "8px 0 0 0", 
                      fontSize: 16,
                      fontWeight: "500"
                    }}>
                      INTELLIGENT OVERSEER AGENT
                    </p>
                  )}
                  {/* Show agent purpose for others */}
                  {currentAgent.id !== 'athena' && (
                    <p style={{ 
                      color: "#00d4ff", 
                      margin: "8px 0 0 0", 
                      fontSize: 16,
                      fontWeight: "500"
                    }}>
                      {currentAgent.purpose}
                    </p>
                  )}
                </div>
                <div className="flex-1"></div>
              </div>
              <div style={{
                color: "#aaa",
                fontSize: 12,
                marginTop: "6px",
                opacity: 0.8
              }}>
                ● MEMORY ACTIVE ● RAG ONLINE ● LOCAL AI READY ●
              </div>
            </div>

            {/* Messages container */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                marginBottom: 24,
                padding: 0,
                scrollbarWidth: "thin",
                scrollbarColor: "#00d4ff rgba(255,255,255,0.1)",
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                minHeight: 0
              }}
            >
              {/* Staggered chat bubbles, not full width, with clear separation */}
              {messages.map((msg, idx) => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    marginTop: idx === 0 ? 0 : 24,
                    marginBottom: 0,
                    width: '100%',
                  }}
                >
                  <ChatBubble
                    message={msg.message}
                    sender={msg.sender as 'user' | 'agent' | 'system'}
                    agentName={currentAgent.name}
                    useTypewriter={msg.useTypewriter || false}
                    typewriterSpeed={sessionStore?.settings?.typewriterSpeed || 30}
                  />
                </div>
              ))}
              {loading && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    marginTop: 24,
                    width: '100%',
                  }}
                >
                  <ChatBubble message={""} sender="agent" agentName={currentAgent.name}>
                    <div style={{ minHeight: 32, display: 'flex', alignItems: 'center' }}>
                      <span style={{ color: '#aaa', fontSize: 18, marginRight: 8 }}>Processing your request</span>
                      <span className="typing-dots">
                        <span></span><span></span><span></span>
                      </span>
                    </div>
                  </ChatBubble>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area: OpenAI-style textarea, submit below, no voice controls, full width, no flex issues */}
            <div style={{ width: '100%' }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !loading) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`Transmit message to ${currentAgent.name}...`}
                rows={3}
                className="resize-none px-7 py-7 rounded-2xl border-2 border-cyan-400 bg-[#181c24] text-cyan-100 font-mono text-2xl focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/60 focus:outline-none transition-all duration-300 shadow-xl placeholder-gray-400 dark:placeholder-gray-500 w-full"
                style={{
                  minHeight: 88,
                  maxHeight: 220,
                  width: '100%',
                  background: 'rgba(26,26,46,0.95)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 0 24px 4px rgba(0,212,255,0.15), 0 2px 16px 0 rgba(0,212,255,0.10)',
                  color: '#e0f7ff'
                }}
                disabled={loading}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className={`w-full mt-3 px-7 py-6 rounded-2xl border-2 font-mono text-2xl font-bold transition-all duration-300 shadow-xl focus:outline-none focus:ring-2 focus:ring-cyan-400/60
                  ${loading || !input.trim()
                    ? 'border-gray-500/50 bg-gray-500/20 text-gray-500 cursor-not-allowed'
                    : 'border-cyan-400 bg-[#0a1120] text-white hover:bg-[#18213a] hover:shadow-[0_0_32px_6px_rgba(0,212,255,0.25)] hover:scale-105'}`}
                style={{
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 0 32px 6px rgba(0,212,255,0.25), 0 2px 16px 0 rgba(0,212,255,0.10)',
                  color: loading || !input.trim() ? undefined : '#fff',
                  textShadow: loading || !input.trim() ? undefined : '0 1px 8px #000, 0 0 2px #00d4ff',
                  borderColor: '#0ff',
                }}
              >
                {loading ? "●●●" : "TRANSMIT"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
