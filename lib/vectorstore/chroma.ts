// lib/vectorstore/chroma.ts
import { Chroma } from '@langchain/community/vectorstores/chroma';
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
  
  // Connect to an existing Chroma collection or create if missing
  try {
    chromaStore = await Chroma.fromExistingCollection(
      {
        url: `http://127.0.0.1:8000`,  // Chroma service URL (hardcoded for now)
        collectionName: 'athena_memory',                     // collection name in Chroma
        collectionMetadata: { description: "Athena's long-term memory" },
      }
    );
    console.log('✅ Connected to existing Chroma collection with default embeddings');
  } catch (error: any) {
    console.warn('⚠️ Creating new Chroma collection...', error.message);
    // create an empty collection if it doesn't exist
    chromaStore = await Chroma.fromDocuments(
      [],
      {
        url: `http://127.0.0.1:8000`,
        collectionName: 'athena_memory',
        collectionMetadata: { description: "Athena's long-term memory" },
      }
    );
    console.log('✅ Created new Chroma collection with default embeddings');
  }
  return chromaStore;
}
