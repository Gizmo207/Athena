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
      className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'} mb-0`}
      style={{ width: '100%' }}
    >
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} w-fit max-w-[70%]`}>
        {/* Name label above bubble, properly aligned */}
        <span
          className="mb-2 font-bold tracking-wide"
          style={{
            color: isUser ? '#7dd3fc' : '#00ff88',
            fontSize: '0.97em',
            letterSpacing: '0.04em',
            opacity: 0.95,
            width: 'fit-content',
            alignSelf: isUser ? 'flex-end' : 'flex-start',
            marginBottom: 8,
            paddingLeft: isUser ? 0 : 8,
            paddingRight: isUser ? 8 : 0,
          }}
        >
          {isUser ? 'YOU' : `🧠 ${agentName}`}
        </span>
        <div
          className={`rounded-2xl px-5 py-4 font-mono transition-all duration-300 whitespace-pre-line break-words relative ${
            isUser
              ? 'bg-gradient-to-r from-indigo-900 to-indigo-800 text-cyan-200 shadow-neon-blue border border-indigo-600/50'
              : 'bg-gradient-to-r from-gray-900 to-black text-cyan-300 shadow-neon-cyan border border-cyan-500/30'
          }`}
          style={{
            display: 'inline-block',
            minWidth: '2.5rem',
            maxWidth: '100%',
            wordBreak: 'break-word',
            backdropFilter: 'blur(10px)',
            boxShadow: isUser
              ? '0 0 20px rgba(0, 153, 255, 0.3), 0 4px 12px rgba(0, 0, 0, 0.4)'
              : '0 0 20px rgba(0, 212, 255, 0.3), 0 4px 12px rgba(0, 0, 0, 0.4)',
            alignSelf: isUser ? 'flex-end' : 'flex-start',
            borderRadius: isUser ? '1.5rem 1.5rem 0.25rem 1.5rem' : '1.5rem 1.5rem 1.5rem 0.25rem',
            marginTop: 0,
            marginBottom: 0,
            position: 'relative',
          }}
        >
          <div className={`text-lg leading-relaxed ${
            isUser ? 'text-cyan-100' : 'text-gray-100'
          }`} style={{ fontSize: '1.05rem', lineHeight: 1.6 }}>
            {message}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
