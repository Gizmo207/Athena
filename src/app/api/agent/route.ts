import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  const body = await request.json();
  console.log('Received body:', body);
  const { prompt } = body;
  if (!prompt) {
    return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
    });
    const output = completion.choices[0]?.message?.content || '';
    return NextResponse.json({ output });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'OpenAI error' }, { status: 500 });
  }
}
