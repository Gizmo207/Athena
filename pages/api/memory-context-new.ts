import { NextApiRequest, NextApiResponse } from 'next';
import { AthenaMemoryManager } from '../../lib/memory-manager';

const memoryManager = new AthenaMemoryManager();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId = 'user', query = 'test' } = req.query;
    
    console.log(`🔍 Memory context test for user: ${userId}, query: ${query}`);
    
    const context = await memoryManager.getMemoryContext(query as string, userId as string);
    
    return res.status(200).json({
      query,
      userId,
      factsFound: context.facts.length,
      contextText: context.contextText,
      facts: context.facts,
    });
    
  } catch (error: any) {
    console.error('Memory context test error:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve memory context',
      details: error.message 
    });
  }
}
