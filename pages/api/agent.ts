import { NextApiRequest, NextApiResponse } from 'next';
import { Ollama } from '@langchain/ollama';
import { OllamaEmbeddings } from '@langchain/ollama';
import { HNSWLib } from '@langchain/community/vectorstores/hnswlib';
import { Document } from '@langchain/core/documents';
import { RunnableSequence, RunnablePassthrough } from '@langchain/core/runnables';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ConversationSummaryBufferMemory } from 'langchain/memory';
import athenaPrompt from '../../prompts/athena';
import path from 'path';
import fs from 'fs';
import { AthenaMemoryManager } from '../../lib/memory/AthenaMemoryManager';

// Configuration
const VECTOR_STORE_PATH = path.join(process.cwd(), 'athena-vectorstore');
const OLLAMA_BASE_URL = 'http://localhost:11434';
const OLLAMA_MODEL = 'mistral:instruct';

// Initialize models
const llm = new Ollama({
  baseUrl: OLLAMA_BASE_URL,
  model: OLLAMA_MODEL,
  temperature: 0.7,
});

const embeddings = new OllamaEmbeddings({
  baseUrl: OLLAMA_BASE_URL,
  model: OLLAMA_MODEL,
});

// Global vector store instance
let vectorStore: HNSWLib | null = null;

// Conversation memory for short-term context
const conversationMemory = new ConversationSummaryBufferMemory({
  llm: llm,
  maxTokenLimit: 1000,
  returnMessages: true,
});

// Initialize or load vector store
async function getVectorStore() {
  if (vectorStore) {
    return vectorStore;
  }

  try {
    if (fs.existsSync(VECTOR_STORE_PATH)) {
      console.log('✅ Loading existing vector store...');
      vectorStore = await HNSWLib.load(VECTOR_STORE_PATH, embeddings);
    } else {
      console.log('✨ Creating new vector store...');
      // Create with initial document
      const initDoc = new Document({ 
        pageContent: `I am ATHENA, an Intelligent Overseer Agent designed to coordinate multiple AI systems, manage complex projects, and provide strategic insights. 
        
        My core capabilities include:
        - Strategic planning and problem decomposition
        - Multi-agent coordination and orchestration  
        - Long-term memory and context retention
        - Project management and workflow optimization
        - Research synthesis and decision support
        - Task automation and process improvement
        
        I maintain a professional demeanor while being approachable and helpful. I excel at breaking down complex challenges into manageable components and coordinating resources to achieve optimal outcomes.`,
        metadata: { timestamp: new Date().toISOString(), type: 'core_identity' }
      });
      vectorStore = await HNSWLib.fromDocuments([initDoc], embeddings);
      await vectorStore.save(VECTOR_STORE_PATH);
    }
  } catch (error) {
    console.error('Error with vector store:', error);
    // Fallback: create new store
    const initDoc = new Document({ 
      pageContent: 'I am ATHENA, an Intelligent Overseer Agent specializing in strategic coordination and multi-agent management.',
      metadata: { timestamp: new Date().toISOString(), type: 'core_identity' }
    });
    vectorStore = await HNSWLib.fromDocuments([initDoc], embeddings);
  }

  return vectorStore;
}

// Format retrieved documents for context
function formatDocs(docs: Document[]): string {
  return docs.map(doc => `[${doc.metadata.timestamp}] ${doc.pageContent}`).join('\n\n');
}

// Create the RAG chain using modular Athena persona and memory
async function createRAGChain(customSystemPrompt?: string, sessionContext?: string) {
  const store = await getVectorStore();
  const retriever = store.asRetriever({ k: 5 });

  const template = customSystemPrompt || `[INST]
${athenaPrompt}

📚 CONTEXTUAL MEMORY:
{context}

Recent conversation history:
{chat_history}

Additional session context:
{session_context}

Current message: {question} [/INST]`;
  const prompt = ChatPromptTemplate.fromTemplate(template);

  const chain = RunnableSequence.from([
    {
      context: retriever.pipe(formatDocs),
      question: new RunnablePassthrough(),
      chat_history: () => {
        const raw = conversationMemory.chatHistory;
        if (Array.isArray(raw)) {
          return raw.map(m => `${m.role}: ${m.content}`).join('\n');
        } else if (typeof raw === 'string') {
          return raw;
        }
        return '';
      },
      session_context: () => sessionContext || '',
    },
    prompt,
    llm,
    new StringOutputParser(),
  ]);
  return chain;
}

// Initialize memory manager
const memoryManager = new AthenaMemoryManager();

// Main API handler
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

    console.log(`📦 Processing message`);
    console.log(`� History length: ${history.length} messages`);

    // Step 1: Detect and store new factual memories
    if (/my favorite color is/i.test(message)) {
      await memoryManager.addFact('user', message);
    }

    // Build full prompt using Athena persona and provided history
    const historyArray = history;
    // Step 2: Retrieve relevant memory context
    const memoryContext = await memoryManager.getMemoryContext(message);
    const promptParts: string[] = [];
    promptParts.push('[INST]');
    promptParts.push(athenaPrompt);
    promptParts.push('');
    if (memoryContext) {
      promptParts.push(memoryContext);
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
    const raw = await llm.invoke(promptText);
    const response = raw as string;
    console.log('✅ Agent response generated');

    // Save conversation to memory with agent info
    await conversationMemory.saveContext(
      { input: message },
      { output: response }
    );

    // Save to vector store for long-term memory
    const store = await getVectorStore();
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
    await store.save(VECTOR_STORE_PATH);

    console.log('💾 Conversation saved to long-term memory');

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
