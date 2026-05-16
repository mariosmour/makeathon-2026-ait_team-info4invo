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

    // 1. Embed the user's question
    const embeddingResponse = await openai.embeddings.create({
      model: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-3-small',
      input: question,
    });

    // 2. Search Supabase for matching documents
    const { data: documents, error } = await supabase.rpc('match_documents', {
      query_embedding: embeddingResponse.data[0].embedding,
      match_threshold: 0.10, // Slightly lower threshold to catch more variations
      match_count: 5
    });

    if (error) throw error;

    if (!documents || documents.length === 0) {
      return NextResponse.json({ answer: "Δεν βρέθηκαν σχετικά έγγραφα στη βάση δεδομένων." });
    }

    // 3. Format the Context WITH FILENAMES
    // This looks like: [Source: invoice.jpg] \n Document text here...
    const context = documents.map((doc: any) => `[Source: ${doc.metadata.source}]\n${doc.content}`).join('\n\n---\n\n');

    // 4. Ask GPT-4o to answer and CITE the source
    const chatResponse = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: `You are a helpful financial assistant. Answer the user's question using ONLY the provided context. 
          CRITICAL INSTRUCTION: You MUST cite the source filename in your answer. (Example: "According to invoice_v2.jpg, the total is...").
          
          Context:\n${context}` 
        },
        { role: 'user', content: question }
      ],
      temperature: 0.2,
    });

    return NextResponse.json({ answer: chatResponse.choices[0].message.content });

  } catch (error: any) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}