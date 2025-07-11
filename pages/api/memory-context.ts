import type { NextApiRequest, NextApiResponse } from 'next';
import { AthenaMemoryManager } from '../../lib/memory-manager';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, userId } = req.query;
    console.log('=== MEMORY CONTEXT DEBUG ===');
    console.log('Query params:', req.query);
    console.log('UserId:', userId, 'Query:', query);

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid userId parameter' });
    }

    let memoryManager: AthenaMemoryManager;
    try {
      memoryManager = new AthenaMemoryManager();
    } catch (initError: any) {
      console.warn('Qdrant or memory manager unavailable:', initError);
      return res.status(200).json({
        memoryContext: { facts: [], contextText: '' },
        warning: 'Memory system unavailable (Qdrant or embedding failure)'
      });
    }

    try {
      if (query && typeof query === 'string') {
        // Search for specific context
        console.log('Calling getMemoryContext with query:', query);
        const context = await memoryManager.getMemoryContext(query, userId);
        console.log('Context retrieved:', context);
        return res.status(200).json({ memoryContext: context });
      } else {
        // Get recent general context
        console.log('Calling buildMemoryContext with empty query');
        const context = await memoryManager.buildMemoryContext('', userId);
        console.log('Context retrieved:', context);
        return res.status(200).json({ memoryContext: context });
      }
    } catch (contextError: any) {
      console.warn('Memory context unavailable:', contextError);
      return res.status(200).json({
        memoryContext: { facts: [], contextText: '' },
        warning: 'Memory system unavailable (context error or embedding failure)'
      });
    }
  } catch (error: any) {
    // Only truly unexpected errors should hit this
    console.error('❌ Unexpected memory context error:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve memory context',
      details: error.message 
    });
  }
}