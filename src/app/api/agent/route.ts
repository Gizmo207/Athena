import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

export async function POST(req: NextRequest) {
  console.log('🚀 FRESH NEW ROUTE CREATED 🚀');
  
  try {
    const body = await req.json();
    console.log('📦 Request body:', JSON.stringify(body, null, 2));
    
    const userMessage = body.message;
    
    if (!userMessage || typeof userMessage !== 'string' || userMessage.trim() === '') {
      console.log('❌ Invalid message:', { userMessage, type: typeof userMessage });
      return NextResponse.json({ 
        error: "Invalid or empty message provided." 
      }, { status: 400 });
    }
    
    console.log('✅ Valid message received, calling OpenAI...');
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: userMessage },
      ],
      max_tokens: 150,
    });
    
    const reply = completion.choices[0]?.message?.content || "No response generated.";
    console.log('✅ OpenAI success! Reply length:', reply.length);
    
    return NextResponse.json({ reply });
    
  } catch (error: any) {
    console.error('💥 ERROR occurred:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    if (error.response) {
      console.error('OpenAI API error status:', error.response.status);
      console.error('OpenAI API error data:', error.response.data);
    }
    
    return NextResponse.json({ 
      error: `Server error: ${error.message}` 
    }, { status: 500 });
  }
}
