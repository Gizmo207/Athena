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
    const { userId = 'user' } = req.query;
    
    console.log(`🔍 Memory audit for user: ${userId}`);
    
    const facts = await memoryManager.showMemory(userId as string);
    
    // Group facts by type for better organization
    const groupedFacts = facts.reduce((acc, fact) => {
      if (!acc[fact.type]) {
        acc[fact.type] = [];
      }
      acc[fact.type].push(fact);
      return acc;
    }, {} as Record<string, any[]>);
    
    const summary = {
      totalFacts: facts.length,
      factsByType: Object.keys(groupedFacts).map(type => ({
        type,
        count: groupedFacts[type].length,
        facts: groupedFacts[type],
      })),
      rawFacts: facts,
    };
    
    return res.status(200).json(summary);
    
  } catch (error: any) {
    console.error('Memory audit error:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve memory audit',
      details: error.message 
    });
  }
}
