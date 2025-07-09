'use client'
import { useState, useEffect } from 'react';
import { useVoice } from '@/hooks/useVoice';

interface VoiceControlsProps {
  onVoiceInput: (text: string) => void;
  onSpeakToggle?: (enabled: boolean) => void;
  className?: string;
}

export default function VoiceControls({ onVoiceInput, onSpeakToggle, className = '' }: VoiceControlsProps) {
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isListening, isSupported, startListening, speak } = useVoice({
    onResult: (text) => {
      onVoiceInput(text);
      setError(null);
    },
    onError: (errorMsg) => {
      setError(errorMsg);
      setTimeout(() => setError(null), 3000);
    }
  });

  const handleSpeakToggle = () => {
    const newValue = !speakEnabled;
    setSpeakEnabled(newValue);
    onSpeakToggle?.(newValue);
  };

  // Expose speak function for parent component
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).athenaSpeak = speakEnabled ? speak : null;
    }
  }, [speak, speakEnabled]);

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
            ? 'border-neon-red bg-red-500/20 text-red-300 shadow-neon-red animate-pulse'
            : 'border-athena-cyan/50 bg-athena-cyan/10 text-athena-cyan hover:shadow-neon-cyan hover:bg-athena-cyan/20'
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
            ? 'border-athena-green bg-athena-green/20 text-athena-green shadow-neon-green'
            : 'border-gray-500/50 bg-gray-500/10 text-gray-400 hover:border-athena-green/50'
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
