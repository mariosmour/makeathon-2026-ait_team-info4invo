'use client';

import { useState } from 'react';

export default function Home() {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message to UI
    const userMsg = input;
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      // Call your new API Route
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMsg }),
      });

      const data = await response.json();

      // Add AI response to UI
      setMessages((prev) => [...prev, { 
        role: 'ai', 
        text: data.answer || data.error || "Κάτι πήγε στραβά." 
      }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'ai', text: "Σφάλμα σύνδεσης." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-8 bg-gray-50 text-gray-900">
      <div className="w-full max-w-3xl flex flex-col h-[90vh] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 text-center font-bold text-xl">
          FinDoc AI
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <p className="text-center text-gray-400 mt-10">Κάντε μια ερώτηση σχετικά με τα τιμολόγια σας...</p>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-4 rounded-2xl max-w-[80%] whitespace-pre-wrap ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-gray-100 text-gray-800 rounded-bl-none border border-gray-200'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="text-gray-400 text-sm animate-pulse ml-2">Ο FinDoc σκέφτεται...</div>
          )}
        </div>

        {/* Input Area */}
        <form onSubmit={sendMessage} className="p-4 bg-gray-50 border-t border-gray-200 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ποιο είναι το συνολικό ποσό της TechCorp;"
            className="flex-1 p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button 
            type="submit" 
            disabled={isLoading}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            Αποστολή
          </button>
        </form>
      </div>
    </main>
  );
}