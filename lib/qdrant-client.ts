import { QdrantClient } from '@qdrant/js-client-rest';
import { CONFIG } from './config';

// Configuration
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const COLLECTION_NAME = 'athena_memory';
const VECTOR_SIZE = 1024; // Mistral embedding size

// Initialize Qdrant client with enhanced configuration
const qdrantClient = new QdrantClient({
  url: QDRANT_URL,
  apiKey: QDRANT_API_KEY,
});

// Add connection retry logic
async function withRetry<T>(operation: () => Promise<T>, retries: number = CONFIG.QDRANT_RETRIES): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Qdrant operation timeout')), CONFIG.QDRANT_TIMEOUT)
        )
      ]);
    } catch (error: any) {
      lastError = error;
      console.warn(`⚠️ Qdrant attempt ${attempt}/${retries} failed:`, error.message);
      
      if (attempt < retries) {
        const delay = 1000 * attempt; // Linear backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}

// Export interfaces for use in other modules
export interface MemoryFact {
  id: string;
  type: 'preference' | 'fact' | 'relationship' | 'event' | 'opinion' | 'possession' | 'skill';
  key: string;
  value: string;
  timestamp: string;
  originMessage: string;
  userId: string;
}

export interface SearchResult {
  fact: MemoryFact;
  score: number;
}

/**
 * Initialize Qdrant collection for Athena memory with enhanced error handling
 */
export async function initializeQdrantCollection(): Promise<void> {
  try {
    console.log('🔄 Initializing Qdrant collection...');
    
    // Check if collection exists first
    try {
      const collections = await withRetry(() => qdrantClient.getCollections());
      const collectionExists = collections.collections.some(c => c.name === COLLECTION_NAME);
      
      if (collectionExists) {
        // Verify collection configuration
        const collectionInfo = await withRetry(() => qdrantClient.getCollection(COLLECTION_NAME));
        const currentVectorSize = collectionInfo.config?.params?.vectors?.size;
        
        if (currentVectorSize === VECTOR_SIZE) {
          console.log(`✅ Collection already exists with correct vector size (${VECTOR_SIZE})`);
          return;
        } else {
          console.log(`⚠️ Collection vector size mismatch: expected ${VECTOR_SIZE}, got ${currentVectorSize}`);
          console.log(`🗑️ Deleting collection with wrong vector size`);
          await withRetry(() => qdrantClient.deleteCollection(COLLECTION_NAME));
          console.log('✅ Old collection deleted');
        }
      } else {
        console.log('ℹ️ No existing collection found');
      }
    } catch (error) {
      console.log('ℹ️ Collection check failed, proceeding with creation');
    }
    
    // Create fresh collection with correct 1024-dimensional vectors for Mistral
    console.log(`📦 Creating collection: ${COLLECTION_NAME} with vector size ${VECTOR_SIZE}`);
    await withRetry(() => qdrantClient.createCollection(COLLECTION_NAME, {
      vectors: {
        size: VECTOR_SIZE,
        distance: 'Cosine',
      },
      optimizers_config: {
        default_segment_number: 2,
      },
      replication_factor: 1,
      write_consistency_factor: 1,
    }));
    console.log('✅ Qdrant collection created successfully with correct vector size');
  } catch (error: any) {
    console.error('❌ Failed to initialize Qdrant collection:', error);
    throw new Error(`Qdrant initialization failed: ${error.message}`);
  }
}

/**
 * Store a memory fact in Qdrant with retry logic
 */
export async function storeMemoryFact(
  fact: MemoryFact,
  embedding: number[],
  originalKey?: string,
  originalValue?: string
): Promise<void> {
  try {
    console.log(`💾 Storing fact for userId: ${fact.userId} - ${fact.key} = ${fact.value}`);
    console.log(`📏 Embedding dimensions: ${embedding.length}`);
    
    // Simplified upsert without filters for debugging
    await withRetry(() => qdrantClient.upsert(COLLECTION_NAME, {
      wait: true,
      points: [
        {
          id: fact.id,
          vector: embedding,
          payload: {
            userId: fact.userId,  // Always include userId for filtering
            factKey: fact.key,  // normalized for search
            factValue: fact.value,  // normalized for search
            originalKey: originalKey || fact.key,  // original casing for display
            originalValue: originalValue || fact.value,  // original casing for display
            factType: fact.type,
            timestamp: fact.timestamp,
            originMessage: fact.originMessage,
          },
        },
      ],
    }));
    
    console.log(`✅ Memory fact stored successfully for user: ${fact.userId}`);
  } catch (error: any) {
    console.error(`❌ Failed to store memory fact for user ${fact.userId}:`, error);
    // Don't throw error - just log it and continue
    console.log('Continuing despite storage error...');
  }
}

/**
 * Search for relevant memory facts
 */
export async function searchMemoryFacts(
  queryEmbedding: number[],
  userId: string,
  limit: number = 10,
  scoreThreshold: number = 0.7
): Promise<SearchResult[]> {
  try {
    console.log('=== SIMILARITY SEARCH ENTRY ===');
    console.log('Method called with:', { query: 'embedding vector', k: limit, filter: { userId } });
    console.log(`🔍 Searching for relevant facts for user: ${userId}`);
    console.log('Searching with filter:', JSON.stringify({ must: [{ key: 'userId', match: { value: userId } }] }));
    
    const searchResult = await qdrantClient.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      limit,
      score_threshold: scoreThreshold,
      with_payload: true,
      filter: {
        must: [
          { key: 'userId', match: { value: userId } }
        ]
      }
    });

    const results: SearchResult[] = searchResult.map(result => ({
      fact: {
        id: result.id as string,
        type: result.payload?.factType as MemoryFact['type'],
        key: result.payload?.factKey as string,
        value: result.payload?.factValue as string,
        timestamp: result.payload?.timestamp as string,
        originMessage: result.payload?.originMessage as string,
        userId: result.payload?.userId as string,
      },
      score: result.score || 0,
    }));

    // Validate that returned results only contain documents with the correct userId
    const validResults = results.filter(result => result.fact.userId === userId);
    console.log('Search results count:', validResults.length);
    
    console.log(`📚 Found ${validResults.length} relevant facts for user ${userId}`);
    return validResults;
  } catch (error) {
    console.error('❌ Failed to search memory facts:', error);
    console.log('Search results count:', 0);
    return []; // Return empty array instead of throwing
  }
}

