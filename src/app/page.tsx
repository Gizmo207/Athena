"use client";
import { useState, useRef, useEffect } from "react";

export default function Home() {
  const [messages, setMessages] = useState([
    { id: 1, message: "Hello! How can I help you today?", sender: "agent" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageId = useRef(2); // Start from 2 since 1 is used

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
        body: JSON.stringify({ message: userText }),
      });
      const data = await res.json();
      const agentMsg = {
        id: messageId.current++,
        message: data.reply || "No reply.",
        sender: "agent",
      };
      setMessages((msgs) => [...msgs, agentMsg]);
    } catch (e) {
      setMessages((msgs) => [
        ...msgs,
        { id: messageId.current++, message: "Error contacting agent.", sender: "agent" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", border: "1px solid #ccc", borderRadius: 8, padding: 16, background: "#fff", minHeight: 500 }}>
      <div style={{ height: 400, overflowY: "auto", marginBottom: 16, display: "flex", flexDirection: "column" }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
              background: msg.sender === "user" ? "#DCF8C6" : "#F1F0F0",
              color: "#222",
              borderRadius: 16,
              padding: "8px 14px",
              margin: "4px 0",
              maxWidth: "80%",
              fontSize: 16,
            }}
          >
            {msg.message}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder="Type your message..."
          style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{ padding: "8px 16px", borderRadius: 8, background: "#0070f3", color: "#fff", border: "none" }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
