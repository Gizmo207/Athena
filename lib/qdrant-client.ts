import { QdrantClient } from '@qdrant/js-client-rest';
import { CONFIG } from './config';

// Configuration
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const COLLECTION_NAME = 'athena_memory';
const VECTOR_SIZE = 384; // All-MiniLM-L6-v2 embedding size

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

export interface MemoryFact {
  id: string;
  type: 'preference' | 'fact' | 'context' | 'personal_detail' | 'possession';
  key: string;
  value: string;
  timestamp: string;
  originMessage: string;
  userId: string;
}

interface SearchResult {
  fact: MemoryFact;
  score: number;
}

/**
 * Initialize Qdrant collection for Athena memory with enhanced error handling
 */
export async function initializeQdrantCollection(): Promise<void> {
  try {
    console.log('🔄 Initializing Qdrant collection...');
    
    // Check if collection exists with retry logic
    const collections = await withRetry(() => qdrantClient.getCollections());
    const collectionExists = collections.collections.some(c => c.name === COLLECTION_NAME);
    
    if (!collectionExists) {
      console.log(`📦 Creating collection: ${COLLECTION_NAME}`);
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
      console.log('✅ Qdrant collection created successfully');
    } else {
      console.log('✅ Qdrant collection already exists');
      
      // Verify collection configuration
      const collectionInfo = await withRetry(() => qdrantClient.getCollection(COLLECTION_NAME));
      if (collectionInfo.config?.params?.vectors?.size !== VECTOR_SIZE) {
        console.warn(`⚠️ Collection vector size mismatch: expected ${VECTOR_SIZE}, got ${collectionInfo.config?.params?.vectors?.size}`);
      }
    }
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
  embedding: number[]
): Promise<void> {
  try {
    console.log(`💾 Storing fact: ${fact.key} = ${fact.value}`);
    
    await withRetry(() => qdrantClient.upsert(COLLECTION_NAME, {
      wait: true,
      points: [
        {
          id: fact.id,
          vector: embedding,
          payload: {
            type: fact.type,
            key: fact.key,
            value: fact.value,
            timestamp: fact.timestamp,
            originMessage: fact.originMessage,
            userId: fact.userId,
          },
        },
      ],
    }));
    
    console.log('✅ Memory fact stored successfully');
  } catch (error: any) {
    console.error('❌ Failed to store memory fact:', error);
    throw new Error(`Failed to store memory fact: ${error.message}`);
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
    console.log(`🔍 Searching for relevant facts for user: ${userId}`);
    
    const searchResult = await qdrantClient.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      limit,
      score_threshold: scoreThreshold,
      filter: {
        must: [
          {
            key: 'userId',
            match: {
              value: userId,
            },
          },
        ],
      },
    });

    const results: SearchResult[] = searchResult.map(result => ({
      fact: {
        id: result.id as string,
        type: result.payload?.type as MemoryFact['type'],
        key: result.payload?.key as string,
        value: result.payload?.value as string,
        timestamp: result.payload?.timestamp as string,
        originMessage: result.payload?.originMessage as string,
        userId: result.payload?.userId as string,
      },
      score: result.score || 0,
    }));

    console.log(`📚 Found ${results.length} relevant facts`);
    return results;
  } catch (error) {
    console.error('❌ Failed to search memory facts:', error);
    throw error;
  }
}

/**
 * Get all memory facts for a user
 */
export async function getAllMemoryFacts(userId: string): Promise<MemoryFact[]> {
  try {
    console.log(`📋 Retrieving all facts for user: ${userId}`);
    
    const scrollResult = await qdrantClient.scroll(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: 'userId',
            match: {
              value: userId,
            },
          },
        ],
      },
      limit: 1000,
      with_payload: true,
    });

    const facts: MemoryFact[] = scrollResult.points.map(point => ({
      id: point.id as string,
      type: point.payload?.type as MemoryFact['type'],
      key: point.payload?.key as string,
      value: point.payload?.value as string,
      timestamp: point.payload?.timestamp as string,
      originMessage: point.payload?.originMessage as string,
      userId: point.payload?.userId as string,
    }));

    console.log(`📊 Retrieved ${facts.length} total facts`);
    return facts;
  } catch (error) {
    console.error('❌ Failed to retrieve memory facts:', error);
    throw error;
  }
}

/**
 * Delete a memory fact
 */
export async function deleteMemoryFact(factId: string): Promise<void> {
  try {
    console.log(`🗑️ Deleting fact: ${factId}`);
    
    await qdrantClient.delete(COLLECTION_NAME, {
      wait: true,
      points: [factId],
    });
    
    console.log('✅ Memory fact deleted successfully');
  } catch (error) {
    console.error('❌ Failed to delete memory fact:', error);
    throw error;
  }
}

/**
 * Get collection info
 */
export async function getCollectionInfo(): Promise<any> {
  try {
    const info = await qdrantClient.getCollection(COLLECTION_NAME);
    return info;
  } catch (error) {
    console.error('❌ Failed to get collection info:', error);
    throw error;
  }
}

/**
 * Validate Qdrant setup
 */
export async function validateQdrantSetup(): Promise<boolean> {
  try {
    const collections = await qdrantClient.getCollections();
    const collectionExists = collections.collections.some(c => c.name === COLLECTION_NAME);
    
    if (!collectionExists) {
      await initializeQdrantCollection();
    }
    
    return true;
  } catch (error) {
    console.error('Qdrant setup validation failed:', error);
    return false;
  }
}

/**
 * Test Qdrant connection with detailed results
 */
export async function testQdrantConnection(): Promise<{ success: boolean; details: any }> {
  try {
    const startTime = Date.now();
    const collections = await qdrantClient.getCollections();
    const endTime = Date.now();
    
    // Check if our collection exists
    const collectionExists = collections.collections.some(
      (collection: any) => collection.name === COLLECTION_NAME
    );
    
    return {
      success: true,
      details: {
        responseTime: endTime - startTime,
        totalCollections: collections.collections.length,
        athenaCollectionExists: collectionExists,
        url: process.env.QDRANT_URL,
        apiKeyPresent: !!process.env.QDRANT_API_KEY,
      }
    };
  } catch (error) {
    return {
      success: false,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        url: process.env.QDRANT_URL,
        apiKeyPresent: !!process.env.QDRANT_API_KEY,
      }
    };
  }
}

export { qdrantClient, COLLECTION_NAME };
