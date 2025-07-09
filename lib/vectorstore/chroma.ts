// lib/vectorstore/chroma.ts
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { OpenAIEmbeddings } from '@langchain/openai';
import path from 'path';

// Directory for on-disk persistence
const PERSIST_DIRECTORY = path.join(process.cwd(), 'vectorstore', 'athena');

let chromaStore: Chroma | null = null;

/**
 * Returns a disk-persistent Chroma vector store for Athena's long-term memory.
 */
// Modular, strict, future-proofed
export async function getChromaStore() {
  if (chromaStore) return chromaStore;
  // Use OpenAI embeddings for proper LangChain compatibility
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: 'text-embedding-3-small',
  });
  // Connect to an existing Chroma collection or create if missing
  try {
    chromaStore = await Chroma.fromExistingCollection(
      embeddings,
      {
        url: 'http://localhost:8000',                       // Chroma service URL
        collectionName: 'athena_memory',                     // collection name in Chroma
        collectionMetadata: { description: "Athena's long-term memory" },
      }
    );
    console.log('✅ Connected to existing Chroma collection');
  } catch (error: any) {
    console.warn('⚠️ Creating new Chroma collection...', error.message);
    // create an empty collection if it doesn't exist
    chromaStore = await Chroma.fromDocuments(
      [],
      embeddings,
      {
        url: 'http://localhost:8000',
        collectionName: 'athena_memory',
        collectionMetadata: { description: "Athena's long-term memory" },
      }
    );
    console.log('✅ Created new Chroma collection');
  }
  return chromaStore;
}
