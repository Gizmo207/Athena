import { NextApiRequest, NextApiResponse } from 'next';
import dotenv from 'dotenv';
import { AthenaMemoryManager } from '../../lib/memory-manager';

// Load environment variables
dotenv.config({ path: '.env.local' });

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId = 'peter_bernaiche' } = req.query;
    
    console.log(`📋 Memory audit requested for user: ${userId}`);
    
    // Initialize memory manager
    const memoryManager = new AthenaMemoryManager();
    
    // Get recent memory facts (initialization happens automatically)
    const recentFacts = await memoryManager.getRecentMemoryFacts(userId as string, 50);
    
    // Format facts for audit display
    const formattedFacts = recentFacts.map(fact => 
      `${fact.key}: ${fact.value} (${fact.type}, ${new Date(fact.timestamp).toLocaleDateString()})`
    );
    
    console.log(`📋 Retrieved ${formattedFacts.length} facts for audit`);
    
    return res.status(200).json({
      facts: formattedFacts,
      count: formattedFacts.length,
      userId: userId
    });
  } catch (error) {
    console.error('❌ Memory audit failed:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve memory facts',
      facts: [],
      count: 0
    });
  }
}
