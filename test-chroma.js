// Simple test to verify Chroma connection
const { getChromaStore } = require('./lib/vectorstore/chroma.ts');

async function testChroma() {
  try {
    console.log('🧪 Testing Chroma connection...');
    const store = await getChromaStore();
    console.log('✅ Chroma store created successfully');
    
    // Test adding a document
    console.log('📝 Testing document addition...');
    await store.addDocuments([{
      pageContent: 'test fact: user likes motorcycles',
      metadata: { key: 'test', value: 'likes motorcycles', type: 'test' }
    }]);
    console.log('✅ Document added successfully');
    
    // Test search
    console.log('🔍 Testing search...');
    const results = await store.similaritySearch('motorcycles', 1);
    console.log(`✅ Search completed: found ${results.length} results`);
    console.log('Results:', results);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testChroma();
