const request = require('supertest');

const BASE = 'http://localhost:3000';

describe('Athena Memory & RAG Pipeline', () => {
  const testFact = 'My favorite motorcycle is a 2009 Harley Street Bob with a red T143 crate motor.';
  const factKey = 'motorcycle';
  const factValue = '2009 Harley Street Bob with a red T143 crate motor';
  const userId = 'test-user-' + Date.now();

  // Allow extra time for Qdrant operations
  jest.setTimeout(60000);

  it('should record a new fact via /api/athena-mistral', async () => {
    console.log('🧪 Testing fact recording...');
    
    const res = await request(BASE)
      .post('/api/athena-mistral')
      .send({ 
        message: testFact,
        userId: userId,
        shortTermBuffer: []
      });
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('reply');
    
    // Allow some time for fact extraction to complete
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('✅ Fact recording test completed');
  });

  it('should list that fact in /api/memory-audit', async () => {
    console.log('🧪 Testing memory audit...');
    
    const res = await request(BASE)
      .get('/api/memory-audit')
      .query({ userId: userId });
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('facts');
    expect(Array.isArray(res.body.facts)).toBe(true);
    
    console.log(`📋 Found ${res.body.facts.length} facts in audit`);
    
    // Look for our fact in the audit results
    const found = res.body.facts.find(f => 
      f.includes(factKey) && f.includes('Harley')
    );
    
    if (!found) {
      console.log('Available facts:', res.body.facts);
    }
    
    expect(found).toBeDefined();
    console.log('✅ Memory audit test completed');
  });

  it('should return the fact in RAG context via /api/memory-context', async () => {
    console.log('🧪 Testing memory context retrieval...');
    
    const res = await request(BASE)
      .get('/api/memory-context')
      .query({ 
        query: 'what is my favorite motorcycle?',
        userId: userId 
      });
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('memoryContext');
    
    console.log('Memory context retrieved:', res.body.memoryContext);
    
    // Check if our fact appears in the memory context (should have facts array and contextText)
    expect(res.body.memoryContext.facts.length).toBeGreaterThanOrEqual(1);
    expect(res.body.memoryContext.contextText).toMatch(/Harley|motorcycle/i);
    
    console.log('✅ Memory context test completed');
  });

  afterAll(async () => {
    console.log('🧹 Test cleanup completed');
  });
});
