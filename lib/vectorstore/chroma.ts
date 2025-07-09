// lib/vectorstore/chroma.ts
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/hf_transformers';
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
  
  // Use local HuggingFace embeddings for fully offline operation
  const embeddings = new HuggingFaceTransformersEmbeddings({
    modelName: 'Xenova/all-MiniLM-L6-v2',
  });
  
  // Connect to an existing Chroma collection or create if missing
  try {
    chromaStore = await Chroma.fromExistingCollection(
      embeddings,
      {
        url: `http://${process.env.CHROMA_SERVER_HOST}:${process.env.CHROMA_SERVER_PORT}`,  // Chroma service URL
        collectionName: 'athena_memory',                     // collection name in Chroma
        collectionMetadata: { description: "Athena's long-term memory" },
      }
    );
    console.log('✅ Connected to existing Chroma collection with HuggingFace embeddings');
  } catch (error: any) {
    console.warn('⚠️ Creating new Chroma collection...', error.message);
    // create an empty collection if it doesn't exist
    chromaStore = await Chroma.fromDocuments(
      [],
      embeddings,
      {
        url: `http://${process.env.CHROMA_SERVER_HOST}:${process.env.CHROMA_SERVER_PORT}`,
        collectionName: 'athena_memory',
        collectionMetadata: { description: "Athena's long-term memory" },
      }
    );
    console.log('✅ Created new Chroma collection with HuggingFace embeddings');
  }
  return chromaStore;
}
