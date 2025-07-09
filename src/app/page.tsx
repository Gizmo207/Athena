"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import AthenaBootup from "@/components/AthenaBootup";
import AgentSwitcher, { Agent, AVAILABLE_AGENTS } from "@/components/AgentSwitcher";
import VoiceControls from "@/components/VoiceControls";
import ChatBubble from "@/components/ChatBubble";

export default function Home() {
  const [messages, setMessages] = useState([
    { 
      id: 1, 
      message: "Greetings, Commander. I'm ATHENA, your Intelligent Overseer Agent. I'm here to help you coordinate complex projects, manage tasks, and provide strategic insights. My memory systems are online and I'm ready to assist with whatever challenges you're facing. What's our first objective?", 
      sender: "agent" 
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [booted, setBooted] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<Agent>(AVAILABLE_AGENTS[0]); // Start with ATHENA
  const [voiceSpeakEnabled, setVoiceSpeakEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageId = useRef(2);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = { id: messageId.current++, message: input, sender: "user" };
    setMessages((msgs) => [...msgs, userMsg]);
    setLoading(true);
    const userText = input;
    setInput("");
    
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: userText,
          agent: currentAgent.id,
          systemPrompt: currentAgent.systemPrompt,
          // Send recent conversation context for better flow
          context: messages.slice(-4).map(m => `${m.sender}: ${m.message}`).join('\n')
        }),
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      const agentMsg = {
        id: messageId.current++,
        message: data.reply || "I apologize, but I couldn't generate a response.",
        sender: "agent",
      };
      setMessages((msgs) => [...msgs, agentMsg]);
      
      // Speak the response if TTS is enabled
      if (voiceSpeakEnabled && (window as any).athenaSpeak) {
        (window as any).athenaSpeak(data.reply || "I apologize, but I couldn't generate a response.");
      }
    } catch (e) {
      console.error('Error:', e);
      setMessages((msgs) => [
        ...msgs,
        { id: messageId.current++, message: "I'm having trouble connecting right now. Please ensure Ollama is running and try again.", sender: "agent" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceInput = useCallback((text: string) => {
    setInput(text);
  }, []);

  const handleAgentChange = useCallback((agent: Agent) => {
    setCurrentAgent(agent);
    // Add system message about agent switch
    const switchMsg = {
      id: messageId.current++,
      message: `Switching to ${agent.name}. ${agent.purpose}`,
      sender: "system" as const
    };
    setMessages((msgs) => [...msgs, switchMsg]);
  }, []);

  const handleSpeakToggle = useCallback((enabled: boolean) => {
    setVoiceSpeakEnabled(enabled);
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
            <div style={{ 
              height: 440, 
              overflowY: "auto", 
              marginBottom: 24, 
              padding: 0,
              scrollbarWidth: "thin",
              scrollbarColor: "#00d4ff rgba(255,255,255,0.1)"
            }}>
              <div className="flex flex-col gap-2 w-full">
                {messages.map((msg) => (
                  <ChatBubble
                    key={msg.id}
                    message={msg.message}
                    sender={msg.sender as 'user' | 'agent'}
                    agentName={currentAgent.name}
                  />
                ))}
                {loading && (
                  <ChatBubble
                    message="Processing your request..."
                    sender="agent"
                    agentName={currentAgent.name}
                  >
                    <div style={{
                      fontSize: 15,
                      lineHeight: 1.4,
                      animation: 'pulse 2s infinite',
                      opacity: 0.7
                    }} />
                  </ChatBubble>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input area: input full width, submit below, voice controls right */}
            <div className="w-full flex flex-col gap-2">
              <div className="flex w-full gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !loading) handleSend();
                  }}
                  placeholder={`Transmit message to ${currentAgent.name}...`}
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-athena-cyan/30 bg-athena-darker/80 text-white font-mono text-base focus:border-athena-cyan focus:shadow-neon-cyan focus:outline-none transition-all duration-300"
                  style={{
                    backdropFilter: "blur(10px)"
                  }}
                  disabled={loading}
                />
                <div className="flex items-end">
                  <VoiceControls 
                    onVoiceInput={handleVoiceInput}
                    onSpeakToggle={handleSpeakToggle}
                    className="relative"
                  />
                </div>
              </div>
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className={`w-full mt-1 px-6 py-3 rounded-xl border-2 font-mono text-base font-bold transition-all duration-300 ${
                  loading || !input.trim() 
                    ? 'border-gray-500/50 bg-gray-500/20 text-gray-500 cursor-not-allowed'
                    : 'border-athena-cyan bg-gradient-to-r from-athena-cyan to-athena-green text-black hover:shadow-neon-cyan hover:scale-105'
                }`}
                style={{
                  backdropFilter: "blur(10px)"
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
