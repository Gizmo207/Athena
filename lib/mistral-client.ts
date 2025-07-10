import { Mistral } from '@mistralai/mistralai';

// Configuration
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const DEFAULT_MODEL = 'mistral-large-latest';
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_TOKENS = 1000;

if (!MISTRAL_API_KEY) {
  console.warn('⚠️ MISTRAL_API_KEY not found in environment variables');
}

// Initialize Mistral client
const mistralClient = new Mistral({
  apiKey: MISTRAL_API_KEY || '',
});

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MistralChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  retries?: number;
}

/**
 * Main chat completion function with error handling and retry logic
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: MistralChatOptions = {}
): Promise<string> {
  const {
    model = DEFAULT_MODEL,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
    retries = 3
  } = options;

  if (!MISTRAL_API_KEY) {
    throw new Error('Mistral API key not configured. Please set MISTRAL_API_KEY environment variable.');
  }

  let lastError: Error | null = null;

  // Retry logic
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🤖 Mistral API call attempt ${attempt}/${retries}`);
      console.log(`📝 Model: ${model}, Messages: ${messages.length}`);

      const response = await mistralClient.chat.complete({
        model,
        messages,
        temperature,
        maxTokens,
      });

      const content = response.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content in Mistral response');
      }

      console.log('✅ Mistral response received successfully');
      return content.trim();

    } catch (error: any) {
      lastError = error;
      console.error(`❌ Mistral API attempt ${attempt} failed:`, error.message);

      // Check if it's a rate limit error
      if (error.status === 429 && attempt < retries) {
        const backoffDelay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`⏳ Rate limited. Waiting ${backoffDelay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        continue;
      }

      // Check if it's a temporary error
      if (error.status >= 500 && attempt < retries) {
        const delay = 1000 * attempt; // Linear backoff for server errors
        console.log(`⏳ Server error. Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // If it's the last attempt or a non-retryable error, break
      if (attempt === retries || error.status === 401 || error.status === 403) {
        break;
      }
    }
  }

  // If we get here, all retries failed
  const errorMessage = lastError?.message || 'Unknown error';
  const errorStatus = (lastError as any)?.status || 'unknown';
  
  console.error(`💥 All Mistral API attempts failed. Last error: ${errorMessage}`);
  
  // Provide user-friendly error messages
  if (errorStatus === 401) {
    throw new Error('Invalid Mistral API key. Please check your MISTRAL_API_KEY environment variable.');
  } else if (errorStatus === 429) {
    throw new Error('Rate limit exceeded. Please try again later.');
  } else if (errorStatus >= 500) {
    throw new Error('Mistral API is currently unavailable. Please try again later.');
  } else {
    throw new Error(`Mistral API error: ${errorMessage}`);
  }
}

/**
 * Simple text completion function for backward compatibility
 */
export async function simpleCompletion(
  prompt: string,
  options: MistralChatOptions = {}
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'user', content: prompt }
  ];

  return chatCompletion(messages, options);
}

/**
 * Athena-specific chat completion with system prompt
 */
export async function athenaCompletion(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
  options: MistralChatOptions = {}
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ];

  return chatCompletion(messages, options);
}

/**
 * Token estimation (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Validate API key setup
 */
export async function validateMistralSetup(): Promise<boolean> {
  try {
    const testResponse = await simpleCompletion('Hello', { maxTokens: 10 });
    return testResponse.length > 0;
  } catch (error) {
    console.error('Mistral setup validation failed:', error);
    return false;
  }
}

/**
 * Test Mistral API connection with detailed results
 */
export async function testMistralConnection(): Promise<{ success: boolean; details: any }> {
  try {
    const startTime = Date.now();
    const testResponse = await simpleCompletion('Test connection', { maxTokens: 10 });
    const endTime = Date.now();
    
    return {
      success: true,
      details: {
        responseTime: endTime - startTime,
        responseLength: testResponse.length,
        model: DEFAULT_MODEL,
        apiKeyPresent: !!MISTRAL_API_KEY,
        response: testResponse.substring(0, 50) + (testResponse.length > 50 ? '...' : '')
      }
    };
  } catch (error) {
    return {
      success: false,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        model: DEFAULT_MODEL,
        apiKeyPresent: !!MISTRAL_API_KEY,
      }
    };
  }
}

export { mistralClient };
