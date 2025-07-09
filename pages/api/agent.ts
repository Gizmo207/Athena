import { NextApiRequest, NextApiResponse } from 'next';
import { Ollama } from '@langchain/ollama';
import athenaPrompt from '../../prompts/athena'; // Modular prompt loading
import { Document } from '@langchain/core/documents';
import { ConversationSummaryBufferMemory } from 'langchain/memory';
import { AthenaMemoryManager } from '../../lib/memory/AthenaMemoryManager';
import { sanitizeDates } from '../../lib/utils/dateSanitizer';
import { storeConversationSummary, getRecentSummaries } from '../../lib/memory/conversationLogger';
import { getChromaStore } from '../../lib/vectorstore/chroma';

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
    // Expect message and full chat history from client
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Invalid message provided' });
    }

    console.log(`📦 Processing message: "${message}"`);
    console.log(`📜 History length: ${history.length} messages`);

    // Step 1: Detect and store new factual memories
    console.log('🧠 Step 1: Extracting and storing facts...');
    await memoryManager.addFact('user', message);

    // --- Retrieve recent conversation summaries ---
    console.log('📝 Step 2: Retrieving recent summaries...');
    let recentSummaries: string[] = [];
    try {
      recentSummaries = await getRecentSummaries('user', 3);
      console.log(`📋 Found ${recentSummaries.length} recent summaries`);
    } catch (err) {
      console.warn('Could not retrieve recent summaries:', err);
    }

    // --- Build full prompt using Athena persona, memory, and summaries ---
    console.log('🧠 Step 3: Building memory context...');
    const historyArray = history;
    const memoryContext = await memoryManager.getMemoryContext(message);
    const promptParts: string[] = [];
    promptParts.push('[INST]');
    promptParts.push(athenaPrompt);
    promptParts.push('');
    if (memoryContext) {
      promptParts.push('📚 LONG-TERM MEMORY:');
      promptParts.push(memoryContext);
      promptParts.push('');
    }
    if (recentSummaries.length > 0) {
      promptParts.push('📝 RECENT SESSION SUMMARIES:');
      recentSummaries.forEach((s, i) => promptParts.push(`Summary ${i + 1}: ${s}`));
      promptParts.push('');
    }
    historyArray.forEach((m: { role: string; content: string }) => {
      promptParts.push(`${m.role}: ${m.content}`);
    });
    promptParts.push('');
    promptParts.push(`User: ${message}`);
    promptParts.push('[/INST]');
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

    // --- Generate and store a session summary ---
    try {
      // Simple summary: use the last 4 messages for context
      const summaryText = historyArray.slice(-4).map((m: any) => `${m.role}: ${m.content}`).join(' | ') + ` | user: ${message} | agent: ${response}`;
      await storeConversationSummary('user', summaryText, new Date().toISOString());
    } catch (err) {
      console.warn('Could not store conversation summary:', err);
    }

    // Save conversation to memory with agent info
    await conversationMemory.saveContext(
      { input: message },
      { output: response }
    );

    // Save to Chroma vector store for long-term memory
    const store = await getChromaStore();
    const conversationDoc = new Document({
      pageContent: `User: ${message}\nATHENA: ${response}`,
      metadata: {
        timestamp: new Date().toISOString(),
        type: 'conversation',
        agent: 'athena',
        user_message: message,
        assistant_response: response,
      },
    });

    await store.addDocuments([conversationDoc]);
    console.log('💾 Conversation saved to Chroma long-term memory');

    return res.status(200).json({ reply: response });

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
