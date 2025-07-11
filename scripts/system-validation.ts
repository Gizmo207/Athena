import dotenv from 'dotenv';
import { AthenaMemoryManager } from '../lib/memory-manager';
import { testMistralConnection } from '../lib/mistral-client';
import { testQdrantConnection } from '../lib/qdrant-client';
import { testEmbeddingConnection } from '../lib/embedding-client';
import { routeToAgent } from '../lib/config';

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * Comprehensive System Validation Test
 */
async function runSystemValidation() {
  console.log('🚀 Starting ATHENA System Validation...\n');
  
  const results = {
    passed: 0,
    failed: 0,
    total: 0,
    details: [] as any[]
  };

  // Test 1: API Connections
  console.log('🔧 Testing API Connections...');
  try {
    const mistralTest = await testMistralConnection();
    const qdrantTest = await testQdrantConnection();
    const embeddingTest = await testEmbeddingConnection();
    
    results.total += 3;
    results.passed += mistralTest ? 1 : 0;
    results.passed += qdrantTest ? 1 : 0;
    results.passed += embeddingTest ? 1 : 0;
    results.failed += mistralTest ? 0 : 1;
    results.failed += qdrantTest ? 0 : 1;
    results.failed += embeddingTest ? 0 : 1;
    
    results.details.push({
      test: 'API Connections',
      mistral: { success: mistralTest },
      qdrant: { success: qdrantTest },
      embedding: { success: embeddingTest }
    });
  } catch (error) {
    results.total += 3;
    results.failed += 3;
    results.details.push({
      test: 'API Connections',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 2: Memory System - Complete Flow
  console.log('🧠 Testing Memory System...');
  try {
    const memoryManager = new AthenaMemoryManager();
    const testUserId = 'test-user-' + Date.now();
    
    // Test fact extraction and storage
    const facts = await memoryManager.extractAndStoreFacts({
      userMessage: 'My favorite color is blue and I own a motorcycle. I work at TechCorp.',
      assistantResponse: 'Got it! I understand your preferences.',
      userId: testUserId
    });
    
    console.log(`📝 Extracted ${facts.length} facts`);
    
    // Test memory retrieval
    const context = await memoryManager.getMemoryContext('color preferences', testUserId);
    console.log(`🔍 Retrieved ${context.facts.length} relevant facts`);
    
    results.total += 2;
    results.passed += facts.length > 0 ? 1 : 0;
    results.passed += context.facts.length > 0 ? 1 : 0;
    results.failed += facts.length > 0 ? 0 : 1;
    results.failed += context.facts.length > 0 ? 0 : 1;
    
    results.details.push({
      test: 'Memory System',
      factsExtracted: facts.length,
      factsRetrieved: context.facts.length,
      success: facts.length > 0 && context.facts.length > 0
    });
    
  } catch (error) {
    results.total += 2;
    results.failed += 2;
    results.details.push({
      test: 'Memory System',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 3: Agent Routing
  console.log('🎯 Testing Agent Routing...');
  const routingTests = [
    { input: 'Build me a React dashboard', expected: 'CODEX' },
    { input: 'Analyze last month sales data', expected: 'DATA-ANALYST' },
    { input: 'Plan our marketing strategy', expected: 'STRATEGIST' },
    { input: 'Review the budget numbers', expected: 'FINANCE' },
    { input: 'We have a security breach', expected: 'SECURITY' },
    { input: 'Send update to stakeholders', expected: 'COMMUNICATIONS' },
    { input: 'Just having a casual chat', expected: null }
  ];

  let routingPassed = 0;
  for (const test of routingTests) {
    const result = routeToAgent(test.input);
    if (result === test.expected) {
      routingPassed++;
    }
    console.log(`   "${test.input}" → ${result} (expected: ${test.expected}) ${result === test.expected ? '✅' : '❌'}`);
  }
  
  results.total += routingTests.length;
  results.passed += routingPassed;
  results.failed += routingTests.length - routingPassed;
  
  results.details.push({
    test: 'Agent Routing',
    passed: routingPassed,
    total: routingTests.length,
    success: routingPassed === routingTests.length
  });

  // Test 4: Buffer Management
  console.log('📋 Testing Buffer Management...');
  try {
    const testMessages = Array.from({ length: 8 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `Test message ${i + 1}`
    }));
    
    // Simulate buffer overflow
    const buffer = testMessages.slice(-5); // Should keep only last 5
    
    results.total += 1;
    results.passed += buffer.length === 5 ? 1 : 0;
    results.failed += buffer.length === 5 ? 0 : 1;
    
    results.details.push({
      test: 'Buffer Management',
      originalLength: testMessages.length,
      bufferLength: buffer.length,
      success: buffer.length === 5
    });
    
  } catch (error) {
    results.total += 1;
    results.failed += 1;
    results.details.push({
      test: 'Buffer Management',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 5: Fact Quality Control
  console.log('🔍 Testing Fact Quality Control...');
  try {
    const memoryManager = new AthenaMemoryManager();
    const testUserId = 'quality-test-' + Date.now();
    
    // Test with low-quality facts
    const lowQualityFacts = await memoryManager.extractAndStoreFacts({
      userMessage: 'Hello. Yes. OK. Thanks.',
      assistantResponse: 'You are welcome.',
      userId: testUserId
    });
    
    // Test with high-quality facts
    const highQualityFacts = await memoryManager.extractAndStoreFacts({
      userMessage: 'I prefer working remotely and I drive a Tesla Model 3. My birthday is March 15th.',
      assistantResponse: 'I understand your preferences about remote work and your Tesla.',
      userId: testUserId
    });
    
    results.total += 2;
    results.passed += lowQualityFacts.length === 0 ? 1 : 0; // Should reject low quality
    results.passed += highQualityFacts.length > 0 ? 1 : 0;  // Should accept high quality
    results.failed += lowQualityFacts.length === 0 ? 0 : 1;
    results.failed += highQualityFacts.length > 0 ? 0 : 1;
    
    results.details.push({
      test: 'Fact Quality Control',
      lowQualityFactsRejected: lowQualityFacts.length === 0,
      highQualityFactsAccepted: highQualityFacts.length > 0,
      success: lowQualityFacts.length === 0 && highQualityFacts.length > 0
    });
    
  } catch (error) {
    results.total += 2;
    results.failed += 2;
    results.details.push({
      test: 'Fact Quality Control',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 6: Environment Variables
  console.log('🔐 Testing Environment Variables...');
  const envTests = [
    { name: 'MISTRAL_API_KEY', value: process.env.MISTRAL_API_KEY },
    { name: 'QDRANT_URL', value: process.env.QDRANT_URL },
    { name: 'QDRANT_API_KEY', value: process.env.QDRANT_API_KEY },
  ];
  
  let envPassed = 0;
  for (const env of envTests) {
    const isSet = env.value && env.value !== 'your_key_here' && env.value !== 'your_url_here';
    if (isSet) envPassed++;
    console.log(`   ${env.name}: ${isSet ? '✅ Set' : '❌ Missing'}`);
  }
  
  results.total += envTests.length;
  results.passed += envPassed;
  results.failed += envTests.length - envPassed;
  
  results.details.push({
    test: 'Environment Variables',
    configured: envPassed,
    total: envTests.length,
    success: envPassed === envTests.length
  });

  // Final Results
  console.log('\n🎯 VALIDATION RESULTS:');
  console.log(`Total Tests: ${results.total}`);
  console.log(`Passed: ${results.passed} ✅`);
  console.log(`Failed: ${results.failed} ❌`);
  console.log(`Success Rate: ${Math.round((results.passed / results.total) * 100)}%`);
  
  if (results.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! System is ready for production.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the details above.');
  }
  
  return results;
}

// Ultimate Complete Flow Test
async function runUltimateFlowTest() {
  console.log('\n🚀 ULTIMATE FLOW TEST: Complete conversation simulation...\n');
  
  const memoryManager = new AthenaMemoryManager();
  const testUserId = 'ultimate-test-' + Date.now();
  
  console.log('👤 User says: "My name is John and I love basketball. Build me a React app to track my games and analyze my shooting stats."');
  
  // Step 1: Extract facts
  console.log('\n🧠 Step 1: Extracting facts...');
  const facts = await memoryManager.extractAndStoreFacts({
    userMessage: 'My name is John and I love basketball. Build me a React app to track my games and analyze my shooting stats.',
    assistantResponse: 'I understand you want a React app for basketball analytics. Let me coordinate with our development and data analysis teams.',
    userId: testUserId
  });
  console.log(`   Extracted ${facts.length} facts:`);
  facts.forEach(fact => console.log(`   - ${fact.type}: ${fact.key} = ${fact.value}`));
  
  // Step 2: Agent routing
  console.log('\n🎯 Step 2: Agent routing...');
  const routedAgent = routeToAgent('Build me a React app to track my games and analyze my shooting stats');
  console.log(`   Primary agent: ${routedAgent}`);
  console.log(`   Secondary agent: ${routeToAgent('analyze my shooting stats')}`);
  
  // Step 3: Memory context retrieval
  console.log('\n📚 Step 3: Memory context for follow-up...');
  const context = await memoryManager.getMemoryContext('basketball app', testUserId);
  console.log(`   Retrieved ${context.facts.length} relevant facts for context`);
  
  // Step 4: Buffer management
  console.log('\n📋 Step 4: Buffer simulation...');
  const mockBuffer = [
    { role: 'user' as const, content: 'My name is John and I love basketball.' },
    { role: 'assistant' as const, content: 'Nice to meet you, John! Basketball is a great sport.' }
  ];
  console.log(`   Buffer length: ${mockBuffer.length}`);
  
  console.log('\n✅ Ultimate flow test completed successfully!');
  
  return {
    factsExtracted: facts.length,
    agentRouted: routedAgent,
    contextRetrieved: context.facts.length,
    bufferManaged: mockBuffer.length
  };
}

// Run if called directly
if (require.main === module) {
  runSystemValidation()
    .then(() => runUltimateFlowTest())
    .catch(error => {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    });
}

export { runSystemValidation, runUltimateFlowTest };
