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
    const { image, filename } = await req.json();

    // 1. Ask GPT-4o to extract all text from the image
    const extraction = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: 'You are a data extraction bot. Extract ALL text, numbers, dates, amounts, and vendor names from this invoice/document. Output ONLY the raw text, no intro or formatting.' 
        },
        { 
          role: 'user', 
          content: [{ type: 'image_url', image_url: { url: image } }] 
        }
      ],
      temperature: 0,
    });

    const extractedText = extraction.choices[0].message.content;

    // 2. Convert the extracted text into vector math
    const embeddingResponse = await openai.embeddings.create({
      model: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-3-small',
      input: extractedText!,
    });

    // 3. Save the text, embedding, and FILENAME to Supabase
    const { error } = await supabase.from('documents').insert({
      content: extractedText,
      metadata: { source: filename }, // <-- This is where we save the filename!
      embedding: embeddingResponse.data[0].embedding
    });

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Document saved to memory!" });
  } catch (error: any) {
    console.error("Upload Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}