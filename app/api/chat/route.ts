import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/v1/`,
});

// --- VIRTUAL BANK STATEMENT (CSV) ---
// Εδώ έχουμε περάσει εικονικές εγγραφές που συμπίπτουν με τα demo τιμολόγιά σας ($115.00 και $2,608.20)
const VIRTUAL_BANK_STATEMENT_CSV = `
Transaction_ID,Booking_Date,Description,Partner_Name,Amount_EUR,Status
TXN-2019-0852,2019-01-10,REMITTANCE INV-0852,JOHN DOE,-115.00,COMPLETED
TXN-2026-4412,2026-09-14,SUPPLIER PAYMENT,VODAFONE GR,-550.00,COMPLETED
TXN-2026-0916,2026-09-16,WIRE TRANSFER TOTAL CAD,UNIDOC LTD,-2608.20,COMPLETED
TXN-2026-7781,2026-09-17,OFFICE GEAR,RECEIPT-9912,-45.50,COMPLETED
`;

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
      return NextResponse.json({ answer: "Δεν βρέθηκαν σχετικά έγγραφα στη βάση." });
    }

    const context = documents.map((doc: any) => `[Source: ${doc.metadata.source}]\n${doc.content}`).join('\n\n---\n\n');
    const imageUrl = documents[0].metadata.image_url;

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
          content: `You are a financial AI agent with automated Bank Reconciliation capabilities. 
          
          VIRTUAL BANK STATEMENT DATA (CSV format):
          ${VIRTUAL_BANK_STATEMENT_CSV}

          CRITICAL: You MUST reply in pure JSON format exactly like this:
          {
            "answer": "Your clear, detailed text answer in Greek.",
            "zoom_x": 85,
            "zoom_y": 90,
            "reconciliation": {
              "is_matched": true,
              "transaction_id": "TXN-XXXXXX",
              "date": "YYYY-MM-DD",
              "partner": "Name",
              "amount": "115.00",
              "bank_status": "COMPLETED"
            }
          }
          
          DIRECTIONS FOR ZOOM:
          Identify the visual bounding box for the question topic. Set zoom_x (0-100) and zoom_y (0-100). 
          To capture numbers on the right side, shift zoom_x to 75-95.

          DIRECTIONS FOR BANK RECONCILIATION:
          If the user asks if the invoice has been paid, verified, matched, or asks for reconciliation:
          1. Check the extracted invoice total or amount from the database context.
          2. Scan the VIRTUAL BANK STATEMENT DATA provided above to see if there is an outgoing transaction matching that exact amount.
          3. If a match is found, populate the "reconciliation" object with the data from the CSV.
          4. If NO match is found, set "reconciliation": { "is_matched": false }.
          5. If the user's question is NOT about payment validation/reconciliation, set "reconciliation": null.` 
        },
        { role: 'user', content: userMessageContent }
      ],
      temperature: 0.1,
    });

    const aiResponse = JSON.parse(chatResponse.choices[0].message.content || "{}");
    aiResponse.image_url = imageUrl; 
    
    return NextResponse.json(aiResponse);
  } catch (error: any) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}