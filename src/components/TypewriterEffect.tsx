import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageProcessor } from '../lib/messageProcessor';

interface TypewriterEffectProps {
  content: string;
  speed?: number; // characters per second
  onComplete?: () => void;
  className?: string;
  stripMarkdown?: boolean;
  autoScroll?: boolean;
  startDelay?: number;
}

export const TypewriterEffect: React.FC<TypewriterEffectProps> = ({
  content,
  speed = 30,
  onComplete,
  className = '',
  stripMarkdown = false,
  autoScroll = true,
  startDelay = 0
}) => {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentIndexRef = useRef(0);
  const processedContentRef = useRef('');
  
  const scrollToBottom = useCallback(() => {
    if (autoScroll && containerRef.current) {
      const container = containerRef.current.closest('.chat-messages-container');
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [autoScroll]);
  
  useEffect(() => {
    // Process content when it changes
    const processed = stripMarkdown 
      ? MessageProcessor.stripMarkdown(content)
      : content;
    
    processedContentRef.current = processed;
    
    // Reset typing state
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    currentIndexRef.current = 0;
    setDisplayedContent('');
    setIsTyping(false);
    setIsComplete(false);
    
    // Define startTyping inside useEffect to avoid stale closures
    const startTypingNow = () => {
      if (!processedContentRef.current) return;
      
      setIsTyping(true);
      const charInterval = 1000 / speed; // milliseconds per character
      
      intervalRef.current = setInterval(() => {
        if (currentIndexRef.current >= processedContentRef.current.length) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsTyping(false);
          setIsComplete(true);
          onComplete?.();
          return;
        }
        
        // Type multiple characters at once for faster feel
        const charsToAdd = Math.min(
          Math.ceil(speed / 15), // Adaptive chunk size based on speed
          processedContentRef.current.length - currentIndexRef.current
        );
        
        currentIndexRef.current += charsToAdd;
        setDisplayedContent(processedContentRef.current.slice(0, currentIndexRef.current));
        
        // Auto-scroll every few characters
        if (currentIndexRef.current % 10 === 0) {
          scrollToBottom();
        }
      }, charInterval);
    };
    
    // Start typing with optional delay
    if (startDelay > 0) {
      setTimeout(startTypingNow, startDelay);
    } else {
      startTypingNow();
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [content, stripMarkdown, startDelay, speed, onComplete, scrollToBottom]); // Include all dependencies
  
  useEffect(() => {
    // Auto-scroll when content updates
    if (displayedContent) {
      scrollToBottom();
    }
  }, [displayedContent, scrollToBottom]);
  
  const skipTyping = useCallback(() => {
    if (isTyping && !isComplete) {
      // Directly reset without calling resetTyping to avoid dependency cycle
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      setDisplayedContent(processedContentRef.current);
      setIsComplete(true);
      setIsTyping(false);
      onComplete?.();
    }
  }, [isTyping, isComplete, onComplete]);
  
  return (
    <div 
      ref={containerRef}
      className={`typewriter-container ${className}`}
      onClick={skipTyping}
      title={isTyping ? "Click to skip typing animation" : ""}
    >
      <div className="typewriter-content">
        {displayedContent}
        {isTyping && (
          <span className="typewriter-cursor animate-pulse">|</span>
        )}
      </div>
      
      {isTyping && (
        <div className="typewriter-controls">
          <button
            onClick={(e) => {
              e.stopPropagation();
              skipTyping();
            }}
            className="skip-button text-xs text-gray-500 hover:text-gray-700 transition-colors"
            title="Skip typing animation"
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
};

interface StreamingTypewriterProps {
  onChunk: (chunk: string) => void;
  onComplete: (fullContent: string) => void;
  onError: (error: Error) => void;
  className?: string;
  speed?: number;
  autoScroll?: boolean;
}

export const StreamingTypewriter: React.FC<StreamingTypewriterProps> = ({
  onChunk,
  onComplete,
  onError,
  className = '',
  speed = 30,
  autoScroll = true
}) => {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const bufferRef = useRef('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const scrollToBottom = useCallback(() => {
    if (autoScroll && containerRef.current) {
      const container = containerRef.current.closest('.chat-messages-container');
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [autoScroll]);
  
  const processBuffer = useCallback(() => {
    if (bufferRef.current.length === 0) return;
    
    const charInterval = 1000 / speed;
    const charsToAdd = Math.min(2, bufferRef.current.length); // Process 2 chars at a time
    
    setDisplayedContent(prev => {
      const newContent = prev + bufferRef.current.slice(0, charsToAdd);
      setTimeout(scrollToBottom, 0); // Async scroll
      return newContent;
    });
    
    bufferRef.current = bufferRef.current.slice(charsToAdd);
  }, [speed, scrollToBottom]);
  
  useEffect(() => {
    if (isStreaming && bufferRef.current.length > 0) {
      intervalRef.current = setInterval(processBuffer, 1000 / speed);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isStreaming, processBuffer, speed]);
  
  const handleNewChunk = useCallback((chunk: string) => {
    bufferRef.current += chunk;
    onChunk(chunk);
  }, [onChunk]);
  
  const handleComplete = useCallback((fullContent: string) => {
    setIsStreaming(false);
    
    // Flush remaining buffer
    if (bufferRef.current.length > 0) {
      setDisplayedContent(prev => prev + bufferRef.current);
      bufferRef.current = '';
    }
    
    onComplete(fullContent);
  }, [onComplete]);
  
  const skipTyping = useCallback(() => {
    if (isStreaming) {
      setIsStreaming(false);
      if (bufferRef.current.length > 0) {
        setDisplayedContent(prev => prev + bufferRef.current);
        bufferRef.current = '';
      }
    }
  }, [isStreaming]);
  
  // Expose handlers for parent component
  useEffect(() => {
    (window as any).__streamingTypewriter = {
      addChunk: handleNewChunk,
      complete: handleComplete,
      error: onError
    };
    
    return () => {
      delete (window as any).__streamingTypewriter;
    };
  }, [handleNewChunk, handleComplete, onError]);
  
  return (
    <div 
      ref={containerRef}
      className={`streaming-typewriter ${className}`}
      onClick={skipTyping}
      title={isStreaming ? "Click to skip typing animation" : ""}
    >
      <div className="typewriter-content">
        {displayedContent}
        {isStreaming && (
          <span className="typewriter-cursor animate-pulse">|</span>
        )}
      </div>
      
      {isStreaming && (
        <div className="typewriter-controls">
          <button
            onClick={(e) => {
              e.stopPropagation();
              skipTyping();
            }}
            className="skip-button text-xs text-gray-500 hover:text-gray-700 transition-colors"
            title="Skip typing animation"
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
};

// Utility hook for managing typewriter state
export const useTypewriterEffect = (
  content: string,
  options: { speed?: number; autoStart?: boolean; stripMarkdown?: boolean } = {}
) => {
  const { speed = 30, autoStart = true, stripMarkdown = false } = options;
  const [displayedContent, setDisplayedContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  
  const startTyping = useCallback(() => {
    if (!content) return;
    
    const processedContent = stripMarkdown 
      ? MessageProcessor.stripMarkdown(content)
      : content;
    
    setIsTyping(true);
    setIsComplete(false);
    setDisplayedContent('');
    
    let index = 0;
    const interval = setInterval(() => {
      if (index >= processedContent.length) {
        clearInterval(interval);
        setIsTyping(false);
        setIsComplete(true);
        return;
      }
      
      const charsToAdd = Math.min(Math.ceil(speed / 15), processedContent.length - index);
      index += charsToAdd;
      setDisplayedContent(processedContent.slice(0, index));
    }, 1000 / speed);
    
    return () => clearInterval(interval);
  }, [content, speed, stripMarkdown]);
  
  const skipTyping = useCallback(() => {
    if (isTyping) {
      const processedContent = stripMarkdown 
        ? MessageProcessor.stripMarkdown(content)
        : content;
      setDisplayedContent(processedContent);
      setIsTyping(false);
      setIsComplete(true);
    }
  }, [content, isTyping, stripMarkdown]);
  
  useEffect(() => {
    if (autoStart && content) {
      startTyping();
    }
  }, [content, autoStart, startTyping]);
  
  return {
    displayedContent,
    isTyping,
    isComplete,
    startTyping,
    skipTyping
  };
};
