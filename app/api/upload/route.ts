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

    // 1. Convert base64 back to a file buffer
    const base64Data = image.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Create a unique filename so we don't overwrite files with the same name
    const uniqueFilename = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.]/g, '_')}`;

    // 2. Upload to Supabase Storage Bucket
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(uniqueFilename, buffer, { contentType: 'image/jpeg' }); // Assumes jpeg/png

    if (uploadError) throw uploadError;

    // 3. Get the Public URL of the uploaded image
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(uniqueFilename);

    // 4. Ask GPT-4o to extract all text
    const extraction = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages: [
        { role: 'system', content: 'Extract ALL text, numbers, dates, amounts, and vendor names from this document. Output ONLY the raw text.' },
        { role: 'user', content: [{ type: 'image_url', image_url: { url: image } }] }
      ],
      temperature: 0,
    });
    const extractedText = extraction.choices[0].message.content;

    // 5. Convert to Vector
    const embeddingResponse = await openai.embeddings.create({
      model: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-3-small',
      input: extractedText!,
    });

    // 6. Save Text, Vector, AND the Image URL to the database
    const { error: dbError } = await supabase.from('documents').insert({
      content: extractedText,
      // WE NOW SAVE THE IMAGE URL HERE!
      metadata: { source: filename, image_url: publicUrl }, 
      embedding: embeddingResponse.data[0].embedding
    });

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, message: "Saved to Knowledge Base!" });
  } catch (error: any) {
    console.error("Upload Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}