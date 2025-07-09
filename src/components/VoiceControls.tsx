'use client'
import { useState, useEffect, useCallback } from 'react';

interface VoiceControlsProps {
  onVoiceInput: (text: string) => void;
  onSpeakToggle?: (enabled: boolean) => void;
  className?: string;
}

export default function VoiceControls({ onVoiceInput, onSpeakToggle, className = '' }: VoiceControlsProps) {
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  // Check support once on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      setIsSupported(!!SpeechRecognition);
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined') return;
    
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Try to use a female voice
    const voices = synth.getVoices();
    const femaleVoice = voices.find(voice => 
      voice.name.toLowerCase().includes('female') || 
      voice.name.toLowerCase().includes('samantha') ||
      voice.name.toLowerCase().includes('zira') ||
      voice.name.toLowerCase().includes('hazel')
    );
    
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }
    
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    utterance.volume = 0.8;
    
    synth.speak(utterance);
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0]?.transcript;
      if (transcript) {
        onVoiceInput(transcript);
        setError(null);
      }
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      setError(event.error || 'Speech recognition error');
    };

    recognition.start();
  }, [onVoiceInput]);

  const handleSpeakToggle = useCallback(() => {
    const newValue = !speakEnabled;
    setSpeakEnabled(newValue);
    onSpeakToggle?.(newValue);
  }, [speakEnabled, onSpeakToggle]);

  // Store speak function globally when enabled
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).athenaSpeak = speakEnabled ? speak : null;
    }
  }, [speakEnabled, speak]);

  // Clear error after 3 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (!isSupported) {
    return (
      <div className={`text-xs text-gray-500 font-mono ${className}`}>
        🎤 Voice not supported in this browser
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Voice Input Button */}
      <button
        onClick={startListening}
        disabled={isListening}
        className={`relative px-4 py-2 rounded-lg border-2 font-mono text-sm font-bold transition-all duration-300 ${
          isListening
            ? 'border-red-500 bg-red-500/20 text-red-300 animate-pulse'
            : 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20'
        }`}
        style={{
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {isListening ? '🔴' : '🎤'}
          </span>
          <span>
            {isListening ? 'LISTENING...' : 'VOICE'}
          </span>
        </div>
        
        {isListening && (
          <div className="absolute inset-0 rounded-lg border-2 border-red-400 animate-ping"></div>
        )}
      </button>

      {/* TTS Toggle */}
      <button
        onClick={handleSpeakToggle}
        className={`px-3 py-2 rounded-lg border-2 font-mono text-sm transition-all duration-300 ${
          speakEnabled
            ? 'border-green-500 bg-green-500/20 text-green-300'
            : 'border-gray-500/50 bg-gray-500/10 text-gray-400 hover:border-green-500/50'
        }`}
        style={{
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="flex items-center gap-1">
          <span className="text-lg">
            {speakEnabled ? '🔊' : '🔇'}
          </span>
          <span className="hidden sm:inline">
            TTS
          </span>
        </div>
      </button>

      {/* Error Display */}
      {error && (
        <div className="absolute top-full left-0 mt-2 px-3 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-xs font-mono backdrop-blur-lg">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
