require('dotenv').config({ path: '.env.local' });

// Simple test to verify API keys are loaded
console.log('Environment Variables Test:');
console.log('MISTRAL_API_KEY:', process.env.MISTRAL_API_KEY ? 'SET' : 'NOT SET');
console.log('QDRANT_URL:', process.env.QDRANT_URL ? 'SET' : 'NOT SET');
console.log('QDRANT_API_KEY:', process.env.QDRANT_API_KEY ? 'SET' : 'NOT SET');

// Test Qdrant connection
const { QdrantClient } = require('@qdrant/js-client-rest');

const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

async function testQdrant() {
  try {
    console.log('Testing Qdrant connection...');
    const result = await qdrantClient.getCollections();
    console.log('✅ Qdrant connection successful');
    console.log('Collections:', result.collections.map(c => c.name));
  } catch (error) {
    console.error('❌ Qdrant connection failed:', error.message);
  }
}

testQdrant();
