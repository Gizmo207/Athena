import { NextApiRequest, NextApiResponse } from 'next';
import { validateMistralSetup } from '../../lib/mistral-client';
import { validateQdrantSetup } from '../../lib/qdrant-client';
import { validateEmbeddingSetup } from '../../lib/embedding-client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔍 Running health check...');
    
    const checks = {
      mistral: false,
      qdrant: false,
      embeddings: false,
    };

    // Check Mistral API
    try {
      checks.mistral = await validateMistralSetup();
      console.log(`✅ Mistral: ${checks.mistral ? 'OK' : 'FAIL'}`);
    } catch (error) {
      console.error('❌ Mistral check failed:', error);
      checks.mistral = false;
    }

    // Check Qdrant
    try {
      checks.qdrant = await validateQdrantSetup();
      console.log(`✅ Qdrant: ${checks.qdrant ? 'OK' : 'FAIL'}`);
    } catch (error) {
      console.error('❌ Qdrant check failed:', error);
      checks.qdrant = false;
    }

    // Check Embeddings
    try {
      checks.embeddings = await validateEmbeddingSetup();
      console.log(`✅ Embeddings: ${checks.embeddings ? 'OK' : 'FAIL'}`);
    } catch (error) {
      console.error('❌ Embeddings check failed:', error);
      checks.embeddings = false;
    }

    const allHealthy = Object.values(checks).every(check => check === true);
    
    const status = {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        mistral: {
          status: checks.mistral ? 'healthy' : 'unhealthy',
          description: 'Mistral AI API for language generation',
        },
        qdrant: {
          status: checks.qdrant ? 'healthy' : 'unhealthy',
          description: 'Qdrant vector database for memory storage',
        },
        embeddings: {
          status: checks.embeddings ? 'healthy' : 'unhealthy',
          description: 'Text embedding generation for semantic search',
        },
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        mistralApiKey: process.env.MISTRAL_API_KEY ? 'configured' : 'missing',
        qdrantUrl: process.env.QDRANT_URL ? 'configured' : 'missing',
        qdrantApiKey: process.env.QDRANT_API_KEY ? 'configured' : 'missing',
      },
    };

    return res.status(allHealthy ? 200 : 503).json(status);
    
  } catch (error: any) {
    console.error('Health check error:', error);
    return res.status(500).json({ 
      status: 'error',
      error: 'Health check failed',
      details: error.message 
    });
  }
}
