"use client";
import { useState, useRef, useEffect } from "react";

export default function Home() {
  const [messages, setMessages] = useState([
    { id: 1, message: "Hello! I'm Athena, your intelligent overseer agent. How can I assist you today?", sender: "agent" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
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

  return (
    <div style={{ 
      maxWidth: 600, 
      margin: "40px auto", 
      border: "1px solid #2a2a2a", 
      borderRadius: 12, 
      padding: 20, 
      background: "linear-gradient(135deg, #1a1a2e, #16213e)", 
      minHeight: 600,
      boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
    }}>
      {/* Header with Athena branding */}
      <div style={{ 
        textAlign: "center", 
        marginBottom: 20, 
        paddingBottom: 15, 
        borderBottom: "1px solid #333" 
      }}>
        <h2 style={{ 
          color: "#00d4ff", 
          margin: 0, 
          fontSize: 24,
          textShadow: "0 0 10px rgba(0,212,255,0.5)"
        }}>
          ATHENA
        </h2>
        <p style={{ 
          color: "#aaa", 
          margin: "5px 0 0 0", 
          fontSize: 14 
        }}>
          Intelligent Overseer Agent
        </p>
      </div>

      {/* Messages container */}
      <div style={{ 
        height: 450, 
        overflowY: "auto", 
        marginBottom: 20, 
        display: "flex", 
        flexDirection: "column",
        padding: "0 10px"
      }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
              background: msg.sender === "user" 
                ? "linear-gradient(135deg, #00d4ff, #0099cc)" 
                : "linear-gradient(135deg, #333, #555)",
              color: msg.sender === "user" ? "#000" : "#fff",
              borderRadius: 16,
              padding: "12px 16px",
              margin: "6px 0",
              maxWidth: "80%",
              fontSize: 16,
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              border: msg.sender === "agent" ? "1px solid #444" : "none"
            }}
          >
            {msg.message}
          </div>
        ))}
        {loading && (
          <div style={{
            alignSelf: "flex-start",
            background: "linear-gradient(135deg, #333, #555)",
            color: "#fff",
            borderRadius: 16,
            padding: "12px 16px",
            margin: "6px 0",
            maxWidth: "80%",
            fontSize: 16,
            opacity: 0.7
          }}>
            Athena is thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{ display: "flex", gap: 12 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) handleSend();
          }}
          placeholder="Type your message to Athena..."
          style={{ 
            flex: 1, 
            padding: 12, 
            borderRadius: 8, 
            border: "1px solid #444",
            background: "#222",
            color: "#fff",
            fontSize: 16,
            outline: "none"
          }}
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{ 
            padding: "12px 20px", 
            borderRadius: 8, 
            background: loading || !input.trim() 
              ? "#444" 
              : "linear-gradient(135deg, #00d4ff, #0099cc)", 
            color: loading || !input.trim() ? "#888" : "#000", 
            border: "none",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            fontSize: 16,
            fontWeight: "bold",
            transition: "all 0.2s"
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
