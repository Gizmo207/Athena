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

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid userId parameter' });
    }

    const memoryManager = new AthenaMemoryManager();

    if (query && typeof query === 'string') {
      // Search for specific context
      const context = await memoryManager.getMemoryContext(query, userId);
      return res.status(200).json({ memoryContext: context });
    } else {
      // Get recent general context
      const context = await memoryManager.buildMemoryContext('', userId);
      return res.status(200).json({ memoryContext: context });
    }
  } catch (error: any) {
    console.error('❌ Memory context error:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve memory context',
      details: error.message 
    });
  }
}