import { NextApiRequest, NextApiResponse } from 'next';
import { AthenaMemoryManager } from '../../lib/memory/AthenaMemoryManager';

const memoryManager = new AthenaMemoryManager();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔍 Debug: Retrieving all memory...');
    const allFacts = await memoryManager.showMemory();
    
    return res.status(200).json({
      totalFacts: allFacts.length,
      facts: allFacts,
      message: allFacts.length === 0 ? 'No facts stored yet' : `Found ${allFacts.length} facts in memory`
    });
    
  } catch (error: any) {
    console.error('Debug endpoint error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}
