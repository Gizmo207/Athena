// Test script to verify HuggingFace embeddings are working
const { HuggingFaceTransformersEmbeddings } = require('@langchain/community/embeddings/hf_transformers');

async function testEmbeddings() {
  console.log('🧠 Testing HuggingFace embeddings...');
  
  try {
    const embeddings = new HuggingFaceTransformersEmbeddings({
      modelName: 'Xenova/all-MiniLM-L6-v2',
    });
    
    console.log('✅ Created embeddings instance');
    
    const result = await embeddings.embedQuery('This is a test query for Athena memory');
    
    console.log('✅ Generated embedding successfully');
    console.log(`📊 Embedding dimensions: ${result.length}`);
    console.log(`🔢 First 5 values: ${result.slice(0, 5)}`);
    
    console.log('🎉 HuggingFace embeddings are working perfectly!');
    
  } catch (error) {
    console.error('❌ Error testing embeddings:', error);
  }
}

testEmbeddings();
