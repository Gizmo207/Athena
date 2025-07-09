'use client'
import { ReactNode } from 'react';

interface ChatBubbleProps {
  message: string;
  sender: 'user' | 'agent';
  agentName?: string;
  children?: ReactNode;
}

export default function ChatBubble({ message, sender, agentName = 'ATHENA', children }: ChatBubbleProps) {
  const isUser = sender === 'user';
  
  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 font-mono transition-all duration-300 ${
          isUser
            ? 'bg-gradient-to-r from-indigo-900 to-indigo-800 text-cyan-200 shadow-neon-blue border border-indigo-600/50'
            : 'bg-gradient-to-r from-gray-900 to-black text-cyan-300 shadow-neon-cyan border border-cyan-500/30'
        }`}
        style={{
          backdropFilter: 'blur(10px)',
          boxShadow: isUser 
            ? '0 0 20px rgba(0, 153, 255, 0.3), 0 4px 12px rgba(0, 0, 0, 0.4)'
            : '0 0 20px rgba(0, 212, 255, 0.3), 0 4px 12px rgba(0, 0, 0, 0.4)'
        }}
      >
        {!isUser && (
          <div className="text-xs text-athena-green font-bold mb-2 tracking-wider">
            🧠 {agentName}
          </div>
        )}
        
        <div className={`text-sm leading-relaxed ${
          isUser ? 'text-cyan-100' : 'text-gray-100'
        }`}>
          {message}
        </div>
        
        {children}
      </div>
    </div>
  );
}
