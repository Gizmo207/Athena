'use client'
import { useEffect, useState } from 'react';

const greetings = [
  "Welcome back, Commander. Standing by.",
  "Systems online. Priorities synced.", 
  "Operational integrity: optimal.",
  "Awaiting your next directive.",
  "All systems standing by. Let's make it count.",
  "Neural networks synchronized. Ready for deployment.",
  "Command authority recognized. How may I assist?",
  "Overseer protocols activated. Mission status: active.",
  "Intelligence matrix online. What's our objective?",
  "Strategic systems operational. Your move, Commander."
];

export default function AthenaBootup({ onComplete }: { onComplete: () => void }) {
  const [visible, setVisible] = useState(true);
  const [quote, setQuote] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Pick random greeting
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    setQuote(randomGreeting);

    // Simulate boot progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    // Complete bootup after 4 seconds
    const timeout = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, 4000);

    return () => {
      clearTimeout(timeout);
      clearInterval(progressInterval);
    };
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        background: 'linear-gradient(135deg, #0a0a0f, #1a1a2e, #16213e)',
        fontFamily: 'monospace'
      }}
    >
      {/* Main Athena Logo */}
      <div 
        style={{
          fontSize: 48,
          fontWeight: 'bold',
          marginBottom: 32,
          animation: 'pulse 2s infinite',
          color: '#00d4ff',
          textShadow: '0 0 20px rgba(0,212,255,0.5), 0 0 40px rgba(0,212,255,0.3)',
          letterSpacing: '0.2em'
        }}
      >
        ATHENA
      </div>

      {/* Boot Status */}
      <div style={{ fontSize: 20, marginBottom: 16, color: '#00ff88' }}>
        OVERSEER SYSTEM INITIALIZING...
      </div>

      {/* Progress Bar */}
      <div 
        style={{
          width: 320,
          height: 8,
          marginBottom: 24,
          borderRadius: 9999,
          overflow: 'hidden',
          backgroundColor: 'rgba(255,255,255,0.1)'
        }}
      >
        <div 
          style={{
            height: '100%',
            transition: 'all 0.3s',
            borderRadius: 9999,
            width: `${Math.min(progress, 100)}%`,
            background: 'linear-gradient(90deg, #00d4ff, #00ff88)',
            boxShadow: '0 0 10px rgba(0,212,255,0.5)'
          }}
        />
      </div>

      {/* Boot Steps */}
      <div style={{ 
        fontSize: 14, 
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        marginBottom: 32,
        textAlign: 'center',
        color: '#aaa'
      }}>
        <div>✓ Neural networks synchronized</div>
        <div>✓ Memory systems online</div>
        <div>✓ Command protocols loaded</div>
        <div>✓ Agent coordination matrix active</div>
      </div>

      {/* Random Greeting */}
      <div 
        style={{
          fontSize: 18,
          fontStyle: 'italic',
          textAlign: 'center',
          maxWidth: 448,
          color: '#00d4ff',
          textShadow: '0 0 10px rgba(0,212,255,0.3)'
        }}
      >
        "{quote}"
      </div>
    </div>
  );
}
