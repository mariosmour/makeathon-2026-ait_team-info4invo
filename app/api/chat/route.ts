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
          content: `You are a precision visual targeting AI. 
          CRITICAL: You MUST reply in pure JSON format exactly like this:
          {
            "step_1_layout_analysis": "Briefly list the numeric rows you see near the bottom (e.g., 'I see a Subtotal, then VAT, then a Final Amount. VAT is above the Final Amount.')",
            "step_2_target_selection": "The user asked for [Item]. I am locking onto its specific row.",
            "answer": "Your detailed answer",
            "top_percent": 78,
            "left_percent": 80
          }
          
          RULES:
          1. Not all invoices look the same. Analyze the actual rows present in this specific image.
          2. If the user asks for Tax/VAT, find its vertical row. It is almost always ABOVE the Total/Amount Due.
          3. Set your final 'top_percent' to match the row of the requested item.
          4. top_percent is 0-100 (0 is the top edge, 100 is the bottom edge).
          5. VERTICAL CALIBRATION: AI models naturally aim too low. Once you find your final top_percent, SUBTRACT 4 from it so the dot lands squarely on the center of the text characters.` 
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