/**
 * Get all memory facts for a user
 */
export async function getAllMemoryFacts(userId: string): Promise<MemoryFact[]> {
  try {
    console.log(`📋 Retrieving all facts for user: ${userId}`);
    
    const scrollResult = await qdrantClient.scroll(COLLECTION_NAME, {
      limit: 1000,
      with_payload: true,
      filter: {
        must: [
          { key: 'userId', match: { value: userId } }
        ]
      }
    });

    const facts: MemoryFact[] = scrollResult.points
      .filter(point => point.payload?.userId === userId) // Additional validation
      .map(point => ({
        id: point.id as string,
        type: point.payload?.factType as MemoryFact['type'],
        key: point.payload?.factKey as string,
        value: point.payload?.factValue as string,
        timestamp: point.payload?.timestamp as string,
        originMessage: point.payload?.originMessage as string,
        userId: point.payload?.userId as string,
      }));

    console.log(`� Retrieved ${facts.length} facts for user ${userId}`);
    return facts;
  } catch (error) {
    console.error(`❌ Failed to retrieve all memory facts for user ${userId}:`, error);
    return []; // Return empty array instead of throwing
  }
}

// Validation and test functions
export async function validateQdrantSetup(): Promise<boolean> {
  try {
    // Test basic connection
    const collections = await qdrantClient.getCollections();
    console.log('✅ Qdrant cluster connection successful');
    
    // Check if collection exists, create if not
    await initializeQdrantCollection();
    
    return true;
  } catch (error: any) {
    console.error('❌ Qdrant validation failed:', error.message);
    return false;
  }
}

export async function testQdrantConnection(): Promise<boolean> {
  try {
    await withRetry(async () => {
      const result = await qdrantClient.getCollections();
      return result;
    });
    
    console.log('✅ Qdrant connection test passed');
    return true;
  } catch (error: any) {
    console.error('❌ Qdrant connection test failed:', error.message);
    return false;
  }
}
