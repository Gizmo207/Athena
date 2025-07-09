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
  chromaStore = await Chroma.fromExistingCollection(
    embeddings, // embedding function
    {
      url: 'http://localhost:8000',                       // Chroma service URL
      collectionName: 'athena_memory',                     // collection name in Chroma
      collectionMetadata: { description: "Athena's long-term memory" },
      // persistence handled by Chroma service (no wrapper-level persistDirectory)
    }
  );
  return chromaStore;
}
