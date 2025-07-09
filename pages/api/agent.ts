import { NextApiRequest, NextApiResponse } from 'next';
import { Ollama } from '@langchain/community/llms/ollama';
import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import { Document } from 'langchain/document';
import { StringOutputParser } from '@langchain/core/output_parsers';
import {
  RunnableSequence,
  RunnablePassthrough,
} from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';
import path from 'path';
import fs from 'fs';

// --- CONFIGURATION ---
const VECTOR_STORE_PATH = path.join(process.cwd(), 'faiss.index');
const OLLAMA_BASE_URL = 'http://localhost:11434';
const OLLAMA_MODEL = 'mistral:instruct';

// --- INITIALIZE MODELS ---
const llm = new Ollama({
  baseUrl: OLLAMA_BASE_URL,
  model: OLLAMA_MODEL,
  temperature: 0.7,
});

const embeddings = new OllamaEmbeddings({
  baseUrl: OLLAMA_BASE_URL,
  model: OLLAMA_MODEL,
});

// --- VECTOR STORE SINGLETON ---
let vectorStore: FaissStore | null = null;

async function getVectorStore() {
  if (vectorStore) {
    return vectorStore;
  }

  if (fs.existsSync(VECTOR_STORE_PATH)) {
    console.log('✅ Loading existing vector store...');
    vectorStore = await FaissStore.load(VECTOR_STORE_PATH, embeddings);
  } else {
    console.log('✨ Creating new vector store...');
    // Create a dummy document to initialize the store
    const dummyDoc = [new Document({ pageContent: 'Athena initialized.' })];
    vectorStore = await FaissStore.fromDocuments(dummyDoc, embeddings);
    await vectorStore.save(VECTOR_STORE_PATH);
  }
  return vectorStore;
}

// --- PROMPT TEMPLATE ---
const template = `
You are Athena, a highly intelligent overseer agent.
Use the following retrieved context from past conversations to answer the question at the end.
If you don't know the answer from the context, just say that you don't know. Do not make up an answer.
Keep the answer concise and relevant.

CONTEXT: {context}

QUESTION: {question}

ANSWER:
`;

const prompt = PromptTemplate.fromTemplate(template);

// --- API HANDLER ---
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Invalid message provided' });
    }

    console.log(`🚀 Processing message: "${message}"`);

    const store = await getVectorStore();
    const retriever = store.asRetriever();

    // --- RAG CHAIN ---
    const chain = RunnableSequence.from([
      {
        context: retriever.pipe((docs: Document[]) =>
          docs.map((d: Document) => d.pageContent).join('\n')
        ),
        question: new RunnablePassthrough(),
      },
      prompt,
      llm,
      new StringOutputParser(),
    ]);

    const reply = await chain.invoke(message);
    console.log(`✅ Athena's reply: "${reply}"`);

    // --- SAVE CONVERSATION TO MEMORY ---
    const newDocs = [
      new Document({ pageContent: `User asked: ${message}` }),
      new Document({ pageContent: `Athena replied: ${reply}` }),
    ];
    await store.addDocuments(newDocs);
    await store.save(VECTOR_STORE_PATH);
    console.log('💾 Memory updated.');

    return res.status(200).json({ reply });
  } catch (error: any) {
    console.error('💥 API Error:', error);
    return res.status(500).json({
      error: `Server error: ${error.message}`,
      details: error.stack,
    });
  }
}
