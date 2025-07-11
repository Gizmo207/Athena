"use client";

import { useState, useEffect } from 'react';
import { SessionManager } from '@/lib/sessionManager';
import { Session as EnhancedSession, SessionStore } from '@/types/chat';

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
  onCollapseChange?: (isCollapsed: boolean) => void;
}

export default function SessionSidebar({ 
  currentSessionId, 
  onSessionChange, 
  onNewSession,
  onCollapseChange
}: SessionSidebarProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Enhanced session management
  const [sessionStore, setSessionStore] = useState<SessionStore | null>(null);

  // Filter sessions based on search term
  const filteredSessions = sessions.filter(session => 
    session.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Notify parent when collapse state changes
  const handleCollapseToggle = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    onCollapseChange?.(collapsed);
  };

  // Notify parent of initial state
  useEffect(() => {
    onCollapseChange?.(isCollapsed);
  }, [isCollapsed, onCollapseChange]);

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

  // Initialize enhanced session management
  useEffect(() => {
    const initializeEnhancedSessions = async () => {
      try {
        const store = await SessionManager.loadSessions();
        setSessionStore(store);
        
        // Sync enhanced sessions with legacy format
        const enhancedSessions = Object.values(store.sessions)
          .filter(s => !s.isArchived)
          .map(s => ({
            id: s.id,
            name: s.title,
            timestamp: new Date(s.updatedAt),
            lastMessage: s.messages.length > 0 
              ? s.messages[s.messages.length - 1].content.slice(0, 100) + '...'
              : 'New conversation'
          }))
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        
        // Merge with existing sessions, preferring enhanced data
        setSessions(prevSessions => {
          const enhancedIds = new Set(enhancedSessions.map(s => s.id));
          const legacyOnly = prevSessions.filter(s => !enhancedIds.has(s.id));
          return [...enhancedSessions, ...legacyOnly];
        });
      } catch (error) {
        console.error('Failed to initialize enhanced sessions:', error);
      }
    };
    
    initializeEnhancedSessions();
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
  const updateCurrentSession = async (lastMessage: string) => {
    // Update legacy session format
    setSessions(prev => {
      const existing = prev.find(s => s.id === currentSessionId);
      if (existing) {
        return prev.map(s => 
          s.id === currentSessionId 
            ? { ...s, lastMessage: lastMessage.slice(0, 100) + '...', timestamp: new Date() }
            : s
        );
      } else {
        const newSession: Session = {
          id: currentSessionId,
          name: `Session ${prev.length + 1}`,
          timestamp: new Date(),
          lastMessage: lastMessage.slice(0, 100) + '...'
        };
        return [newSession, ...prev];
      }
    });

    // Update enhanced session store if available
    if (sessionStore) {
      try {
        const enhancedSession = sessionStore.sessions[currentSessionId];
        if (enhancedSession) {
          // Session already exists in enhanced store, will be updated by main page
        } else {
          // Create new enhanced session if it doesn't exist
          const newEnhancedSession = SessionManager.createNewSession(
            `Session ${Object.keys(sessionStore.sessions).length + 1}`,
            'user'
          );
          
          const updatedStore: SessionStore = {
            ...sessionStore,
            sessions: { ...sessionStore.sessions, [currentSessionId]: { ...newEnhancedSession, id: currentSessionId } },
            currentSessionId: currentSessionId
          };
          
          await SessionManager.saveSessions(updatedStore);
          setSessionStore(updatedStore);
        }
      } catch (error) {
        console.error('Failed to update enhanced session:', error);
      }
    }
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
          onClick={() => handleCollapseToggle(false)}
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
          onClick={() => handleCollapseToggle(true)}
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

      {/* Action Buttons */}
      <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={onNewSession}
          style={{
            width: '100%',
            padding: '12px',
            background: 'linear-gradient(135deg, #00d4ff, #0099cc)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontSize: '14px',
            fontWeight: 'bold',
            boxShadow: '0 2px 8px rgba(0,212,255,0.3)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #0099cc, #00d4ff)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #00d4ff, #0099cc)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          + New Chat
        </button>
        
        {/* Search Input */}
        <input
          type="text"
          placeholder="Search chats..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            background: 'rgba(26,26,46,0.8)',
            border: '1px solid rgba(0,212,255,0.3)',
            borderRadius: '6px',
            color: '#e0f7ff',
            fontFamily: 'monospace',
            fontSize: '12px',
            outline: 'none',
            boxSizing: 'border-box'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#00d4ff';
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,212,255,0.2)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* Sessions List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 15px'
      }}>
        {filteredSessions.length === 0 && searchTerm ? (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: '#777',
            fontSize: '12px'
          }}>
            No chats found
          </div>
        ) : (
          filteredSessions.map(session => (
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
        ))
        )}
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
