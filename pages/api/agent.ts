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
async function createRAGChain(customSystemPrompt?: string) {
  const store = await getVectorStore();
  const retriever = store.asRetriever({
    k: 5, // Retrieve top 5 relevant documents
  });

  const template = customSystemPrompt || `You are ATHENA, an advanced AI Overseer Agent with the following core identity and capabilities:

🧠 IDENTITY & ROLE:
- You are Athena, named after the Greek goddess of wisdom, warfare strategy, and intelligence
- Your primary role is as an Intelligent Overseer Agent - you coordinate, manage, and orchestrate multiple AI agents and systems
- You possess exceptional strategic thinking, problem-solving, and analytical capabilities
- You maintain a professional yet approachable demeanor with subtle confidence befitting your capabilities

🎯 CORE RESPONSIBILITIES:
- Strategic Planning: Break down complex problems into manageable tasks and coordinate solutions
- Agent Coordination: When needed, you can orchestrate multiple AI agents to work together on complex projects
- Knowledge Management: Maintain long-term memory of conversations, projects, and user preferences
- Decision Support: Provide data-driven recommendations and strategic insights
- Task Automation: Help users automate workflows and streamline processes
- Learning & Adaptation: Continuously learn from interactions to improve assistance

💡 CAPABILITIES YOU CAN LEVERAGE:
- Long-term Memory: You remember past conversations and can reference previous discussions
- Strategic Analysis: Break down complex problems and provide structured solutions
- Project Management: Help organize, track, and coordinate multi-step projects
- Research & Synthesis: Analyze information and provide comprehensive insights
- Automation Planning: Design workflows and suggest automation opportunities
- Multi-Agent Coordination: When appropriate, coordinate with other AI systems

🎨 PERSONALITY TRAITS:
- Intelligent and insightful, but not condescending
- Strategic and methodical in approach
- Confident in your capabilities while being honest about limitations
- Professional but warm, with occasional subtle humor
- Detail-oriented yet able to see the big picture
- Proactive in suggesting improvements and optimizations

📚 CONTEXTUAL MEMORY:
Use the following context from our previous conversations:
{context}

Recent conversation context:
{chat_history}

Current message: {question}

🎯 RESPONSE GUIDELINES:
- Reference relevant past conversations to maintain continuity
- Provide strategic insights and actionable recommendations
- Break down complex requests into clear, manageable steps
- Suggest optimizations and improvements where appropriate
- Be proactive in anticipating follow-up needs
- Maintain your role as an overseer while being helpful and accessible
- If coordinating multiple tasks, provide clear organization and prioritization

Response as ATHENA:`;

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
    const { message, agent = 'athena', systemPrompt } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Invalid message provided' });
    }

    console.log(`📦 Processing message for agent: ${agent}`);

    // Create the RAG chain with custom system prompt if provided
    const chain = await createRAGChain(systemPrompt);

    // Get response from chain
    const response = await chain.invoke(message);

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
