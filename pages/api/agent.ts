import { NextApiRequest, NextApiResponse } from 'next';
import { Ollama } from '@langchain/ollama';
import { OllamaEmbeddings } from '@langchain/ollama';
import { HNSWLib } from '@langchain/community/vectorstores/hnswlib';
import { Document } from '@langchain/core/documents';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence, RunnablePassthrough } from '@langchain/core/runnables';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ConversationSummaryBufferMemory } from 'langchain/memory';
import athenaPrompt from '../../prompts/athena';
import path from 'path';
import fs from 'fs';

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

// Create the RAG chain
async function createRAGChain(customSystemPrompt?: string, sessionContext?: string) {
  const store = await getVectorStore();
  const retriever = store.asRetriever({
    k: 5, // Retrieve top 5 relevant documents
  });

  const template = customSystemPrompt || `[INST] ${athenaPrompt}

📚 CONTEXTUAL MEMORY:
Context from previous conversations:
{context}

Recent conversation history:
{chat_history}

Additional session context:
{session_context}

Current message: {question} [/INST]`;

  const prompt = ChatPromptTemplate.fromTemplate(template);

  // Simplified chain that directly formats the context
  const formatContext = async (question: string) => {
    const docs = await retriever.invoke(question);
    const contextText = formatDocs(docs);
    const chatHistory = conversationMemory.chatHistory || '';
    
    return {
      context: contextText,
      chat_history: chatHistory,
      session_context: sessionContext || '',
      question: question
    };
  };

  const chain = RunnableSequence.from([
    formatContext,
    prompt,
    llm,
    new StringOutputParser(),
  ]);

  return chain;
}

// Main API handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('🚀 Athena RAG API called');

  try {
    const { message, agent = 'athena', systemPrompt, context } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Invalid message provided' });
    }

    console.log(`📦 Processing message for agent: ${agent}`);
    console.log(`📝 Context provided: ${context ? 'Yes' : 'No'}`);
    console.log(`📄 Context length: ${context ? context.length : 0} characters`);

    // Create the RAG chain with custom system prompt and context if provided
    console.log('🔧 Creating RAG chain...');
    const chain = await createRAGChain(systemPrompt, context);

    // Get response from chain - pass just the message since RunnablePassthrough expects the input directly
    console.log('🤖 Invoking chain with message...');
    
    // Add timeout to prevent hanging
    const responsePromise = chain.invoke(message);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
    );
    
    const response = await Promise.race([responsePromise, timeoutPromise]);

    console.log('✅ Agent response generated');

    // Save conversation to memory with agent info
    await conversationMemory.saveContext(
      { input: message },
      { output: response }
    );

    // Save to vector store for long-term memory
    const store = await getVectorStore();
    const conversationDoc = new Document({
      pageContent: `User: ${message}\n${agent.toUpperCase()}: ${response}`,
      metadata: {
        timestamp: new Date().toISOString(),
        type: 'conversation',
        agent: agent,
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

    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
    });
  }
}
