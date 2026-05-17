import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/v1/`,
});

export async function POST(req: Request) {
  try {
    const { question } = await req.json();

    const embeddingResponse = await openai.embeddings.create({
      model: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-3-small',
      input: question,
    });

    const { data: documents, error } = await supabase.rpc('match_documents', {
      query_embedding: embeddingResponse.data[0].embedding,
      match_threshold: 0.10,
      match_count: 3
    });

    if (error) throw error;
    if (!documents || documents.length === 0) {
      return NextResponse.json({ answer: "Δεν βρέθηκαν σχετικά έγγραφα." });
    }

    const context = documents.map((doc: any) => `[Source: ${doc.metadata.source}]\n${doc.content}`).join('\n\n---\n\n');
    const imageUrl = documents[0].metadata.image_url;

    // We dynamically build the user message. If we have an image, we show it to GPT-4o!
    const userMessageContent: any[] = [
      { type: 'text', text: `Database Context:\n${context}\n\nQuestion: ${question}` }
    ];
    
    if (imageUrl) {
      userMessageContent.push({ type: 'image_url', image_url: { url: imageUrl } });
    }

    const chatResponse = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { 
          role: 'system', 
          content: `You are a financial AI. Answer the user's question using the provided context. 
          CRITICAL: You MUST reply in pure JSON format exactly like this:
          {
            "answer": "Your clear, detailed answer here.",
            "zoom_x": 80,
            "zoom_y": 85
          }
          Look at the image and estimate where the answer is physically located.
          zoom_x is 0-100 (0 is left edge, 100 is right edge).
          zoom_y is 0-100 (0 is top edge, 100 is bottom edge).` 
        },
        { role: 'user', content: userMessageContent }
      ],
      temperature: 0.1,
    });

    const aiResponse = JSON.parse(chatResponse.choices[0].message.content || "{}");
    // Securely attach the URL from our database, not the AI
    aiResponse.image_url = imageUrl; 
    
    return NextResponse.json(aiResponse);
  } catch (error: any) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}