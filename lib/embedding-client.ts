import { pipeline, env } from '@xenova/transformers';

// Disable remote model loading for security
env.allowRemoteModels = false;
env.allowLocalModels = true;

// Use a local model or fallback to a simple approach
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

let embedder: any = null;

/**
 * Initialize the embedding model
 */
async function initializeEmbedder() {
  if (!embedder) {
    try {
      console.log('🔄 Loading embedding model...');
      embedder = await pipeline('feature-extraction', MODEL_NAME);
      console.log('✅ Embedding model loaded successfully');
    } catch (error) {
      console.warn('⚠️ Failed to load transformer model, falling back to simple embeddings:', error);
      embedder = null;
    }
  }
}

/**
 * Generate embeddings for text using transformers
 */
async function generateTransformerEmbedding(text: string): Promise<number[]> {
  await initializeEmbedder();
  
  if (!embedder) {
    throw new Error('Embedding model not available');
  }

  try {
    const output = await embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  } catch (error) {
    console.error('❌ Failed to generate transformer embedding:', error);
    throw error;
  }
}

/**
 * Simple fallback embedding using character-based hashing
 * This is a basic implementation for development/testing
 */
function generateSimpleEmbedding(text: string): number[] {
  const embedding = new Array(384).fill(0);
  
  // Simple character-based embedding
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    const index = char % 384;
    embedding[index] += 1;
  }
  
  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  return embedding;
}



/**
 * Generate embeddings using Mistral API
 */
async function generateMistralEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error('Mistral API key not available');
  }

  const response = await fetch('https://api.mistral.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mistral-embed',
      input: [text],
    }),
  });

  if (!response.ok) {
    throw new Error(`Mistral API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Main embedding function with fallback strategy
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('Cannot generate embedding for empty text');
  }

  console.log(`📝 Generating embedding for: "${cleanText.substring(0, 50)}..."`);

  // Try different embedding methods in order of preference
  const methods = [
    { name: 'Mistral', fn: generateMistralEmbedding },
    { name: 'Transformers', fn: generateTransformerEmbedding },
    { name: 'Simple', fn: generateSimpleEmbedding },
  ];

  for (const method of methods) {
    try {
      console.log(`🔄 Trying ${method.name} embedding...`);
      const embedding = await method.fn(cleanText);
      console.log(`✅ ${method.name} embedding generated successfully (${embedding.length} dimensions)`);
      return embedding;
    } catch (error) {
      console.warn(`⚠️ ${method.name} embedding failed:`, error);
      continue;
    }
  }

  throw new Error('All embedding methods failed');
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Test embedding connection with detailed results
 */
export async function testEmbeddingConnection(): Promise<{ success: boolean; details: any }> {
  try {
    const startTime = Date.now();
    const testEmbedding = await generateEmbedding('Test connection');
    const endTime = Date.now();
    
    return {
      success: true,
      details: {
        responseTime: endTime - startTime,
        embeddingDimension: testEmbedding.length,
        modelName: MODEL_NAME,
        provider: 'Transformers.js',
        firstFewValues: testEmbedding.slice(0, 5),
      }
    };
  } catch (error) {
    return {
      success: false,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        modelName: MODEL_NAME,
        provider: 'Transformers.js',
      }
    };
  }
}

/**
 * Validate embedding setup
 */
export async function validateEmbeddingSetup(): Promise<boolean> {
  try {
    const testEmbedding = await generateEmbedding('Hello, world!');
    return testEmbedding.length > 0;
  } catch (error) {
    console.error('Embedding setup validation failed:', error);
    return false;
  }
}
