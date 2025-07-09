import { NextApiRequest, NextApiResponse } from 'next';
import { Ollama } from '@langchain/ollama';
import athenaPrompt from '../../prompts/athena';

// Configuration
const OLLAMA_BASE_URL = 'http://localhost:11434';
const OLLAMA_MODEL = 'mistral:instruct';

// Initialize Ollama LLM
const llm = new Ollama({
  baseUrl: OLLAMA_BASE_URL,
  model: OLLAMA_MODEL,
  temperature: 0.7,
});

// Main API handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('🚀 Athena Simple API called');

  try {
    // Expect message and full chat history from client
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Invalid message provided' });
    }

    console.log(`📦 Processing message: ${message}`);
    console.log(`📚 History length: ${history.length} messages`);

    // Build simple prompt using Athena persona and provided history
    const promptParts: string[] = [];
    promptParts.push('[INST]');
    promptParts.push(athenaPrompt);
    promptParts.push('');
    
    // Add recent conversation history
    history.forEach((m: { role: string; content: string }) => {
      promptParts.push(`${m.role}: ${m.content}`);
    });
    
    promptParts.push('');
    promptParts.push(`User: ${message}`);
    promptParts.push('[/INST]');
    
    const promptText = promptParts.join('\n');
    
    console.log('🤖 Invoking LLM...');
    console.log('📝 Prompt preview:', promptText.substring(0, 200) + '...');
    
    // Call the Ollama LLM
    const response = await llm.call(promptText);
    
    console.log('✅ Agent response generated');
    console.log('📤 Response preview:', response.substring(0, 100) + '...');

    return res.status(200).json({ reply: response });

  } catch (error: any) {
    console.error('💥 API Error:', error);
    console.error('💥 Error stack:', error.stack);
    
    // Handle specific errors
    if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
      return res.status(503).json({ 
        error: 'Cannot connect to Ollama. Please ensure Ollama is running on port 11434.' 
      });
    }

    // Return actual error message for debugging
    return res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: error.stack || 'No stack trace available'
    });
  }
}
