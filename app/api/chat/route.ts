import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai'; // <-- Using standard OpenAI now!

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// The ultimate bypass: Using the new v1 API gateway
const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  // This /v1/ URL tells Azure to completely ignore api-version rules
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/v1/`, 
});

export async function POST(req: Request) {
  try {
    const { question } = await req.json();

    // 1. Generate Embedding (Using your Embedding Deployment Name)
    const embeddingResponse = await openai.embeddings.create({
      model: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-3-small',
      input: question,
    });

    // 2. Search Supabase
    const { data: documents, error } = await supabase.rpc('match_documents', {
      query_embedding: embeddingResponse.data[0].embedding,
      match_threshold: 0.75,
      match_count: 5
    });

    if (error) throw error;

    // 3. Handle Empty Database
    if (!documents || documents.length === 0) {
      return NextResponse.json({ answer: "Δεν βρέθηκαν σχετικά έγγραφα στη βάση δεδομένων." });
    }

    const context = documents.map((doc: any) => doc.content).join('\n\n');

    // 4. Chat Completion (Using your gpt-4o Deployment Name)
    const chatResponse = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages: [
        { role: 'system', content: `You are a helpful financial assistant. Answer the question using ONLY the provided context. Context: ${context}` },
        { role: 'user', content: question }
      ],
      temperature: 0.3,
    });

    return NextResponse.json({ answer: chatResponse.choices[0].message.content });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message || "Something went wrong" }, { status: 500 });
  }
}