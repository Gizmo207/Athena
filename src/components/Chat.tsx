import React, { useState, useRef } from 'react';

export default function Chat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! I'm your AI agent assistant. How can I help you today?",
      sender: 'Agent',
      direction: 'incoming',
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), text: input.trim(), sender: 'User', direction: 'outgoing' },
    ]);
    setInput('');
    setIsTyping(true);
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: input.trim() }),
      });
      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, text: data.output || 'Sorry, I couldn\'t process that request.', sender: 'Agent', direction: 'incoming' },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 2, text: 'Sorry, I encountered an error. Please try again.', sender: 'Agent', direction: 'incoming' },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="chat-wrapper max-w-2xl mx-auto p-4 flex flex-col h-[600px]">
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
            <div className={`px-4 py-2 rounded-2xl shadow-md max-w-[80%] text-base font-medium ${msg.direction === 'outgoing' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="px-4 py-2 rounded-2xl shadow-md max-w-[80%] bg-gray-200 dark:bg-gray-800 animate-pulse text-gray-900 dark:text-gray-100">
              Agent is typing...
            </div>
          </div>
        )}
      </div>
      <form onSubmit={handleSend} className="w-full flex flex-col items-center">
        <div className="relative w-full flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full text-lg px-6 py-4 rounded-full bg-[var(--background)] text-[var(--foreground)] border-2 border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-400/40 shadow-lg transition-all duration-200 placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="Type your message here..."
            style={{ boxShadow: '0 0 12px 2px rgba(59,130,246,0.4)' }}
          />
          {/* Voice button placeholder */}
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all duration-200"
            aria-label="Voice input (coming soon)"
            style={{ boxShadow: '0 0 8px 2px rgba(59,130,246,0.4)' }}
            disabled
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v2m0 0a4 4 0 01-4-4h8a4 4 0 01-4 4zm0 0V6a4 4 0 018 0v6a4 4 0 01-8 0z" />
            </svg>
          </button>
        </div>
        <button
          type="submit"
          className="mt-4 w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-400/40 transition-all duration-200"
          style={{ boxShadow: '0 0 18px 2px rgba(59,130,246,0.4)' }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
