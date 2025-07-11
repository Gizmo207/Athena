import { NextApiRequest, NextApiResponse } from 'next';
import { Message } from '../../src/types/chat';

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

interface ChatRequest {
  messages: Message[];
  sessionId: string;
  settings?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

interface MistralMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, sessionId, settings = {} }: ChatRequest = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (!MISTRAL_API_KEY) {
      return res.status(500).json({ error: 'Mistral API key not configured' });
    }

    // Convert messages to Mistral format
    const mistralMessages: MistralMessage[] = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Add system message if not present
    if (!mistralMessages.some(msg => msg.role === 'system')) {
      mistralMessages.unshift({
        role: 'system',
        content: `You are ATHENA, an advanced AI assistant with enhanced memory capabilities. 
You have access to a sophisticated memory system that allows you to remember and recall information from previous conversations.
Be helpful, accurate, and thoughtful in your responses. If you reference information that might be from your memory system, mention it naturally.`
      });
    }

    const startTime = Date.now();

    // Call Mistral API
    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model || 'mistral-large-latest',
        messages: mistralMessages,
        temperature: settings.temperature || 0.7,
        max_tokens: settings.maxTokens || 2000,
        stream: false
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Mistral API error:', response.status, errorData);
      throw new Error(`Mistral API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const processingTime = Date.now() - startTime;

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from Mistral API');
    }

    const assistantMessage = data.choices[0].message;
    
    // Extract memory facts in background (non-blocking)
    if (assistantMessage.content) {
      extractMemoryFacts(assistantMessage.content, sessionId).catch(error => {
        console.error('Memory extraction failed:', error);
      });
    }

    return res.status(200).json({
      content: assistantMessage.content,
      model: data.model,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens
      },
      processingTime,
      sessionId
    });

  } catch (error) {
    console.error('Chat API error:', error);
    
    return res.status(500).json({
      error: 'Failed to process chat request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Background memory extraction function
async function extractMemoryFacts(content: string, sessionId: string): Promise<void> {
  try {
    const response = await fetch('/api/memory-extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        sessionId,
        source: 'chat'
      })
    });

    if (!response.ok) {
      console.warn('Memory extraction API failed:', response.status);
    }
  } catch (error) {
    console.error('Memory extraction request failed:', error);
  }
}
