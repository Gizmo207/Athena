'use client'
import { useState, useCallback } from 'react';

interface UseVoiceOptions {
  onResult: (text: string) => void;
  onError?: (error: string) => void;
}

export function useVoice({ onResult, onError }: UseVoiceOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  // Check if speech recognition is supported
  const checkSupport = useCallback(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      setIsSupported(!!SpeechRecognition);
      return !!SpeechRecognition;
    }
    return false;
  }, []);

  // Start listening for voice input
  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      onError?.('Speech recognition not supported in this browser');
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

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.transcript;
      if (transcript) {
        onResult(transcript);
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      onError?.(event.error || 'Speech recognition error');
    };

    recognition.start();
  }, [onResult, onError]);

  // Stop listening
  const stopListening = useCallback(() => {
    setIsListening(false);
  }, []);

  // Text-to-speech functionality
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

  return {
    isListening,
    isSupported: checkSupport(),
    startListening,
    stopListening,
    speak
  };
}

// Types for global speech recognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
