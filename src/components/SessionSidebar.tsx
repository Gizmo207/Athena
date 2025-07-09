"use client";

import { useState, useEffect } from 'react';

interface Session {
  id: string;
  name: string;
  timestamp: Date;
  lastMessage: string;
}

interface SessionSidebarProps {
  currentSessionId: string;
  onSessionChange: (sessionId: string) => void;
  onNewSession: () => void;
}

export default function SessionSidebar({ 
  currentSessionId, 
  onSessionChange, 
  onNewSession 
}: SessionSidebarProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load sessions from localStorage on mount
  useEffect(() => {
    const loadSessions = () => {
      try {
        const storedSessions = localStorage.getItem('athena_sessions');
        if (storedSessions) {
          const parsed = JSON.parse(storedSessions);
          setSessions(parsed.map((s: any) => ({
            ...s,
            timestamp: new Date(s.timestamp)
          })));
        }
      } catch (err) {
        console.warn('Failed to load sessions:', err);
      }
    };
    loadSessions();
  }, []);

  // Save sessions to localStorage when sessions change
  useEffect(() => {
    try {
      localStorage.setItem('athena_sessions', JSON.stringify(sessions));
    } catch (err) {
      console.warn('Failed to save sessions:', err);
    }
  }, [sessions]);

  // Add or update current session
  const updateCurrentSession = (lastMessage: string) => {
    setSessions(prev => {
      const existing = prev.find(s => s.id === currentSessionId);
      if (existing) {
        return prev.map(s => 
          s.id === currentSessionId 
            ? { ...s, lastMessage, timestamp: new Date() }
            : s
        );
      } else {
        const newSession: Session = {
          id: currentSessionId,
          name: `Session ${prev.length + 1}`,
          timestamp: new Date(),
          lastMessage
        };
        return [newSession, ...prev];
      }
    });
  };

  // Expose method for parent to update session
  useEffect(() => {
    (window as any).updateAthenaSession = updateCurrentSession;
    return () => {
      delete (window as any).updateAthenaSession;
    };
  }, [currentSessionId]);

  const formatTimestamp = (date: Date) => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isCollapsed) {
    return (
      <div 
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width: '40px',
          background: 'rgba(10,10,15,0.95)',
          borderRight: '2px solid #00d4ff',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '20px'
        }}
      >
        <button
          onClick={() => setIsCollapsed(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#00d4ff',
            fontSize: '20px',
            cursor: 'pointer',
            marginBottom: '20px'
          }}
        >
          ▶
        </button>
        <button
          onClick={onNewSession}
          style={{
            background: 'none',
            border: '1px solid #00d4ff',
            color: '#00d4ff',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '4px'
          }}
        >
          +
        </button>
      </div>
    );
  }

  return (
    <div 
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: '300px',
        background: 'rgba(10,10,15,0.95)',
        borderRight: '2px solid #00d4ff',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'monospace'
      }}
    >
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid rgba(0,212,255,0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ 
          color: '#00d4ff', 
          margin: 0, 
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
          Sessions
        </h3>
        <button
          onClick={() => setIsCollapsed(true)}
          style={{
            background: 'none',
            border: 'none',
            color: '#00d4ff',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          ◀
        </button>
      </div>

      {/* New Session Button */}
      <div style={{ padding: '15px' }}>
        <button
          onClick={onNewSession}
          style={{
            width: '100%',
            padding: '12px',
            background: 'rgba(0,212,255,0.1)',
            border: '1px solid #00d4ff',
            borderRadius: '6px',
            color: '#00d4ff',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          + New Session
        </button>
      </div>

      {/* Sessions List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 15px'
      }}>
        {sessions.map(session => (
          <div
            key={session.id}
            onClick={() => onSessionChange(session.id)}
            style={{
              padding: '12px',
              marginBottom: '8px',
              background: session.id === currentSessionId 
                ? 'rgba(0,212,255,0.2)' 
                : 'rgba(26,26,46,0.5)',
              border: session.id === currentSessionId 
                ? '1px solid #00d4ff' 
                : '1px solid rgba(0,212,255,0.3)',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{
              color: '#00d4ff',
              fontSize: '14px',
              fontWeight: 'bold',
              marginBottom: '4px'
            }}>
              {session.name}
            </div>
            <div style={{
              color: '#aaa',
              fontSize: '11px',
              marginBottom: '6px'
            }}>
              {formatTimestamp(session.timestamp)}
            </div>
            <div style={{
              color: '#ccc',
              fontSize: '12px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {session.lastMessage || 'No messages yet'}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '15px',
        borderTop: '1px solid rgba(0,212,255,0.3)',
        color: '#777',
        fontSize: '11px',
        textAlign: 'center'
      }}>
        {sessions.length} session{sessions.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
