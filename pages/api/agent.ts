import { NextApiRequest, NextApiResponse } from 'next';
import { Ollama } from '@langchain/ollama';
import { OllamaEmbeddings } from '@langchain/ollama';
import { HNSWLib } from '@langchain/community/vectorstores/hnswlib';
import { Document } from '@langchain/core/documents';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence, RunnablePassthrough } from '@langchain/core/runnables';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ConversationSummaryBufferMemory } from 'langchain/memory';
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
        pageContent: 'I am Athena, an intelligent overseer agent. I help coordinate and manage other AI agents.',
        metadata: { timestamp: new Date().toISOString(), type: 'initialization' }
      });
      vectorStore = await HNSWLib.fromDocuments([initDoc], embeddings);
      await vectorStore.save(VECTOR_STORE_PATH);
    }
  } catch (error) {
    console.error('Error with vector store:', error);
    // Fallback: create new store
    const initDoc = new Document({ 
      pageContent: 'I am Athena, an intelligent overseer agent.',
      metadata: { timestamp: new Date().toISOString(), type: 'initialization' }
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
async function createRAGChain() {
  const store = await getVectorStore();
  const retriever = store.asRetriever({
    k: 5, // Retrieve top 5 relevant documents
  });

  const template = `You are Athena, a highly intelligent overseer agent responsible for coordinating and managing AI agents.

Use the following context from our previous conversations to inform your response:
{context}

Recent conversation context:
{chat_history}

Current question: {question}

Guidelines:
- Be helpful, direct, and professional
- Reference relevant past conversations when appropriate
- If you don't have enough context, ask clarifying questions
- Maintain continuity with previous discussions
- Keep responses concise but thorough

Response:`;

  const prompt = ChatPromptTemplate.fromTemplate(template);

  const chain = RunnableSequence.from([
    {
      context: retriever.pipe(formatDocs),
      question: new RunnablePassthrough(),
      chat_history: () => conversationMemory.chatHistory || '',
    },
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
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Invalid message provided' });
    }

    console.log('📦 Processing message:', message);

    // Create the RAG chain
    const chain = await createRAGChain();

    // Get response from chain
    const response = await chain.invoke(message);

    console.log('✅ Athena response generated');

    // Save conversation to memory
    await conversationMemory.saveContext(
      { input: message },
      { output: response }
    );

    // Save to vector store for long-term memory
    const store = await getVectorStore();
    const conversationDoc = new Document({
      pageContent: `User: ${message}\nAthena: ${response}`,
      metadata: {
        timestamp: new Date().toISOString(),
        type: 'conversation',
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
