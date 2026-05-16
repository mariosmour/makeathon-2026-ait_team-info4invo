import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/v1/`, 
});

export async function POST(req: Request) {
  try {
    const { question, image } = await req.json();

    // Prepare the message payload
    const messages: any[] = [
      { 
        role: 'system', 
        content: 'Είσαι ένας βοηθός οικονομικών εγγράφων. Ανάλυσε την εικόνα του τιμολογίου που σου δόθηκε και απάντησε στην ερώτηση του χρήστη βασισμένος ΜΟΝΟ στα δεδομένα της εικόνας.' 
      }
    ];

    // If the user attached an image, use the Vision format
    if (image) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: question },
          { type: 'image_url', image_url: { url: image } }
        ]
      });
    } else {
      // Fallback if no image is attached
      messages.push({ role: 'user', content: question });
    }

    // Call GPT-4o
    const chatResponse = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages: messages,
      temperature: 0.1, // Low temperature for factual accuracy
    });

    return NextResponse.json({ answer: chatResponse.choices[0].message.content });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message || "Something went wrong" }, { status: 500 });
  }
}