// test-memory.js
const { getChromaStore } = require('./lib/vectorstore/file-store.ts');

async function testMemory() {
  try {
    console.log('🧪 Testing file-based memory store...');
    
    // Get the store
    const store = await getChromaStore();
    console.log('✅ Store initialized');
    
    // Add a test document
    console.log('📝 Adding test document...');
    await store.addDocuments([{
      pageContent: 'motorcycle: 2009 Street Bob with red T143 crate motor',
      metadata: { 
        type: 'possession', 
        key: 'motorcycle', 
        value: '2009 Street Bob with red T143 crate motor',
        timestamp: new Date().toISOString()
      }
    }]);
    
    // Search for it
    console.log('🔍 Searching for motorcycle...');
    const results = await store.similaritySearch('motorcycle', 1);
    
    console.log('Results:', results);
    
    if (results.length > 0) {
      console.log('🎯 SUCCESS! Memory is working!');
      console.log('Found:', results[0].pageContent);
      console.log('Metadata:', results[0].metadata);
    } else {
      console.log('❌ No results found');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testMemory();
