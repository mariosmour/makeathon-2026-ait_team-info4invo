'use client';

import { useState, useRef, useEffect } from 'react';

// --- THE NEW "RADAR PING" COMPONENT ---
// No Tesseract, no Web Workers, no CORS issues. Just pure CSS magic.
const HighlightedImage = ({ imageUrl, topPercent, leftPercent }: { imageUrl: string, topPercent?: number, leftPercent?: number }) => {
  return (
    <div className="relative mt-3 border border-[#d0e8da] rounded-xl overflow-hidden bg-gray-50">
      <img 
        src={imageUrl} 
        alt="Source Document" 
        className="w-full h-auto block" 
      />
      
      {/* If GPT-4o gave us coordinates, draw the glowing radar ping! */}
      {(topPercent !== undefined && leftPercent !== undefined) && (
        <div 
          style={{ top: `${topPercent}%`, left: `${leftPercent +10}%` }} 
          className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none"
        >
          {/* Outer glowing pulsing circle */}
          <span className="absolute inline-flex h-12 w-12 rounded-full bg-red-500 opacity-60 animate-ping"></span>
          {/* Inner solid targeting dot */}
          <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 shadow-[0_0_12px_rgba(220,38,38,1)] border-2 border-white"></span>
        </div>
      )}
    </div>
  );
};

// --- THE MAIN APP ---
export default function Home() {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string, image_url?: string, top_percent?: number, left_percent?: number }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setCurrentFile(e.target.files[0]);
  };

  const getBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const saveToDatabase = async () => {
    if (!currentFile) return;
    setIsLoading(true);
    setMessages((prev) => [...prev, { role: 'ai', text: `Saving ${currentFile.name} to the Cloud...` }]);

    try {
      const base64Image = await getBase64(currentFile);
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image, filename: currentFile.name }),
      });

      const data = await response.json();
      if (data.success) {
        setMessages((prev) => [...prev, { role: 'ai', text: `✅ ${currentFile.name} is saved and ready to search!` }]);
        setCurrentFile(null);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'ai', text: "❌ Failed to save document." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input;
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMsg }),
      });

      const data = await response.json();

      setMessages((prev) => [...prev, { 
        role: 'ai', 
        text: data.answer || data.error || "Κάτι πήγε στραβά.",
        image_url: data.image_url,
        top_percent: data.top_percent,
        left_percent: data.left_percent
      }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'ai', text: "Σφάλμα σύνδεσης." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex flex-col min-h-screen bg-[#f4f8f6] text-[#0f1f17] font-sans">
      <div className="flex items-center gap-2 px-10 py-3 bg-white border-b border-[#d0e8da]">
        <div className="w-[29px] h-[29px] bg-[#1a7a4a] rounded-lg flex items-center justify-center">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <rect x="3" y="3" width="8" height="10" rx="1.5" fill="white" opacity=".9"/>
            <rect x="13" y="3" width="8" height="6" rx="1.5" fill="white" opacity=".6"/>
            <rect x="3" y="15" width="18" height="6" rx="1.5" fill="white" opacity=".75"/>
          </svg>
        </div>
        <span className="text-[0.98rem] font-semibold tracking-tight">info4invo</span>
        <span className="text-[0.68rem] font-medium bg-[#d6f5e6] text-[#1a7a4a] px-2 py-0.5 rounded-full">Targeting AI</span>
      </div>

      <div className="flex-1 w-full max-w-[700px] mx-auto flex flex-col pt-10 px-5 overflow-hidden">
        {messages.length === 0 && !currentFile ? (
          <div className="text-center mt-12 mb-8">
            <h1 className="text-[1.4rem] font-semibold tracking-tight mb-2">Build your Knowledge Base</h1>
            <p className="text-[0.86rem] text-[#5a7a6a] max-w-[370px] mx-auto mb-7">
              Upload an invoice, save it, and ask questions. Our AI will visually locate the answer on the page.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pb-6 space-y-4 scrollbar-hide">
            {messages.map((msg, index) => (
              <div key={index} className={`w-full border rounded-2xl p-4 shadow-sm ${msg.role === 'user' ? 'bg-[#f0faf5] border-[#b8e8cf]' : 'bg-white border-[#d0e8da]'}`}>
                <p className="text-[0.89rem] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                {/* RENDER THE IMAGE WITH THE TARGETING PING */}
                {msg.image_url && (
                  <HighlightedImage imageUrl={msg.image_url} topPercent={msg.top_percent} leftPercent={msg.left_percent} />
                )}
              </div>
            ))}
            {isLoading && <div className="text-[#5a7a6a] text-sm animate-pulse ml-2">Locating answer coordinates...</div>}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Bottom Input Area */}
      <div className="w-full border-t border-[#d0e8da] bg-[#f4f8f6] pb-6 pt-3">
        <div className="max-w-[700px] mx-auto px-5">
          <div className="flex items-center gap-2 mb-2">
            <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileUpload} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-[1.5px] border-[#d0e8da] bg-white text-[#5a7a6a] text-[0.75rem] font-medium hover:border-[#22a060] transition-colors">
              Attach
            </button>
            {currentFile && (
              <>
                <div className="inline-flex items-center gap-1.5 bg-[#d6f5e6] border border-[#a8dfc0] rounded-full px-3 py-1 text-[0.73rem] text-[#1a7a4a] font-medium max-w-[200px] truncate">
                  {currentFile.name}
                </div>
                <button type="button" onClick={saveToDatabase} disabled={isLoading} className="inline-flex items-center gap-1 px-3 py-1 bg-[#1a7a4a] text-white rounded-full text-[0.75rem] font-medium hover:bg-[#22a060] disabled:opacity-50">
                  Save to Database
                </button>
              </>
            )}
          </div>
          <form onSubmit={sendMessage} className="relative flex items-center">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search your saved documents..." disabled={isLoading} className="w-full bg-white border-[1.5px] border-[#d0e8da] rounded-xl pl-4 pr-12 py-3 text-[#0f1f17] text-[0.89rem] shadow-sm focus:outline-none focus:border-[#22a060] focus:ring-2 focus:ring-[#22a060]/10 disabled:bg-gray-100 disabled:cursor-not-allowed" />
            <button type="submit" disabled={isLoading || !input.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#1a7a4a] rounded-lg flex items-center justify-center hover:bg-[#22a060] transition-colors disabled:opacity-50">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}