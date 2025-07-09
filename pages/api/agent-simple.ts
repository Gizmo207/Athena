import { NextApiRequest, NextApiResponse } from 'next';
import { Ollama } from '@langchain/ollama';
import { Document } from '@langchain/core/documents';
import { ConversationSummaryBufferMemory } from 'langchain/memory';
import { AthenaMemoryManager } from '../../lib/memory/AthenaMemoryManager';
import { sanitizeDates } from '../../lib/utils/dateSanitizer';
import { storeConversationSummary, getRecentSummaries } from '../../lib/memory/conversationLogger';

// Configuration
const OLLAMA_BASE_URL = 'http://localhost:11434';
const OLLAMA_MODEL = 'mistral:instruct';

// Initialize models
const llm = new Ollama({
  baseUrl: OLLAMA_BASE_URL,
  model: OLLAMA_MODEL,
  temperature: 0.7,
});

// Conversation memory for short-term context
const conversationMemory = new ConversationSummaryBufferMemory({
  llm: llm,
  maxTokenLimit: 1000,
  returnMessages: true,
});

// Initialize memory manager
const memoryManager = new AthenaMemoryManager();

// Main API handler (modular, strict, future-proofed)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('🚀 Athena RAG API called');

  try {
    // Expect message, shortTermBuffer, and userId from client
    const { message, shortTermBuffer = [], userId = 'user' } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Invalid message provided' });
    }

    console.log(`📦 Processing message: "${message}"`);
    console.log(`📜 STM buffer length: ${shortTermBuffer.length} messages`);

    // Step 1: Detect and store new factual memories
    console.log('🧠 Step 1: Extracting and storing facts...');
    await memoryManager.addFact(userId, message);

    // --- Retrieve recent conversation summaries ---
    console.log('📝 Step 2: Retrieving recent summaries...');
    let recentSummaries: string[] = [];
    try {
      recentSummaries = await getRecentSummaries(userId, 3);
      console.log(`📋 Found ${recentSummaries.length} recent summaries`);
    } catch (err) {
      console.warn('Could not retrieve recent summaries:', err);
    }

    // --- Build prompt using only STM, LTM, and user message (no persona) ---
    console.log('🧠 Step 3: Building memory context...');
    const memoryContext = await memoryManager.getMemoryContext(message);
    
    // Build short-term conversation context
    const stmContext = shortTermBuffer.map((m: any) => 
      `${m.role === 'user' ? 'YOU' : 'ATHENA'}: ${m.content}`
    ).join('\n');

    const promptParts: string[] = [];
    promptParts.push('[INST]');
    promptParts.push('You are ATHENA, an intelligent overseer agent. Respond authoritatively based on the context provided.');
    promptParts.push('');
    
    if (memoryContext) {
      promptParts.push('📚 LONG-TERM MEMORY (retrieved facts):');
      promptParts.push(memoryContext);
      promptParts.push('');
      console.log('✅ Memory context injected into prompt');
    } else {
      console.log('ℹ️ No memory context found');
    }
    
    if (recentSummaries.length > 0) {
      promptParts.push('📝 RECENT SESSION SUMMARIES:');
      recentSummaries.forEach((s, i) => promptParts.push(`Summary ${i + 1}: ${s}`));
      promptParts.push('');
    }
    
    if (stmContext) {
      promptParts.push('📋 CONVERSATION CONTEXT:');
      promptParts.push(stmContext);
      promptParts.push('');
    }
    
    promptParts.push(`YOU: ${message}`);
    promptParts.push('[/INST]');
    promptParts.push('ATHENA:');
    const promptText = promptParts.join('\n');
    console.log('🤖 Invoking LLM with full prompt...');
    
    // Call the Ollama LLM with the assembled prompt
    let response = await llm.call(promptText);
    console.log('✅ Agent response generated');

    // Gather known dates from memory for date sanitization
    let knownDates: string[] = [];
    try {
      const facts = await memoryManager.showMemory();
      knownDates = facts
        .filter(f => /date|birthday|anniversary|event/i.test(f.key) && f.value)
        .map(f => f.value);
    } catch (err) {
      console.warn('Could not retrieve known dates for sanitization:', err);
    }

    // Sanitize dates in Athena's response
    response = sanitizeDates(response, knownDates);

    // Update short-term buffer with the new exchange
    const updatedSTM = [...shortTermBuffer, 
      { role: 'user', content: message },
      { role: 'assistant', content: response }
    ].slice(-5); // Keep only last 5 messages (about 2-3 exchanges)

    // --- Generate and store a session summary ---
    try {
      // Simple summary: use the updated STM for context
      const summaryText = updatedSTM.map((m: any) => `${m.role}: ${m.content}`).join(' | ');
      await storeConversationSummary(userId, summaryText, new Date().toISOString());
    } catch (err) {
      console.warn('Could not store conversation summary:', err);
    }

    console.log('💾 Response completed and STM updated');

    return res.status(200).json({ 
      reply: response, 
      shortTermBuffer: updatedSTM 
    });

  } catch (error: any) {
    console.error('💥 API Error:', error);
    
    // Handle specific errors
    if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
      return res.status(503).json({ 
        error: 'Cannot connect to Ollama. Please ensure Ollama is running on port 11434.' 
      });
    }

    // Return actual error message for debugging
    return res.status(500).json({ 
      error: error.message || 'Internal server error',
    });
  }
}
