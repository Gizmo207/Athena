// lib/vectorstore/chroma.ts
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { Embeddings } from '@langchain/core/embeddings';
import path from 'path';

// Simple local embeddings that hash text into vectors
class SimpleLocalEmbeddings extends Embeddings {
  constructor() {
    super({});
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return texts.map(text => this.hashToVector(text));
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.hashToVector(text);
  }

  private hashToVector(text: string): number[] {
    // Simple hash-based vector generation (384 dimensions like all-MiniLM-L6-v2)
    const vector = new Array(384).fill(0);
    const cleanText = text.toLowerCase().replace(/[^\w\s]/g, '');
    
    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText.charCodeAt(i);
      const index = (char + i) % 384;
      vector[index] += Math.sin(char * 0.1 + i * 0.01);
    }
    
    // Normalize the vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  }
}

// Directory for on-disk persistence
const PERSIST_DIRECTORY = path.join(process.cwd(), 'vectorstore', 'athena');

let chromaStore: Chroma | null = null;

/**
 * Returns a disk-persistent Chroma vector store for Athena's long-term memory.
 * Uses simple local embeddings for 100% local operation.
 */
export async function getChromaStore() {
  if (chromaStore) return chromaStore;
  
  // Use simple local embeddings (no remote APIs, no complex dependencies)
  const embeddings = new SimpleLocalEmbeddings();
  
  // Always create collection from documents (handles both new and existing)
  try {
    console.log('🔄 Initializing Chroma collection...');
    
    // Create/connect to collection with dummy document first
    const dummyDoc = { pageContent: 'initialization', metadata: { type: 'init' } };
    chromaStore = await Chroma.fromDocuments(
      [dummyDoc],
      embeddings,
      {
        collectionName: 'athena_memory',
        collectionMetadata: { description: "Athena's long-term memory" },
        persistDirectory: PERSIST_DIRECTORY,
      }
    );
    console.log('✅ Chroma collection initialized successfully');
    
    // Test the collection with a simple search
    const testResults = await chromaStore.similaritySearch('test', 1);
    console.log(`🔍 Collection test: found ${testResults.length} results`);
    
    return chromaStore;
  } catch (error: any) {
    console.error('❌ Failed to initialize Chroma collection:', error);
    throw new Error(`Chroma initialization failed: ${error.message}`);
  }
}
