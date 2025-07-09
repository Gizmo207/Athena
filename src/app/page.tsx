"use client";
// Athena Multi-Agent AI Platform — Modular, TypeScript, Airbnb+Prettier

import { useState, useRef, useEffect, useCallback } from "react";
import AthenaBootup from "@/components/AthenaBootup";
import AgentSwitcher, { Agent, AVAILABLE_AGENTS } from "@/components/AgentSwitcher";

import ChatBubble from "@/components/ChatBubble";
import { restoreAthenaMemoryContext } from "@/hooks/sessionRestore";

// Main Home Page — Modular, TypeScript, Airbnb+Prettier
export default function Home() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      message:
        "Greetings, Commander. I'm ATHENA, your Intelligent Overseer Agent. I'm here to help you coordinate complex projects, manage tasks, and provide strategic insights. My memory systems are online and I'm ready to assist with whatever challenges you're facing. What's our first objective?",
      sender: "agent",
    },
  ] as Array<{ id: number; message: string; sender: "user" | "agent" | "system" }>);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [booted, setBooted] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<Agent>(AVAILABLE_AGENTS[0]); // Start with ATHENA

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageId = useRef(2);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    const userMsg = { id: messageId.current++, message: input, sender: "user" as "user" };
    setMessages((msgs) => [...msgs, userMsg]);
    setLoading(true);
    const userText = input;
    setInput("");
    try {
      const res = await fetch("/api/agent-simple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history: messages.slice(-4).map((m) => ({ role: m.sender, content: m.message })),
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP error! status: `);
      }
      const data = await res.json();
      const agentMsg = {
        id: messageId.current++,
        message: data.reply || "I apologize, but I couldn't generate a response.",
        sender: "agent" as "agent",
      };
      setMessages((msgs) => [...msgs, agentMsg]);
    } catch (e) {
      console.error("Error:", e);
      setMessages((msgs) => [
        ...msgs,
        {
          id: messageId.current++,
          message:
            "I'm having trouble connecting right now. Please ensure Ollama is running and try again.",
          sender: "agent",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, messages]);

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


  return (
    <>
      {/* Bootup Animation */}
      {!booted && <AthenaBootup onComplete={() => setBooted(true)} />}
      
      {/* Main Chat Interface with Background */}
      {booted && (
        <div 
          style={{
            height: '100vh',
            width: '100vw',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'monospace',
            color: 'white',
            backgroundImage: `url('/images/athena-bg.png')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundColor: '#0a0a0f' // fallback color
          }}
        >
          {/* Overlay for better text readability */}
          <div 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(135deg, rgba(10,10,15,0.8), rgba(26,26,46,0.7), rgba(22,33,62,0.8))'
            }}
          />
          
          {/* Chat Container */}
          <div 
            style={{
              position: 'relative',
              zIndex: 10,
              maxWidth: 700, 
              width: '90%',
              border: "2px solid #00d4ff", 
              borderRadius: 16, 
              padding: 24, 
              background: "rgba(26,26,46,0.95)", 
              minHeight: 680, // Increased to prevent cutoff
              boxShadow: "0 0 30px rgba(0,212,255,0.2), 0 8px 32px rgba(0,0,0,0.5)",
              backdropFilter: "blur(10px)"
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
                height: 440,
                overflowY: "auto",
                marginBottom: 24,
                padding: 0,
                scrollbarWidth: "thin",
                scrollbarColor: "#00d4ff rgba(255,255,255,0.1)",
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
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
                    sender={msg.sender as 'user' | 'agent'}
                    agentName={currentAgent.name}
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
    </>
  );
}
