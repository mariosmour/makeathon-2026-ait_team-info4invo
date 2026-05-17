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
      match_threshold: 0.10, // Kept at 10% so it always finds it
      match_count: 3
    });

    if (error) throw error;
    if (!documents || documents.length === 0) {
      return NextResponse.json({ answer: "Δεν βρέθηκαν σχετικά έγγραφα." });
    }

    // We pass the URL into the context so the AI knows it!
    const context = documents.map((doc: any) => `[Source: ${doc.metadata.source}, URL: ${doc.metadata.image_url}]\n${doc.content}`).join('\n\n---\n\n');

    // Force JSON output
    const chatResponse = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      response_format: { type: 'json_object' }, // THIS IS THE SECRET SAUCE
      messages: [
        { 
          role: 'system', 
          content: `You are a financial AI. Answer using the context. 
          CRITICAL: You MUST reply in pure JSON format exactly like this:
          {
            "answer": "Your detailed answer citing the source file",
            "image_url": "The URL of the source document",
            "highlight_text": "The EXACT short string (like '1450.00') from the document to highlight."
          }
          Context:\n${context}` 
        },
        { role: 'user', content: question }
      ],
      temperature: 0.1,
    });

    // Parse the JSON string back into a real object
    const aiResponse = JSON.parse(chatResponse.choices[0].message.content || "{}");
    
    return NextResponse.json(aiResponse);
  } catch (error: any) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}