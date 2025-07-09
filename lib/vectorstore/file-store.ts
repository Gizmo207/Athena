// lib/vectorstore/file-store.ts
import { Embeddings } from '@langchain/core/embeddings';
import { VectorStore } from '@langchain/core/vectorstores';
import { Document } from '@langchain/core/documents';
import * as fs from 'fs';
import * as path from 'path';

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

// Simple file-based vector store
class FileVectorStore extends VectorStore {
  private storePath: string;
  
  constructor(embeddings: Embeddings, storePath: string) {
    super(embeddings, {});
    this.storePath = storePath;
    this.ensureStoreExists();
  }

  _vectorstoreType(): string {
    return 'file-store';
  }

  private ensureStoreExists() {
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.storePath)) {
      fs.writeFileSync(this.storePath, JSON.stringify([]));
    }
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const existingDocs = this.loadDocuments();
    const newDocs = await Promise.all(
      documents.map(async (doc) => ({
        pageContent: doc.pageContent,
        metadata: doc.metadata || {},
        embedding: await this.embeddings.embedQuery(doc.pageContent),
      }))
    );
    
    const allDocs = [...existingDocs, ...newDocs];
    fs.writeFileSync(this.storePath, JSON.stringify(allDocs, null, 2));
    console.log(`💾 Stored ${documents.length} documents to ${this.storePath}`);
  }

  async similaritySearch(query: string, k: number = 4, filter?: Record<string, any>): Promise<Document[]> {
    const docs = this.loadDocuments();
    if (docs.length === 0) {
      console.log('📭 No documents in store yet');
      return [];
    }
    
    const queryEmbedding = await this.embeddings.embedQuery(query);
    
    // Calculate cosine similarity
    const similarities = docs.map((doc, index) => ({
      doc,
      similarity: this.cosineSimilarity(queryEmbedding, doc.embedding),
      index,
    }));
    
    // Filter if needed
    let filteredSimilarities = similarities;
    if (filter) {
      filteredSimilarities = similarities.filter(({ doc }) => {
        return Object.entries(filter).every(([key, value]) => 
          doc.metadata[key] === value
        );
      });
    }
    
    // Sort by similarity and take top k
    const topResults = filteredSimilarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
    
    console.log(`🔍 Found ${topResults.length} similar documents for query: "${query}"`);
    return topResults.map(({ doc }) => new Document({
      pageContent: doc.pageContent,
      metadata: doc.metadata,
    }));
  }

  private loadDocuments(): Array<{ pageContent: string; metadata: any; embedding: number[] }> {
    try {
      const data = fs.readFileSync(this.storePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('⚠️ Error loading documents, returning empty array:', error);
      return [];
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  // Get all documents for debugging
  async getAllDocuments(): Promise<Document[]> {
    const docs = this.loadDocuments();
    return docs.map(doc => new Document({
      pageContent: doc.pageContent,
      metadata: doc.metadata,
    }));
  }
}

// Directory for on-disk persistence
const PERSIST_DIRECTORY = path.join(process.cwd(), 'vectorstore', 'athena');
const STORE_FILE = path.join(PERSIST_DIRECTORY, 'athena_memory.json');

let vectorStore: FileVectorStore | null = null;

/**
 * Returns a disk-persistent file-based vector store for Athena's long-term memory.
 * Uses simple local embeddings for 100% local operation.
 */
export async function getChromaStore() {
  if (vectorStore) return vectorStore;
  
  try {
    console.log('🔄 Initializing file-based vector store...');
    
    // Use simple local embeddings (no remote APIs, no complex dependencies)
    const embeddings = new SimpleLocalEmbeddings();
    
    // Create file-based vector store
    vectorStore = new FileVectorStore(embeddings, STORE_FILE);
    
    console.log(`✅ File-based vector store initialized: ${STORE_FILE}`);
    
    // Test the store with a simple search
    const testResults = await vectorStore.similaritySearch('test', 1);
    console.log(`🔍 Store test: found ${testResults.length} results`);
    
    return vectorStore;
  } catch (error: any) {
    console.error('❌ Failed to initialize vector store:', error);
    throw new Error(`Vector store initialization failed: ${error.message}`);
  }
}
