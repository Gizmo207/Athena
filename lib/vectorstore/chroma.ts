// lib/vectorstore/chroma.ts
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { OllamaEmbeddings } from '@langchain/ollama';
import path from 'path';

// Directory for on-disk persistence
const PERSIST_DIRECTORY = path.join(process.cwd(), 'vectorstore', 'athena');

let chromaStore: Chroma | null = null;

/**
 * Returns a disk-persistent Chroma vector store for Athena's long-term memory.
 */
export async function getChromaStore() {
  if (chromaStore) return chromaStore;
  // Use OllamaEmbeddings for local embedding via Ollama
  const embeddings = new OllamaEmbeddings({ baseUrl: 'http://localhost:11434', model: 'mistral:instruct' });
  // Connect to an existing Chroma collection or create if missing
  // Connect to existing Chroma collection via LangChain wrapper
  try {
    chromaStore = await Chroma.fromExistingCollection(
      embeddings,
      {
        url: 'http://localhost:8000',                       // Chroma service URL
        collectionName: 'athena_memory',                     // collection name in Chroma
        collectionMetadata: { description: "Athena's long-term memory" },
      }
    );
  } catch (error: any) {
    console.warn('⚠️ Chroma collection not found or service unavailable, creating new collection', error);
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
  }
  return chromaStore;
}
