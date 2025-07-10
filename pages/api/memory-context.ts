
import { NextApiRequest, NextApiResponse } from 'next';
import { AthenaMemoryManager } from '../../lib/memory-manager';
import { CONFIG } from '../../lib/config';

/**
 * Debug endpoint to inspect memory context retrieval
 * GET /api/memory-context?query=test&userId=user123
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, userId = CONFIG.DEFAULT_USER_ID, limit = '10' } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        error: 'Query parameter is required',
        example: '/api/memory-context?query=user preferences&userId=peter_bernaiche'
      });
    }

    const memoryManager = new AthenaMemoryManager();
    
    // Get memory context
    const startTime = Date.now();
    const memoryContext = await memoryManager.getMemoryContext(
      query,
      userId as string,
      parseInt(limit as string)
    );
    const retrievalTime = Date.now() - startTime;

    // Debug information
    const debugInfo = {
      query: query,
      userId: userId,
      retrievalTime: `${retrievalTime}ms`,
      factsFound: memoryContext.facts.length,
      contextLength: memoryContext.contextText.length,
      relevanceThreshold: CONFIG.RELEVANCE_THRESHOLD,
      maxContextTokens: CONFIG.MAX_CONTEXT_TOKENS,
      estimatedTokens: Math.ceil(memoryContext.contextText.length / 4),
    };

    // Format facts for readability
    const formattedFacts = memoryContext.facts.map(fact => ({
      id: fact.id,
      type: fact.type,
      key: fact.key,
      value: fact.value,
      timestamp: new Date(fact.timestamp).toLocaleString(),
      userId: fact.userId
    }));

    res.status(200).json({
      success: true,
      debug: debugInfo,
      facts: formattedFacts,
      contextText: memoryContext.contextText,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Memory context retrieval failed:', error);
    res.status(500).json({ 
      error: 'Memory context retrieval failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
