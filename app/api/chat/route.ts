import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AzureOpenAI } from 'openai';

// 1. Initialize Supabase (Using Service Role Key to bypass RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 2. Initialize Azure OpenAI Client for Chat
const openai = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT, // e.g., "gpt-4o-mini"
  apiVersion: '2024-08-01-preview',
});

export async function POST(req: Request) {
  try {
    const { question } = await req.json();

    // 3. Create an embedding of the user's question
    // We use your Azure embedding deployment name here
    const embeddingResponse = await openai.embeddings.create({
      model: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-ada-002', 
      input: question,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // 4. Search Supabase (The Retrieve Step)
    const { data: documents, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.75, // Only return high-confidence matches
      match_count: 3,
    });

    if (error) {
      console.error("Supabase search error:", error);
      return NextResponse.json({ answer: "Σφάλμα κατά την αναζήτηση στη βάση δεδομένων." });
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({ answer: "Δεν βρέθηκαν σχετικά έγγραφα στη βάση δεδομένων." });
    }

    // Combine the top chunks
    const contextText = documents.map((doc: any) => doc.content).join('\n---\n');
    const sourceFile = documents[0].metadata?.source || "Unknown";

    // 5. Ask the AI with strict guardrails
    const completion = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini', 
      response_format: { type: "json_object" },
      temperature: 0.0,
      messages: [
        {
          role: 'system',
          content: `You are FinDoc AI. Answer using ONLY the context. If not there, output 'Δεν γνωρίζω'.
          Return JSON: { "answer": "...", "exact_quote": "...", "vendor_name": "...", "total_amount": 0 }
          
          Context:\n${contextText}`
        },
        { role: 'user', content: question }
      ]
    });

    const aiContent = completion.choices[0].message.content || '{}';
    const aiOutput = JSON.parse(aiContent);

    // 6. Verification & Bank Check
    if (aiOutput.answer === "Δεν γνωρίζω" || !contextText.includes(aiOutput.exact_quote)) {
        return NextResponse.json({ answer: "❌ Blocked: Δεν μπορώ να επιβεβαιώσω την απάντηση στο έγγραφο." });
    }

    let finalResponse = `Απάντηση: ${aiOutput.answer}\n📄 Πηγή: ${sourceFile}`;

    // Bonus 3: Bank Reconciliation via Supabase
    if (aiOutput.vendor_name && aiOutput.total_amount) {
        const { data: bankMatch } = await supabase
            .from('bank_statements')
            .select('status, date')
            .ilike('vendor', `%${aiOutput.vendor_name}%`)
            .eq('amount', aiOutput.total_amount)
            .limit(1)
            .single();

        if (bankMatch) {
            finalResponse += `\n🏦 Κατάσταση Τράπεζας: ${bankMatch.status === 'Cleared' ? '✅ Πληρωμένο' : '⏳ Εκκρεμεί'}`;
        }
    }

    return NextResponse.json({ answer: finalResponse, data: aiOutput });

  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}